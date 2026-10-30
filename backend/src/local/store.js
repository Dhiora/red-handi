import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {fail,canTransition,formatOrderNumber,cancellationQuote,staffDuties} from '../policy.js';
import {billingSnapshot} from '../../../shared/billing.js';
import {reportRange,periodRange,assembleReport,dayKey,expenseCategories} from '../business.js';
import {id} from '../schemas.js';
import {newId,nowIso} from './db.js';
const activeStatuses=['confirmed','preparing','ready','out_for_delivery'];
const closedStatuses=['cancelled','expired','pending_payment'];
const round6=n=>Math.round(n*1e6)/1e6;
export const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export const outletOf=s=>s.all('outlet')[0]||null;
// Live sync uploads menu, stock and tables whenever this number changes.
export const touch=s=>s.setKv('configVersion',s.getKv('configVersion',0)+1);
export function publicOrder(order){const {requirements,idempotencyKey,tokenHash,refundError,...data}=order;return {...data,cancellation:cancellationQuote(order),serverNow:nowIso()}}

function changeIngredient(s,ingredientId,fn){const ing=s.get('ingredient',ingredientId);if(!ing)return;fn(ing);for(const k of ['stock','reserved','consumed','wasted'])ing[k]=round6(ing[k]||0);s.put('ingredient',ing)}
export function reserve(s,needs,{strict}){for(const r of needs)changeIngredient(s,r.ingredientId,ing=>{if(strict&&ing.stock-ing.reserved<r.quantity-1e-8)fail(409,'There is not enough stock for this quantity.');ing.reserved+=r.quantity});touch(s)}
export function release(s,order){if(order.inventoryState!=='reserved')return;for(const r of order.requirements||[])changeIngredient(s,r.ingredientId,ing=>{ing.reserved=Math.max(0,ing.reserved-r.quantity)});order.inventoryState='released';touch(s)}
export function consume(s,order,actor){
 if(!['reserved','none'].includes(order.inventoryState))return;
 for(const r of order.requirements||[]){changeIngredient(s,r.ingredientId,ing=>{ing.stock-=r.quantity;if(order.inventoryState==='reserved')ing.reserved=Math.max(0,ing.reserved-r.quantity);ing.consumed=(ing.consumed||0)+r.quantity});
  s.db.prepare('insert into stock_movements(id,ingredient_id,order_id,type,quantity,note,actor,created_at) values(?,?,?,?,?,?,?,?)').run(newId(),String(r.ingredientId),String(order._id),'consumption',-r.quantity,order.number,actor,nowIso())}
 order.inventoryState='consumed';touch(s);
}
function linesFor(s,outlet,wanted){
 if(new Set(wanted.map(i=>i.id)).size!==wanted.length)fail(400,'Combine duplicate items.');
 const items=wanted.map(line=>({line,item:s.get('menu',line.id)}));
 if(items.some(({item})=>!item||String(item.outletId)!==String(outlet._id)||!item.available))fail(409,'An item is no longer available. Please refresh the menu.');
 const requirements=new Map();
 const lines=items.map(({line,item})=>{for(const r of item.recipe||[])requirements.set(String(r.ingredientId),(requirements.get(String(r.ingredientId))||0)+r.quantity*line.quantity);return {itemId:item._id,name:item.name,quantity:line.quantity,unitPrice:item.price}});
 return {lines,needs:[...requirements].map(([ingredientId,quantity])=>({ingredientId,quantity:round6(quantity)}))};
}
export const counterSchema=z.object({outletId:id,idempotencyKey:z.string().uuid().optional(),paymentMethod:z.enum(['cash','upi','card','due']).default('cash'),orderType:z.enum(['takeaway','dine_in']).default('takeaway'),name:z.string().trim().max(80).default(''),mobile:z.string().regex(/^[6-9]\d{9}$/).or(z.literal('')).default(''),items:z.array(z.object({id,quantity:z.number().int().min(1).max(50)})).min(1).max(40)});
export function createCounterOrder(s,body,user){
 const data=counterSchema.parse(body);const key=data.idempotencyKey||crypto.randomUUID();
 return s.tx(()=>{
  const existing=s.db.prepare('select id from orders where idem=?').get(key);if(existing)return s.order(existing.id);
  const outlet=s.get('outlet',data.outletId);if(!outlet?.active)fail(400,'This outlet is not accepting orders.');
  const {lines,needs}=linesFor(s,outlet,data.items);
  const subtotal=lines.reduce((n,i)=>n+i.unitPrice*i.quantity,0),billing=billingSnapshot(outlet,subtotal,0);
  outlet.orderSeq=(outlet.orderSeq||0)+1;s.put('outlet',outlet);
  const now=nowIso(),paid=data.paymentMethod!=='due',takeaway=data.orderType==='takeaway';
  return s.saveOrder({_id:newId(),origin:'local',number:'C-'+formatOrderNumber(outlet.orderSeq),idempotencyKey:key,source:'walkin',outletId:outlet._id,name:data.name||(takeaway?'Takeaway customer':'Walk-in customer'),mobile:data.mobile,address:'',area:'',fulfilment:takeaway?'pickup':'dine_in',tableName:takeaway?'':'Eat here',scheduledAt:now,items:lines,requirements:needs,subtotal,deliveryFee:0,total:billing.total,billing,cancellationPercent:outlet.cancellationPercent,status:'confirmed',paymentStatus:paid?'paid':'due',paymentId:paid?'walkin_'+data.paymentMethod:null,paymentMethod:data.paymentMethod,paidAt:paid?now:null,collectedBy:paid?user.email:null,confirmedAt:now,inventoryState:'released',slotReleased:true,preview:false,history:[{status:'confirmed',at:now}],createdAt:now});
 });
}
export function advanceOrder(s,orderId,next,user){return s.tx(()=>{
 const order=s.order(orderId);if(!order)fail(404,'Order not found.');if(!canTransition(order,next))fail(409,'This status change is not allowed. Refresh the order.');
 if(next==='preparing')consume(s,order,user.email);
 order.status=next;order.history=[...(order.history||[]),{status:next,at:nowIso()}];
 return s.saveOrder(order,{push:order.origin==='live'});
})}
export function collectPayment(s,orderId,method,user){return s.tx(()=>{
 const order=s.order(orderId);if(!order)fail(404,'Order not found.');
 if(!['inperson','walkin'].includes(order.source)||['cancelled','expired'].includes(order.status))fail(409,'Payment cannot be collected for this order.');
 if(order.paymentStatus==='paid')return order;
 Object.assign(order,{paymentStatus:'paid',paymentId:'restaurant_'+method,paymentMethod:method,paidAt:nowIso(),collectedBy:user.email});
 return s.saveOrder(order,{push:order.origin==='live'});
})}
export function adminData(s){
 const outlet=outletOf(s);if(!outlet)return null;
 const active=s.orders(`status in ('confirmed','preparing','ready','out_for_delivery') or (payment_status='due' and status not in ('cancelled','expired')) order by created_at`);
 const closed=s.orders(`status not in ('confirmed','preparing','ready','out_for_delivery') and not (payment_status='due' and status not in ('cancelled','expired')) order by created_at desc limit 250`);
 const movements=s.db.prepare('select * from stock_movements order by created_at desc limit 50').all().map(m=>({_id:m.id,outletId:outlet._id,ingredientId:m.ingredient_id,orderId:m.order_id,type:m.type,quantity:m.quantity,note:m.note,actor:m.actor,createdAt:m.created_at}));
 return {outlets:[outlet],outlet,orders:[...active,...closed].map(publicOrder),items:s.all('menu'),ingredients:s.all('ingredient'),movements,tables:s.all('table').map(({token,...t})=>t),summary:salesReport(s,dayKey(new Date())).totals};
}
export function orderHistory(s,period){
 const {start,end,unit}=periodRange(period);if(unit==='year')fail(400,'Choose a day or a month to view orders.');
 const orders=s.orders('created_at>=? and created_at<? order by created_at desc limit 3000',start.toISOString(),end.toISOString());
 return {period,orders:orders.map(publicOrder),truncated:orders.length===3000};
}
export function salesReport(s,period,range){
 const r=reportRange(period,range),width=r.unit==='year'?7:10;
 const orders=s.orders('created_at>=? and created_at<?',r.start.toISOString(),r.end.toISOString()).filter(o=>!o.preview);
 const groups=new Map(),items=new Map();
 for(const o of orders){
  const key=dayKey(new Date(o.createdAt)).slice(0,width),g=groups.get(key)||{_id:key,orders:0,cancelled:0,sales:0,tax:0,due:0};groups.set(key,g);
  if(!closedStatuses.includes(o.status)){g.orders++;for(const i of o.items){const t=items.get(i.name)||{_id:i.name,quantity:0,amount:0};t.quantity+=i.quantity;t.amount+=i.quantity*i.unitPrice;items.set(i.name,t)}}
  if(o.status==='cancelled')g.cancelled++;
  if(o.paymentStatus==='paid'){const net=o.total-(o.refundAmount||0);g.sales+=net;g.tax+=Math.round((o.billing?.tax||0)*Math.max(0,net)/Math.max(o.total,1))}
  if(o.paymentStatus==='due'&&!['cancelled','expired'].includes(o.status))g.due+=o.total;
 }
 const top=[...items.values()].sort((a,b)=>b.quantity-a.quantity||b.amount-a.amount).slice(0,10);
 const expenses=s.db.prepare('select * from expenses where day>=? and day<? order by day desc,created_at desc').all(r.startDay,r.endDay).map(e=>({_id:e.id,day:e.day,category:e.category,amount:e.amount,note:e.note,employeeId:e.employee_id,salaryMonth:e.salary_month,actor:e.actor,createdAt:e.created_at}));
 return assembleReport({...r,period,range},[...groups.values()],top,expenses);
}
export function addExpense(s,data,actor){const expense={id:newId(),...data,employeeId:data.employeeId||null,salaryMonth:data.salaryMonth||null,actor,createdAt:nowIso()};
 s.db.prepare('insert into expenses(id,day,category,amount,note,employee_id,salary_month,actor,created_at) values(@id,@day,@category,@amount,@note,@employeeId,@salaryMonth,@actor,@createdAt)').run(expense);const {id:_id,...rest}=expense;return {_id,...rest}}
