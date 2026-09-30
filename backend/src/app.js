import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import {z,ZodError} from 'zod';
import {Restaurant,Outlet,MenuItem,Ingredient,User,Session,Order,Slot,StockMovement} from './models.js';
import {authenticate,requireAuth,requireSuper,outletScope,login,hash} from './auth.js';
import {fail,getSlots} from './policy.js';
import {transaction} from './db.js';
import {createOrder,getCustomerOrder,publicOrder,confirmPayment,cancelOrder,advanceOrder} from './orders.js';
import {paymentsReady,previewEnabled,razorpay,verifyHmac} from './payments.js';
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const id=z.string().regex(/^[a-f\d]{24}$/i);
const money=z.number().int().min(0).max(100000000);
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const app=express();
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.post('/api/payments/webhook',express.raw({type:'application/json',limit:'256kb'}),wrap(async(req,res)=>{
 if(!verifyHmac(req.body,req.headers['x-razorpay-signature'],process.env.RAZORPAY_WEBHOOK_SECRET))fail(401,'Invalid webhook signature.');
 const event=JSON.parse(req.body.toString());
 if(['payment.captured','order.paid'].includes(event.event)){const payment=event.payload?.payment?.entity;if(payment?.status==='captured'){const order=await Order.findOne({razorpayOrderId:payment.order_id});if(order&&payment.currency==='INR')await confirmPayment(order.id,payment.id,payment.amount)}}
 if(['refund.processed','refund.failed'].includes(event.event)){const refund=event.payload?.refund?.entity;if(refund)await Order.updateOne({paymentId:refund.payment_id,'refundAmount':refund.amount,$or:[{refundId:refund.id},{_id:refund.notes?.redhandi_order}]},{$set:{refundId:refund.id,refundStatus:event.event==='refund.processed'?'processed':'review_required'}})}
 res.json({received:true});
}));
app.use(express.json({limit:'64kb'}));app.use(cookieParser());
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(['POST','PATCH','DELETE','PUT'].includes(req.method)){
 const origin=req.headers.origin;const allowed=[process.env.APP_ORIGIN,...(process.env.NODE_ENV!=='production'?['http://localhost:5173','http://127.0.0.1:5173','http://localhost:4000','http://127.0.0.1:4000']:[])].filter(Boolean);
 if(req.headers['x-rh-request']!=='1'||(origin&&!allowed.includes(origin)))return res.status(403).json({error:'Request origin is not allowed.'});}next()});
