import {launchReadiness} from './readiness.js';
import express from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import {z,ZodError} from 'zod';
import {Restaurant,Outlet,MenuItem,Ingredient,User,Session,Order,Slot,StockMovement,DiningTable,Employee,Expense} from './models.js';
import {authenticate,requireAuth,requireSuper,requireManager,outletScope,login,hash} from './auth.js';
import {fail,getSlots} from './policy.js';
import {transaction} from './db.js';
import {id,money,time,outletPatch,menuSchema,ingredientSchema,adjustSchema,validateOutlet} from './schemas.js';
import {createOrder,getCustomerOrder,publicOrder,confirmPayment,cancelOrder,advanceOrder,createWalkInOrder,createSelfOrder} from './orders.js';
import {paymentsReady,previewEnabled,razorpay,verifyHmac} from './payments.js';
import {orderHistory,salesReport,dayKey,listEmployees,saveEmployee,employeeSchema,expenseSchema,salarySchema} from './business.js';
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export const app=express();
app.disable('x-powered-by');
if(process.env.TRUST_PROXY_HOPS)app.set('trust proxy',Number(process.env.TRUST_PROXY_HOPS));
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.post('/api/payments/webhook',express.raw({type:'application/json',limit:'256kb'}),wrap(async(req,res)=>{
 if(!verifyHmac(req.body,req.headers['x-razorpay-signature'],process.env.RAZORPAY_WEBHOOK_SECRET))fail(401,'Invalid webhook signature.');
 const event=JSON.parse(req.body.toString());
 if(['payment.captured','order.paid'].includes(event.event)){const payment=event.payload?.payment?.entity;if(payment?.status==='captured'){const order=await Order.findOne({razorpayOrderId:payment.order_id});if(order&&payment.currency==='INR')await confirmPayment(order.id,payment.id,payment.amount)}}
 if(['refund.processed','refund.failed'].includes(event.event)){const refund=event.payload?.refund?.entity;if(refund)await Order.updateOne({paymentId:refund.payment_id,'refundAmount':refund.amount,$or:[{refundId:refund.id},{_id:refund.notes?.redhandi_order}]},{$set:{refundId:refund.id,refundStatus:event.event==='refund.processed'?'processed':'review_required'}})}
 res.json({received:true});
}));
app.use(express.json({limit:'64kb'}));app.use(cookieParser());
function lanDevOrigin(origin){if(process.env.HOST_LAN!=='1'||process.env.NODE_ENV==='production'||!origin)return false;try{const url=new URL(origin);if(url.protocol!=='http:'||!['5173','4000'].includes(url.port))return false;const parts=url.hostname.split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;const [a,b]=parts;return a===10||(a===192&&b===168)||(a===172&&b>=16&&b<=31)}catch{return false}}
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(['POST','PATCH','DELETE','PUT'].includes(req.method)){
 const origin=req.headers.origin;const allowed=[process.env.APP_ORIGIN,...(process.env.NODE_ENV!=='production'?['http://localhost:5173','http://127.0.0.1:5173','http://localhost:4000','http://127.0.0.1:4000']:[])].filter(Boolean);
 if(req.headers['x-rh-request']!=='1'||(origin&&!allowed.includes(origin)&&!lanDevOrigin(origin)))return res.status(403).json({error:'Request origin is not allowed.'});}next()});