export {expenseCategories};
// Users: the owner (admin) and employees with packing-app access (staff), who sign in with their mobile number.
export function findUser(s,where,...params){return s.db.prepare(`select * from users where ${where}`).get(...params)}
export function publicUser(s,u){if(!u)return null;const duties=u.role==='staff'?staffDuties(s.all('employee').find(e=>String(e.userId)===String(u.id))||{}):undefined;return {_id:u.id,id:u.id,email:u.email,name:u.name,role:u.role,duty:duties?.[0],duties,outletId:outletOf(s)?._id,active:!!u.active}}
export async function setUser(s,{id:userId=newId(),email,name,role,password,passwordHash,active=true}){
 const now=nowIso(),hashValue=passwordHash||(password?await bcrypt.hash(password,12):null);
 const old=findUser(s,'id=?',userId);if(!old&&!hashValue)fail(400,'A password is required.');
 s.db.prepare(`insert into users(id,email,name,password_hash,role,active,created_at,updated_at) values(?,?,?,?,?,?,?,?) on conflict(id) do update set email=excluded.email,name=excluded.name,password_hash=excluded.password_hash,role=excluded.role,active=excluded.active,updated_at=excluded.updated_at`)
  .run(userId,email.toLowerCase(),name,hashValue||old.password_hash,role,active?1:0,old?.created_at||now,now);
 if(old&&(!active||hashValue&&hashValue!==old.password_hash||email!==old.email))s.db.prepare('delete from sessions where user_id=?').run(userId);
 if(role==='staff')touch(s);
 return findUser(s,'id=?',userId);
}
export async function saveEmployee(s,existing,data){
 const {appAccess,password,...fields}=data;const employee={...(existing||{_id:newId(),outletId:outletOf(s)._id,active:true}),...fields};
 const user=employee.userId?findUser(s,'id=?',employee.userId):null;
 if(user&&user.role!=='staff')fail(409,'This employee is linked to the owner account.');
 const access=appAccess??!!user?.active;
 if(!access||!employee.active){if(user?.active)await setUser(s,{id:user.id,email:user.email,name:user.name,role:'staff',active:false})}
 else{
  if(!employee.mobile)fail(400,'Add the employee’s mobile number to give them app access. They sign in with it.');
  if(findUser(s,'email=? and id<>?',employee.mobile,user?.id||''))fail(409,'Another account already signs in with this mobile number.');
  if(!user&&!password)fail(400,'Set a password of at least 8 characters for the employee’s app login.');
  const saved=await setUser(s,{id:user?.id,email:employee.mobile,name:employee.name,role:'staff',password:password||undefined,active:true});employee.userId=saved.id;
 }
 return s.put('employee',employee);
}
export function listEmployees(s,salaryMonth){
 const paid=new Map(s.db.prepare("select employee_id,sum(amount) amount from expenses where category='Salary' and salary_month=? group by employee_id").all(salaryMonth).map(r=>[r.employee_id,r.amount]));
 return s.all('employee').sort((a,b)=>Number(b.active)-Number(a.active)).map(e=>({...e,appAccess:!!(e.userId&&findUser(s,'id=? and active=1',e.userId)),paid:paid.get(e._id)||0}));
}
export const tableSchema=z.object({name:z.string().trim().min(1).max(40).optional(),active:z.boolean().optional(),cleared:z.literal(true).optional()});
export function tableHasActiveOrders(s,tableId){return s.orders(`status in ('confirmed','preparing','ready') and json_extract(data,'$.tableId')=?`,String(tableId)).length>0}
export {activeStatuses,newId};
