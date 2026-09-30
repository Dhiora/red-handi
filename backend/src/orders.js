import crypto from 'node:crypto';
import {z} from 'zod';
import {Order,Outlet,MenuItem,Ingredient,Slot,StockMovement} from './models.js';
import {transaction} from './db.js';
import {fail,validateSlot,cancellationQuote,canTransition} from './policy.js';
import {hash} from './auth.js';
import {razorpay,paymentsReady,previewEnabled} from './payments.js';
const objectId=z.string().regex(/^[a-f\d]{24}$/i);
const checkoutSchema=z.object({outletId:objectId,name:z.string().trim().min(2).max(80),mobile:z.string().regex(/^[6-9]\d{9}$/),fulfilment:z.enum(['pickup','delivery']),address:z.string().trim().max(400).default(''),area:z.string().max(80).default(''),scheduledAt:z.string(),items:z.array(z.object({id:objectId,quantity:z.number().int().min(1).max(20)})).min(1).max(30),idempotencyKey:z.string().uuid(),accessToken:z.string().min(48).max(100),preview:z.boolean().default(false)});
export async function getCustomerOrder(req){const order=await Order.findById(req.params.id).select('+tokenHash');if(!order||!req.headers['x-order-token']||hash(String(req.headers['x-order-token']))!==order.tokenHash)fail(404,'Order not found. Open your saved tracking link.');return order}
export function publicOrder(order){const data=order.toObject?order.toObject():{...order};delete data.tokenHash;delete data.idempotencyKey;delete data.requirements;delete data.refundError;return {...data,cancellation:cancellationQuote(order),serverNow:new Date().toISOString()}}
async function releaseInventory(order,session){if(order.inventoryState==='reserved'){for(const r of order.requirements)await Ingredient.updateOne({_id:r.ingredientId},{$inc:{reserved:-r.quantity}},{session});order.inventoryState='released'}if(!order.slotReleased){await Slot.updateOne({outletId:order.outletId,time:order.scheduledAt},{$inc:{count:-1}},{session});order.slotReleased=true}}
export async function createOrder(body){
 const data=checkoutSchema.parse(body);const old=await Order.findOne({idempotencyKey:data.idempotencyKey}).select('+tokenHash');
 if(old){if(old.tokenHash!==hash(data.accessToken))fail(409,'Checkout reference already exists. Please start a new checkout.');return checkoutResponse(old)}
 if(data.preview&&!previewEnabled())fail(403,'Preview checkout is disabled.');
 if(!data.preview&&!paymentsReady())fail(503,'Online payments are not connected yet. Please contact the restaurant.');
 const outlet=await Outlet.findOne({_id:data.outletId,active:true});if(!outlet)fail(400,'This outlet is not accepting orders.');
 const scheduledAt=validateSlot(outlet,data.scheduledAt);
 if(data.fulfilment==='delivery'&&(!outlet.deliveryEnabled||!outlet.areas.includes(data.area)||data.address.length<10))fail(400,'Delivery is unavailable or the delivery address is incomplete.');
 if(data.fulfilment==='pickup'&&!outlet.pickupEnabled)fail(400,'Pickup is temporarily unavailable.');
 if(new Set(data.items.map(i=>i.id)).size!==data.items.length)fail(400,'Combine duplicate items in your bag.');
 await Slot.updateOne({outletId:outlet.id,time:scheduledAt},{$setOnInsert:{count:0}},{upsert:true});
 let created;
 try{created=await transaction(async session=>{
  const items=await MenuItem.find({_id:{$in:data.items.map(i=>i.id)},outletId:outlet.id}).session(session);
  if(items.length!==data.items.length||items.some(i=>!i.available))fail(409,'An item in your bag is no longer available. Please refresh the menu.');
  const requirements=new Map();const lines=data.items.map(line=>{const item=items.find(i=>i.id===line.id);for(const r of item.recipe){const id=String(r.ingredientId);requirements.set(id,(requirements.get(id)||0)+r.quantity*line.quantity)}return {itemId:item.id,name:item.name,quantity:line.quantity,unitPrice:item.price}});
  const reserved=await Slot.updateOne({outletId:outlet.id,time:scheduledAt,count:{$lt:outlet.slotCapacity}},{$inc:{count:1}},{session});if(!reserved.modifiedCount)fail(409,'That time slot has just filled up. Please choose another.');
  const needs=[...requirements].map(([ingredientId,quantity])=>({ingredientId,quantity:Math.round(quantity*1000000)/1000000}));
  for(const r of needs){const updated=await Ingredient.updateOne({_id:r.ingredientId,outletId:outlet.id,$expr:{$gte:[{$subtract:['$stock','$reserved']},r.quantity]}},{$inc:{reserved:r.quantity}},{session});if(!updated.modifiedCount)fail(409,'There is not enough stock for this quantity. Please update your bag.');}
  const subtotal=lines.reduce((n,i)=>n+i.unitPrice*i.quantity,0);const deliveryFee=data.fulfilment==='delivery'?outlet.deliveryFee:0;
  const [order]=await Order.create([{number:'RH-'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase(),idempotencyKey:data.idempotencyKey,tokenHash:hash(data.accessToken),outletId:outlet.id,name:data.name,mobile:data.mobile,address:data.fulfilment==='delivery'?data.address:'',area:data.area,fulfilment:data.fulfilment,scheduledAt,items:lines,requirements:needs,subtotal,deliveryFee,total:subtotal+deliveryFee,cancellationPercent:outlet.cancellationPercent,expiresAt:new Date(Date.now()+15*60000),preview:data.preview,history:[{status:'pending_payment',at:new Date()}]}],{session});return order;
 });}catch(e){if(e.code===11000){const existing=await Order.findOne({idempotencyKey:data.idempotencyKey}).select('+tokenHash');if(existing?.tokenHash===hash(data.accessToken))return checkoutResponse(existing)}throw e}
 if(data.preview){await confirmPayment(created.id,'preview_'+created.id,created.total);created=await Order.findById(created.id);return checkoutResponse(created)}
 try{const rp=await razorpay('orders',{amount:created.total,currency:'INR',receipt:created.number,notes:{redhandi_order:created.id}});created.razorpayOrderId=rp.id;await created.save();return checkoutResponse(created)}catch(e){await expireOrder(created.id);throw e}
}
function checkoutResponse(order){return {order:publicOrder(order),keyId:paymentsReady()?process.env.RAZORPAY_KEY_ID:null,razorpayOrderId:order.razorpayOrderId}}
export async function confirmPayment(id,paymentId,amount){
 return transaction(async session=>{const order=await Order.findById(id).session(session);if(!order)fail(404,'Order not found.');if(order.total!==amount)fail(400,'Payment amount does not match the order.');if(order.paymentStatus==='paid'){if(order.paymentId!==paymentId)fail(409,'This order already has a different payment.');return order}
 order.paymentStatus='paid';order.paymentId=paymentId;
 if(order.status==='pending_payment'&&order.expiresAt.getTime()>Date.now()){order.status='confirmed';order.confirmedAt=new Date();order.history.push({status:'confirmed',at:new Date()})}
 else{await releaseInventory(order,session);order.status='cancelled';order.cancelledAt=new Date();order.cancellationFee=0;order.refundAmount=order.total;order.refundStatus=order.preview?'preview_refunded':'queued';order.history.push({status:'cancelled',at:new Date()})}
 await order.save({session});return order});
}
export async function expireOrder(id){return transaction(async session=>{const order=await Order.findById(id).session(session);if(!order||order.status!=='pending_payment')return;await releaseInventory(order,session);order.status='expired';order.history.push({status:'expired',at:new Date()});await order.save({session})})}
export async function cancelOrder(id,expectedFee){return transaction(async session=>{
 const order=await Order.findById(id).session(session);if(!order)fail(404,'Order not found.');
 if(order.status==='cancelled')return order;
 if(['completed','expired'].includes(order.status))fail(409,'This order is already closed.');
 const quote=order.paymentStatus==='paid'?cancellationQuote(order):{fee:0,refund:0};
 if(expectedFee!==quote.fee)fail(409,'The cancellation fee changed. Please review the updated amount before cancelling.');
 await releaseInventory(order,session);order.status='cancelled';order.cancelledAt=new Date();order.cancellationFee=quote.fee;order.refundAmount=quote.refund;order.refundStatus=quote.refund>0?(order.preview?'preview_refunded':'queued'):'not_due';order.history.push({status:'cancelled',at:new Date()});await order.save({session});return order;
})}
export async function advanceOrder(id,next,user){return transaction(async session=>{const order=await Order.findById(id).session(session);if(!order)fail(404,'Order not found.');if(user.role!=='super_admin'&&String(order.outletId)!==String(user.outletId))fail(403,'This order belongs to another outlet.');if(!canTransition(order,next))fail(409,'This status change is not allowed. Refresh the order.');
 if(next==='preparing'){
  for(const r of order.requirements){const result=await Ingredient.updateOne({_id:r.ingredientId,stock:{$gte:r.quantity},reserved:{$gte:r.quantity}},{$inc:{stock:-r.quantity,reserved:-r.quantity,consumed:r.quantity}},{session});if(!result.modifiedCount)fail(409,'Stock needs attention before preparation can begin.');await StockMovement.create([{outletId:order.outletId,ingredientId:r.ingredientId,orderId:order.id,type:'consumption',quantity:-r.quantity,note:order.number,actor:user.email}],{session})}
  order.inventoryState='consumed';
 }
 order.status=next;order.history.push({status:next,at:new Date()});await order.save({session});return order;
})}
export async function processRefunds(){
 await Order.updateMany({refundStatus:'processing',refundClaimedAt:{$lt:new Date(Date.now()-10*60000)}},{$set:{refundStatus:'review_required',refundError:'Interrupted refund request. Reconcile with Razorpay before retrying.'}});
 const order=await Order.findOneAndUpdate({refundStatus:'queued',preview:false},{$set:{refundStatus:'processing',refundClaimedAt:new Date()}},{new:true});if(!order)return;
 try{const all=await razorpay(`payments/${encodeURIComponent(order.paymentId)}/refunds`,null,'GET');let refund=all.items?.find(r=>r.notes?.redhandi_order===order.id);
 if(!refund)refund=await razorpay(`payments/${encodeURIComponent(order.paymentId)}/refund`,{amount:order.refundAmount,notes:{redhandi_order:order.id},receipt:order.number});
 await Order.updateOne({_id:order.id},{$set:{refundId:refund.id,refundStatus:refund.status==='processed'?'processed':'submitted',refundError:''}});
 }catch(e){await Order.updateOne({_id:order.id},{$set:{refundStatus:'review_required',refundError:'Check Razorpay for an existing refund before retrying.'}});console.error('Refund requires review',order.number,e.message)}
}