app.use('/api',rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false}));
app.use('/api',authenticate);
app.get('/api/health',(req,res)=>{const ok=mongoose.connection.readyState===1;res.status(ok?200:503).json({ok})});
app.get('/api/menu',wrap(async(req,res)=>{
 const outlets=await Outlet.find({active:true}).lean();const outlet=outlets.find(o=>String(o._id)===req.query.outlet)||outlets[0];if(!outlet)return res.json({outlets:[],outlet:null,items:[],slots:[],preview:previewEnabled(),paymentsReady:paymentsReady()});
 const [items,bookings]=await Promise.all([MenuItem.find({outletId:outlet._id}).lean(),Slot.find({outletId:outlet._id,time:{$gte:new Date()},count:{$gte:outlet.slotCapacity}}).lean()]);
 const full=new Set(bookings.map(s=>s.time.toISOString()));
 const menu=items.map(item=>{const {recipe,...rest}=item;return {...rest,available:!!item.available,maxQuantity:20}});
 res.json({outlets:outlets.map(o=>({_id:o._id,name:o.name})),outlet,items:menu,slots:getSlots(outlet).filter(s=>!full.has(s)),preview:previewEnabled(),paymentsReady:paymentsReady()});
}));
app.get('/api/tables/:token',wrap(async(req,res)=>{const table=await DiningTable.findOne({token:req.params.token,active:true}).lean();if(!table||!await Outlet.exists({_id:table.outletId,active:true}))fail(404,'This table QR code is no longer available.');res.json({name:table.name,outletId:table.outletId})}));
app.post('/api/inperson/orders',rateLimit({windowMs:60000,limit:12,standardHeaders:'draft-8',legacyHeaders:false}),wrap(async(req,res)=>res.json(await createSelfOrder(req.body))));
app.post('/api/checkout' ,rateLimit({windowMs:60000,limit:12,standardHeaders:'draft-8',legacyHeaders:false}),wrap(async(req,res)=>res.json(await createOrder(req.body))));
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
app.use('/api/staff',requireAuth);
const staffOutlet=async req=>req.user.role==='super_admin'?(req.query.outlet?id.parse(req.query.outlet):(await Outlet.findOne({active:true}).lean())?._id):req.user.outletId;
app.get('/api/staff/orders',wrap(async(req,res)=>{const outletId=await staffOutlet(req);if(!outletId)fail(404,'No kitchen is assigned to this account.');const [outlet,orders]=await Promise.all([Outlet.findById(outletId).select('name').lean(),Order.find({outletId,status:{$in:['confirmed','preparing','ready']}}).sort({scheduledAt:1,createdAt:1}).lean()]);res.json({outlet,orders:orders.map(o=>({_id:o._id,number:o.number,status:o.status,name:o.name,fulfilment:o.fulfilment,tableName:o.tableName,area:o.area,scheduledAt:o.scheduledAt,createdAt:o.createdAt,items:o.items.map(i=>({name:i.name,quantity:i.quantity})),preview:o.preview}))})}));
app.patch('/api/staff/orders/:id/status',wrap(async(req,res)=>{const {status}=z.object({status:z.enum(['preparing','ready'])}).parse(req.body);const order=await advanceOrder(id.parse(req.params.id),status,req.user);res.json({ok:true,status:order.status})}));
app.use('/api/admin',requireAuth,requireManager);
app.get('/api/admin/readiness',wrap(async(req,res)=>{const outletId=outletScope(req,id.parse(req.query.outlet));const outlet=await Outlet.findById(outletId);if(!outlet)fail(404,'Outlet not found.');res.json(await launchReadiness(outlet))}));
app.get('/api/admin/tables',wrap(async(req,res)=>{const outletId=outletScope(req,id.parse(req.query.outlet));res.json({tables:await DiningTable.find({outletId}).sort({createdAt:1}).lean()})}));
app.post('/api/admin/tables',wrap(async(req,res)=>{const outletId=outletScope(req,id.parse(req.body.outletId));const name=z.string().trim().min(1).max(40).parse(req.body.name);res.json(await DiningTable.create({outletId,name,token:crypto.randomBytes(24).toString('hex')}))}));
app.patch('/api/admin/tables/:id',wrap(async(req,res)=>{const table=await DiningTable.findById(id.parse(req.params.id));if(!table)fail(404,'Table not found.');outletScope(req,table.outletId);const {cleared,...patch}=z.object({name:z.string().trim().min(1).max(40).optional(),active:z.boolean().optional(),cleared:z.literal(true).optional()}).parse(req.body);Object.assign(table,patch);if(cleared)table.clearedAt=new Date();await table.save();res.json(table)}));
app.delete('/api/admin/tables/:id',wrap(async(req,res)=>{const table=await DiningTable.findById(id.parse(req.params.id));if(!table)fail(404,'Table not found.');outletScope(req,table.outletId);if(await Order.exists({tableId:table._id,status:{$in:['confirmed','preparing','ready']}}))fail(409,'This table has orders in progress. Complete or cancel them before deleting it.');await table.deleteOne();res.json({ok:true})}));
app.post('/api/admin/orders/:id/collect',wrap(async(req,res)=>{
 const order=await Order.findById(id.parse(req.params.id));if(!order)fail(404,'Order not found.');outletScope(req,order.outletId);
 const {method}=z.object({method:z.enum(['cash','upi','card']).default('cash')}).parse(req.body);
 if(!['inperson','walkin'].includes(order.source)||['cancelled','expired'].includes(order.status))fail(409,'Payment cannot be collected for this order.');
 const paid=await Order.findOneAndUpdate({_id:order.id,paymentStatus:'due',status:{$nin:['cancelled','expired']}},{$set:{paymentStatus:'paid',paymentId:'restaurant_'+method,paymentMethod:method,paidAt:new Date(),collectedBy:req.user.email}},{new:true});
 if(!paid){const current=await Order.findById(order.id);if(current.paymentStatus!=='paid'||['cancelled','expired'].includes(current.status))fail(409,'Order changed. Refresh before collecting payment.');return res.json({ok:true,order:publicOrder(current)})}
 res.json({ok:true,order:publicOrder(paid)});
}));
app.post('/api/admin/orders/walk-in' ,wrap(async(req,res)=>{const outletId=outletScope(req,id.parse(req.body.outletId));res.json({order:publicOrder(await createWalkInOrder({...req.body,outletId},req.user))})}));
app.get('/api/admin/data',wrap(async(req,res)=>{
 const outlets=await Outlet.find(req.user.role==='super_admin'?{}:{_id:req.user.outletId}).lean();const outlet=outlets.find(o=>String(o._id)===req.query.outlet)||outlets[0];if(!outlet)return res.json({outlets:[],outlet:null,orders:[],items:[],ingredients:[],movements:[],tables:[]});outletScope(req,outlet._id);
 const [orders,items,ingredients,movements,tables,summary]=await Promise.all([Promise.all([Order.find({outletId:outlet._id,$or:[{status:{$in:['confirmed','preparing','ready','out_for_delivery']}},{paymentStatus:'due',status:{$nin:['cancelled','expired']}}]}).sort({createdAt:1}).lean(),Order.find({outletId:outlet._id,status:{$nin:['confirmed','preparing','ready','out_for_delivery']},$or:[{paymentStatus:{$ne:'due'}},{status:{$in:['cancelled','expired']}}]}).sort({createdAt:-1}).limit(250).lean()]).then(([active,closed])=>[...active,...closed]),MenuItem.find({outletId:outlet._id}).lean(),Ingredient.find({outletId:outlet._id}).lean(),StockMovement.find({outletId:outlet._id}).sort({createdAt:-1}).limit(50).lean(),DiningTable.find({outletId:outlet._id}).select('-token').sort({createdAt:1}).lean(),salesReport(outlet._id,dayKey(new Date()))]);
 res.json({outlets,outlet,summary:summary.totals,orders:orders.map(publicOrder),items,ingredients,movements,tables,paymentsReady:paymentsReady(),preview:previewEnabled()});
}));
app.patch('/api/admin/outlets/:id',wrap(async(req,res)=>{outletScope(req,id.parse(req.params.id));const data=outletPatch.parse(req.body);const current=await Outlet.findById(req.params.id);if(!current)fail(404,'Outlet not found.');const merged={...current.toObject(),...data};validateOutlet(merged);res.json(await Outlet.findByIdAndUpdate(current.id,{$set:data},{new:true}))}));
async function checkRecipe(data,outletId){if(new Set(data.recipe.map(r=>r.ingredientId)).size!==data.recipe.length)fail(400,'Use each ingredient only once in a recipe.');if(await Ingredient.countDocuments({_id:{$in:data.recipe.map(r=>r.ingredientId)},outletId})!==data.recipe.length)fail(400,'Recipe ingredients must belong to this outlet.')}
app.post('/api/admin/menu',wrap(async(req,res)=>{const outletId=outletScope(req,id.parse(req.body.outletId));const data=menuSchema.parse(req.body);await checkRecipe(data,outletId);res.json(await MenuItem.create({...data,outletId}))}));
app.patch('/api/admin/menu/:id',wrap(async(req,res)=>{const item=await MenuItem.findById(id.parse(req.params.id));if(!item)fail(404,'Menu item not found.');outletScope(req,item.outletId);const data=menuSchema.partial().parse(req.body);if(data.recipe)await checkRecipe(data,item.outletId);res.json(await MenuItem.findByIdAndUpdate(item.id,{$set:data},{new:true,runValidators:true}))}));
app.post('/api/admin/ingredients',wrap(async(req,res)=>{const data=ingredientSchema.parse(req.body);outletScope(req,data.outletId);res.json(await Ingredient.create(data))}));
app.post('/api/admin/ingredients/:id/adjust',wrap(async(req,res)=>{const {quantity,type,note}=adjustSchema.parse(req.body);const ingredientId=id.parse(req.params.id);
 const ingredient=await transaction(async session=>{const item=await Ingredient.findById(ingredientId).session(session);if(!item)fail(404,'Ingredient not found.');outletScope(req,item.outletId);const delta=type==='purchase'?quantity:-quantity;if(item.stock+delta<item.reserved-1e-8)fail(409,'This would use stock reserved for existing orders.');item.stock=Math.round((item.stock+delta)*1e6)/1e6;if(type==='wastage')item.wasted+=quantity;await item.save({session});await StockMovement.create([{outletId:item.outletId,ingredientId:item.id,type,quantity:delta,note,actor:req.user.email}],{session});return item});res.json(ingredient)
}));
app.patch('/api/admin/orders/:id/status',wrap(async(req,res)=>{const {status}=z.object({status:z.enum(['preparing','ready','out_for_delivery','completed'])}).parse(req.body);res.json({order:publicOrder(await advanceOrder(id.parse(req.params.id),status,req.user))})}));
app.post('/api/admin/orders/:id/refund-reconcile',wrap(async(req,res)=>{const order=await Order.findById(id.parse(req.params.id));if(!order)fail(404,'Order not found.');outletScope(req,order.outletId);if(!order.paymentId||order.preview)fail(400,'No Razorpay payment to reconcile.');const result=await razorpay(`payments/${encodeURIComponent(order.paymentId)}/refunds`,null,'GET');const refund=result.items?.find(r=>r.notes?.redhandi_order===order.id);if(!refund)fail(409,'No refund found. Review this payment in Razorpay before making a manual refund.');order.refundId=refund.id;order.refundStatus=refund.status==='processed'?'processed':refund.status==='failed'?'review_required':'submitted';await order.save();res.json({order:publicOrder(order)})}));
app.get('/api/admin/orders/history',wrap(async(req,res)=>res.json(await orderHistory(outletScope(req,id.parse(req.query.outlet)),String(req.query.period||'')))));
app.get('/api/admin/reports',wrap(async(req,res)=>res.json(await salesReport(outletScope(req,id.parse(req.query.outlet)),String(req.query.period||''),req.query.range))));
app.post('/api/admin/expenses',wrap(async(req,res)=>{const outletId=outletScope(req,id.parse(req.body.outletId));res.json(await Expense.create({...expenseSchema.parse(req.body),outletId,actor:req.user.email}))}));
app.delete('/api/admin/expenses/:id',wrap(async(req,res)=>{const expense=await Expense.findById(id.parse(req.params.id));if(!expense)fail(404,'Expense not found.');outletScope(req,expense.outletId);await expense.deleteOne();res.json({ok:true})}));
app.get('/api/admin/employees',wrap(async(req,res)=>{const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.query.month);res.json({employees:await listEmployees(outletScope(req,id.parse(req.query.outlet)),month)})}));
app.post('/api/admin/employees',wrap(async(req,res)=>{const outletId=outletScope(req,id.parse(req.body.outletId));const data=employeeSchema.parse(req.body);res.json(await saveEmployee(new Employee({outletId}),data))}));
app.patch('/api/admin/employees/:id',wrap(async(req,res)=>{const employee=await Employee.findById(id.parse(req.params.id));if(!employee)fail(404,'Employee not found.');outletScope(req,employee.outletId);res.json(await saveEmployee(employee,employeeSchema.partial().parse(req.body)))}));
app.post('/api/admin/employees/:id/salary',wrap(async(req,res)=>{const employee=await Employee.findById(id.parse(req.params.id));if(!employee)fail(404,'Employee not found.');outletScope(req,employee.outletId);const data=salarySchema.parse(req.body);res.json(await Expense.create({outletId:employee.outletId,day:data.day,category:'Salary',amount:data.amount,note:data.note||`${employee.name} · salary for ${data.month}`,employeeId:employee.id,salaryMonth:data.month,actor:req.user.email}))}));
app.use('/api/super',requireAuth,requireSuper);
app.get('/api/super/data',wrap(async(req,res)=>{const [restaurants,outlets,users,orders]=await Promise.all([Restaurant.find().lean(),Outlet.find().lean(),User.find().lean(),Order.aggregate([{$group:{_id:'$outletId',orders:{$sum:1},revenue:{$sum:{$cond:[{$and:[{$eq:['$paymentStatus','paid']},{$eq:['$preview',false]}]},{$subtract:['$total',{$ifNull:['$refundAmount',0]}]},0]}}}}])]);res.json({restaurants,outlets,users,stats:orders})}));
app.post('/api/super/restaurants',wrap(async(req,res)=>res.json(await Restaurant.create(z.object({name:z.string().trim().min(2).max(100)}).parse(req.body)))));
app.post('/api/super/outlets',wrap(async(req,res)=>{const data=z.object({restaurantId:id,name:z.string().trim().min(2).max(100),address:z.string().trim().min(5).max(400),areas:z.array(z.string().trim().min(1).max(80)).min(1).max(20)}).parse(req.body);if(!await Restaurant.exists({_id:data.restaurantId}))fail(400,'Restaurant not found.');res.json(await Outlet.create(data))}));
app.post('/api/super/users',wrap(async(req,res)=>{const data=z.object({email:z.string().email().transform(s=>s.toLowerCase()),name:z.string().trim().min(2).max(80),password:z.string().min(12).max(128),outletId:id}).parse(req.body);if(!await Outlet.exists({_id:data.outletId}))fail(400,'Outlet not found.');if(await User.exists({email:data.email}))fail(409,'An account already exists for this email.');const user=await User.create({email:data.email,name:data.name,outletId:data.outletId,role:'admin',passwordHash:await bcrypt.hash(data.password,12)});res.json({id:user.id,email:user.email})}));
app.patch('/api/super/users/:id',wrap(async(req,res)=>{const data=z.object({active:z.boolean(),outletId:id.optional()}).parse(req.body);const user=await User.findById(id.parse(req.params.id));if(!user||user.role==='super_admin')fail(400,'Only restaurant admin accounts can be changed here.');if(data.outletId&&!await Outlet.exists({_id:data.outletId}))fail(400,'Outlet not found.');Object.assign(user,data);await user.save();await Session.deleteMany({userId:user.id});res.json({ok:true})}));
app.use('/api',(req,res)=>res.status(404).json({error:'This endpoint does not exist.'}));
app.use((err,req,res,next)=>{if(err instanceof ZodError)return res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});if(err.name==='CastError')return res.status(400).json({error:'Invalid record identifier.'});if(err.code===11000)return res.status(409).json({error:'That record already exists. Please refresh and try again.'});console.error(err.status||500,err.message);res.status(err.status||500).json({error:err.status?err.message:'Something went wrong. Please try again.'})});