app.use('/api',rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false}));
app.use('/api',authenticate);
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.get('/api/menu',wrap(async(req,res)=>{
 const outlets=await Outlet.find({active:true}).lean();const outlet=outlets.find(o=>String(o._id)===req.query.outlet)||outlets[0];if(!outlet)return res.json({outlets:[],outlet:null,items:[],slots:[],preview:previewEnabled(),paymentsReady:paymentsReady()});
 const [items,ingredients,bookings]=await Promise.all([MenuItem.find({outletId:outlet._id}).lean(),Ingredient.find({outletId:outlet._id}).lean(),Slot.find({outletId:outlet._id,time:{$gte:new Date()},count:{$gte:outlet.slotCapacity}}).lean()]);
 const full=new Set(bookings.map(s=>s.time.toISOString()));
 const menu=items.map(item=>{const max=item.recipe.length?Math.max(0,Math.min(...item.recipe.map(r=>{const ing=ingredients.find(i=>String(i._id)===String(r.ingredientId));return ing?Math.floor((ing.stock-ing.reserved+1e-8)/r.quantity):0}))):20;const {recipe,...rest}=item;return {...rest,available:item.available&&max>0,maxQuantity:Math.min(20,max)}});
 res.json({outlets:outlets.map(o=>({_id:o._id,name:o.name})),outlet,items:menu,slots:getSlots(outlet).filter(s=>!full.has(s)),preview:previewEnabled(),paymentsReady:paymentsReady()});
}));
app.post('/api/checkout',rateLimit({windowMs:60000,limit:12,standardHeaders:'draft-8',legacyHeaders:false}),wrap(async(req,res)=>res.json(await createOrder(req.body))));
app.get('/api/orders/:id',wrap(async(req,res)=>{const order=await getCustomerOrder(req);const outlet=await Outlet.findById(order.outletId).lean();res.json({order:publicOrder(order),outlet:{name:outlet?.name,address:outlet?.address,phone:outlet?.phone}})}));
app.get('/api/orders/:id/payment-config',wrap(async(req,res)=>{const order=await getCustomerOrder(req);if(order.status!=='pending_payment'||order.expiresAt.getTime()<=Date.now()||!order.razorpayOrderId)fail(409,'This checkout is no longer available.');if(!paymentsReady())fail(503,'Online payments are not connected.');res.json({keyId:process.env.RAZORPAY_KEY_ID,razorpayOrderId:order.razorpayOrderId,amount:order.total});}));
app.post('/api/orders/:id/verify',wrap(async(req,res)=>{const order=await getCustomerOrder(req);const {razorpay_payment_id,razorpay_order_id,razorpay_signature}=z.object({razorpay_payment_id:z.string().max(100),razorpay_order_id:z.string().max(100),razorpay_signature:z.string()}).parse(req.body);
 if(order.preview||razorpay_order_id!==order.razorpayOrderId||!verifyHmac(order.razorpayOrderId+'|'+razorpay_payment_id,razorpay_signature,process.env.RAZORPAY_KEY_SECRET))fail(400,'Payment verification failed.');
 const payment=await razorpay('payments/'+encodeURIComponent(razorpay_payment_id),null,'GET');
 if(payment.order_id!==order.razorpayOrderId||payment.amount!==order.total||payment.currency!=='INR')fail(400,'Payment does not match this order.');
 if(payment.status!=='captured')return res.status(202).json({order:publicOrder(order),message:'Payment is being confirmed. Your tracking page will update automatically.'});
 res.json({order:publicOrder(await confirmPayment(order.id,payment.id,payment.amount))});
}));
app.post('/api/orders/:id/cancel',wrap(async(req,res)=>{const order=await getCustomerOrder(req);const {expectedFee}=z.object({expectedFee:money}).parse(req.body);res.json({order:publicOrder(await cancelOrder(order.id,expectedFee))})}));
app.post('/api/auth/login',rateLimit({windowMs:15*60000,limit:15,standardHeaders:'draft-8',legacyHeaders:false}),wrap(login));
app.get('/api/auth/me',(req,res)=>res.json({user:req.user||null}));
app.post('/api/auth/logout',wrap(async(req,res)=>{if(req.cookies.rh_session)await Session.deleteOne({tokenHash:hash(req.cookies.rh_session)});res.clearCookie('rh_session',{path:'/'}).json({ok:true})}));
app.post('/api/auth/password',requireAuth,wrap(async(req,res)=>{const data=z.object({currentPassword:z.string(),newPassword:z.string().min(12).max(128)}).parse(req.body);const user=await User.findById(req.user._id).select('+passwordHash');if(!await bcrypt.compare(data.currentPassword,user.passwordHash))fail(400,'Current password is incorrect.');user.passwordHash=await bcrypt.hash(data.newPassword,12);await user.save();await Session.deleteMany({userId:user.id});res.clearCookie('rh_session',{path:'/'}).json({ok:true})}));
app.use('/api/admin',requireAuth);
app.get('/api/admin/data',wrap(async(req,res)=>{
 const outlets=await Outlet.find(req.user.role==='super_admin'?{}:{_id:req.user.outletId}).lean();const outlet=outlets.find(o=>String(o._id)===req.query.outlet)||outlets[0];if(!outlet)return res.json({outlets:[],outlet:null,orders:[],items:[],ingredients:[],movements:[]});outletScope(req,outlet._id);
 const [orders,items,ingredients,movements]=await Promise.all([Order.find({outletId:outlet._id}).sort({createdAt:-1}).limit(250).lean(),MenuItem.find({outletId:outlet._id}).lean(),Ingredient.find({outletId:outlet._id}).lean(),StockMovement.find({outletId:outlet._id}).sort({createdAt:-1}).limit(50).lean()]);
 res.json({outlets,outlet,orders:orders.map(publicOrder),items,ingredients,movements,paymentsReady:paymentsReady(),preview:previewEnabled()});
}));
const outletPatch=z.object({name:z.string().trim().min(2).max(100),address:z.string().trim().min(5).max(400),phone:z.string().max(20),areas:z.array(z.string().trim().min(1).max(80)).min(1).max(20),active:z.boolean(),deliveryEnabled:z.boolean(),pickupEnabled:z.boolean(),deliveryFee:money,opening:time,closing:time,leadMinutes:z.number().int().min(15).max(240),slotCapacity:z.number().int().min(1).max(200),cancellationPercent:z.number().min(0).max(100)}).partial();
app.patch('/api/admin/outlets/:id',wrap(async(req,res)=>{outletScope(req,id.parse(req.params.id));const data=outletPatch.parse(req.body);const current=await Outlet.findById(req.params.id);if(!current)fail(404,'Outlet not found.');const merged={...current.toObject(),...data};if(merged.closing<=merged.opening)fail(400,'Closing time must be after opening time on the same day.');res.json(await Outlet.findByIdAndUpdate(current.id,{$set:data},{new:true}))}));
const menuSchema=z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().max(350),category:z.enum(['Biryani','Family packs','Sides & drinks']),price:money.refine(v=>v>=100,'Price must be at least ₹1.'),available:z.boolean(),veg:z.boolean(),serves:z.string().max(40),tag:z.string().max(40),image:z.enum(['/food.jpg','']),recipe:z.array(z.object({ingredientId:id,quantity:z.number().positive().max(10000)})).max(30)});
async function checkRecipe(data,outletId){if(new Set(data.recipe.map(r=>r.ingredientId)).size!==data.recipe.length)fail(400,'Use each ingredient only once in a recipe.');if(await Ingredient.countDocuments({_id:{$in:data.recipe.map(r=>r.ingredientId)},outletId})!==data.recipe.length)fail(400,'Recipe ingredients must belong to this outlet.')}
app.post('/api/admin/menu',wrap(async(req,res)=>{const outletId=outletScope(req,id.parse(req.body.outletId));const data=menuSchema.parse(req.body);await checkRecipe(data,outletId);res.json(await MenuItem.create({...data,outletId}))}));
app.patch('/api/admin/menu/:id',wrap(async(req,res)=>{const item=await MenuItem.findById(id.parse(req.params.id));if(!item)fail(404,'Menu item not found.');outletScope(req,item.outletId);const data=menuSchema.partial().parse(req.body);if(data.recipe)await checkRecipe(data,item.outletId);res.json(await MenuItem.findByIdAndUpdate(item.id,{$set:data},{new:true,runValidators:true}))}));
app.post('/api/admin/ingredients',wrap(async(req,res)=>{const data=z.object({outletId:id,name:z.string().trim().min(2).max(80),unit:z.enum(['kg','L','pcs']),stock:z.number().min(0).max(100000),lowAt:z.number().min(0).max(100000)}).parse(req.body);outletScope(req,data.outletId);res.json(await Ingredient.create(data))}));
app.post('/api/admin/ingredients/:id/adjust',wrap(async(req,res)=>{const {quantity,type,note}=z.object({quantity:z.number().positive().max(100000),type:z.enum(['purchase','wastage','adjustment']),note:z.string().trim().min(3).max(200)}).parse(req.body);const ingredientId=id.parse(req.params.id);
 const ingredient=await transaction(async session=>{const item=await Ingredient.findById(ingredientId).session(session);if(!item)fail(404,'Ingredient not found.');outletScope(req,item.outletId);const delta=type==='purchase'?quantity:-quantity;if(item.stock+delta<item.reserved-1e-8)fail(409,'This would use stock reserved for existing orders.');item.stock=Math.round((item.stock+delta)*1e6)/1e6;if(type==='wastage')item.wasted+=quantity;await item.save({session});await StockMovement.create([{outletId:item.outletId,ingredientId:item.id,type,quantity:delta,note,actor:req.user.email}],{session});return item});res.json(ingredient)
}));
app.patch('/api/admin/orders/:id/status',wrap(async(req,res)=>{const {status}=z.object({status:z.enum(['preparing','ready','out_for_delivery','completed'])}).parse(req.body);res.json({order:publicOrder(await advanceOrder(id.parse(req.params.id),status,req.user))})}));
app.post('/api/admin/orders/:id/refund-reconcile',wrap(async(req,res)=>{const order=await Order.findById(id.parse(req.params.id));if(!order)fail(404,'Order not found.');outletScope(req,order.outletId);if(!order.paymentId||order.preview)fail(400,'No Razorpay payment to reconcile.');const result=await razorpay(`payments/${encodeURIComponent(order.paymentId)}/refunds`,null,'GET');const refund=result.items?.find(r=>r.notes?.redhandi_order===order.id);if(!refund)fail(409,'No refund found. Review this payment in Razorpay before making a manual refund.');order.refundId=refund.id;order.refundStatus=refund.status==='processed'?'processed':refund.status==='failed'?'review_required':'submitted';await order.save();res.json({order:publicOrder(order)})}));
app.use('/api/super',requireAuth,requireSuper);
app.get('/api/super/data',wrap(async(req,res)=>{const [restaurants,outlets,users,orders]=await Promise.all([Restaurant.find().lean(),Outlet.find().lean(),User.find().lean(),Order.aggregate([{$group:{_id:'$outletId',orders:{$sum:1},revenue:{$sum:{$cond:[{$and:[{$eq:['$paymentStatus','paid']},{$eq:['$preview',false]}]},{$subtract:['$total',{$ifNull:['$refundAmount',0]}]},0]}}}}])]);res.json({restaurants,outlets,users,stats:orders})}));
app.post('/api/super/restaurants',wrap(async(req,res)=>res.json(await Restaurant.create(z.object({name:z.string().trim().min(2).max(100)}).parse(req.body)))));
app.post('/api/super/outlets',wrap(async(req,res)=>{const data=z.object({restaurantId:id,name:z.string().trim().min(2).max(100),address:z.string().trim().min(5).max(400),areas:z.array(z.string().trim().min(1).max(80)).min(1).max(20)}).parse(req.body);if(!await Restaurant.exists({_id:data.restaurantId}))fail(400,'Restaurant not found.');res.json(await Outlet.create(data))}));
app.post('/api/super/users',wrap(async(req,res)=>{const data=z.object({email:z.string().email().transform(s=>s.toLowerCase()),name:z.string().trim().min(2).max(80),password:z.string().min(12).max(128),outletId:id}).parse(req.body);if(!await Outlet.exists({_id:data.outletId}))fail(400,'Outlet not found.');if(await User.exists({email:data.email}))fail(409,'An account already exists for this email.');const user=await User.create({email:data.email,name:data.name,outletId:data.outletId,role:'admin',passwordHash:await bcrypt.hash(data.password,12)});res.json({id:user.id,email:user.email})}));
app.patch('/api/super/users/:id',wrap(async(req,res)=>{const data=z.object({active:z.boolean(),outletId:id.optional()}).parse(req.body);const user=await User.findById(id.parse(req.params.id));if(!user||user.role==='super_admin')fail(400,'Only restaurant admin accounts can be changed here.');if(data.outletId&&!await Outlet.exists({_id:data.outletId}))fail(400,'Outlet not found.');Object.assign(user,data);await user.save();await Session.deleteMany({userId:user.id});res.json({ok:true})}));
app.use('/api',(req,res)=>res.status(404).json({error:'This endpoint does not exist.'}));
app.use((err,req,res,next)=>{if(err instanceof ZodError)return res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});if(err.name==='CastError')return res.status(400).json({error:'Invalid record identifier.'});if(err.code===11000)return res.status(409).json({error:'That record already exists. Please refresh and try again.'});console.error(err.status||500,err.message);res.status(err.status||500).json({error:err.status?err.message:'Something went wrong. Please try again.'})});
