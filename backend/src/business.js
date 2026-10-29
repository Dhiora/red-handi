import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {Order,Employee,Expense,User,Session} from './models.js';
import {fail} from './policy.js';
import {publicOrder} from './orders.js';
export const expenseCategories=['Ingredients','Packaging','Rent','Electricity & gas','Salary','Maintenance','Marketing','Other'];
const IST=330*60000;
export const dayKey=date=>new Date(date.getTime()+IST).toISOString().slice(0,10);
const istStart=(y,m,d)=>new Date(Date.UTC(y,m-1,d)-IST);
export function periodRange(period){
 const match=/^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/.exec(String(period||''));if(!match)fail(400,'Choose a valid day, month or year.');
 const [y,m,d]=[Number(match[1]),Number(match[2]||1),Number(match[3]||1)];const start=istStart(y,m,d);
 const unit=match[3]?'day':match[2]?'month':'year';
 const end=unit==='day'?istStart(y,m,d+1):unit==='month'?istStart(y,m+1,1):istStart(y+1,1,1);
 if(unit==='day'&&dayKey(start)!==period)fail(400,'Choose a valid day, month or year.');
 return {start,end,unit,startDay:dayKey(start),endDay:dayKey(end)};
}
export async function orderHistory(outletId,period){
 const {start,end,unit}=periodRange(period);if(unit==='year')fail(400,'Choose a day or a month to view orders.');
 const orders=await Order.find({outletId,createdAt:{$gte:start,$lt:end}}).sort({createdAt:-1}).limit(3000).lean();
 return {period,orders:orders.map(publicOrder),truncated:orders.length===3000};
}
export function reportRange(period,range,now=new Date()){
 if(!range)return periodRange(period);
 if(!['month','sixmonths'].includes(range))fail(400,'Choose the last month or last six months.');
 const [y,m,d]=dayKey(now).split('-').map(Number);
 const end=istStart(y,m,d+1),start=range==='month'?new Date(end.getTime()-30*86400000):istStart(y,m-5,1);
 return {start,end,unit:range==='month'?'month':'year',startDay:dayKey(start),endDay:dayKey(end)};
}
export async function salesReport(outletId,period,range){
 const {start,end,unit,startDay,endDay}=reportRange(period,range);const rowUnit=unit==='year'?'month':'day';const format=rowUnit==='month'?'%Y-%m':'%Y-%m-%d';
 const match={outletId:new mongoose.Types.ObjectId(String(outletId)),createdAt:{$gte:start,$lt:end},preview:false};const closed=['cancelled','expired','pending_payment'];
 const netAmount={$max:[0,{$subtract:['$total',{$ifNull:['$refundAmount',0]}]}]};
 const taxShare={$multiply:[{$ifNull:['$billing.tax',0]},{$divide:[netAmount,{$max:['$total',1]}]}]};
 const paidTax={$cond:[{$eq:['$paymentStatus','paid']},{$round:[taxShare,0]},0]};
 const [sales,items,expenses]=await Promise.all([
  Order.aggregate([{$match:match},{$group:{_id:{$dateToString:{date:'$createdAt',format,timezone:'+05:30'}},orders:{$sum:{$cond:[{$in:['$status',closed]},0,1]}},cancelled:{$sum:{$cond:[{$eq:['$status','cancelled']},1,0]}},sales:{$sum:{$cond:[{$eq:['$paymentStatus','paid']},{$subtract:['$total',{$ifNull:['$refundAmount',0]}]},0]}},tax:{$sum:paidTax},due:{$sum:{$cond:[{$and:[{$eq:['$paymentStatus','due']},{$not:[{$in:['$status',['cancelled','expired']]}]}]},'$total',0]}}}}]),
  Order.aggregate([{$match:{...match,status:{$nin:closed}}},{$unwind:'$items'},{$group:{_id:'$items.name',quantity:{$sum:'$items.quantity'},amount:{$sum:{$multiply:['$items.quantity','$items.unitPrice']}}}},{$sort:{quantity:-1,amount:-1}},{$limit:10}]),
  Expense.find({outletId,day:{$gte:startDay,$lt:endDay}}).sort({day:-1,createdAt:-1}).lean()
 ]);
 return assembleReport({period,range,start,end,unit,startDay,endDay},sales,items,expenses);
}
export function assembleReport({period,range,start,end,unit,startDay,endDay},sales,items,expenses){
 const rowUnit=unit==='year'?'month':'day';
 const today=dayKey(new Date()),keys=[];
 for(let t=start.getTime();t<end.getTime();){const key=dayKey(new Date(t)).slice(0,rowUnit==='month'?7:10);if(key>today.slice(0,key.length))break;keys.push(key);const [y,m,d]=dayKey(new Date(t)).split('-').map(Number);t=(rowUnit==='month'?istStart(y,m+1,1):istStart(y,m,d+1)).getTime()}
 const rows=keys.map(key=>{const s=sales.find(x=>x._id===key)||{},mine=expenses.filter(e=>e.day.startsWith(key)),salary=mine.filter(e=>e.category==='Salary').reduce((n,e)=>n+e.amount,0),other=mine.reduce((n,e)=>n+e.amount,0)-salary;
  return {key,orders:s.orders||0,cancelled:s.cancelled||0,sales:s.sales||0,tax:s.tax||0,due:s.due||0,expenses:other,salary,profit:(s.sales||0)-(s.tax||0)-other-salary}}).reverse();
 const sum=k=>rows.reduce((n,r)=>n+r[k],0);
 const totals={orders:sum('orders'),cancelled:sum('cancelled'),sales:sum('sales'),tax:sum('tax'),due:sum('due'),expenses:sum('expenses'),salary:sum('salary'),profit:sum('profit')};
 const byCategory=expenseCategories.map(category=>({category,amount:expenses.filter(e=>e.category===category).reduce((n,e)=>n+e.amount,0)})).filter(c=>c.amount>0);
 return {period,range,startDay,endDay,unit,rowUnit,rows,totals,byCategory,topItems:items.map(i=>({name:i._id,quantity:i.quantity,amount:i.amount})),expenses};
}
const mobile=z.string().regex(/^[6-9]\d{9}$/,'Enter a 10-digit mobile number.');
const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{try{return periodRange(v).unit==='day'}catch{return false}},'Choose a valid date.');
const employeeFields={name:z.string().trim().min(2).max(80),mobile:mobile.or(z.literal('')),role:z.string().trim().max(40),monthlySalary:z.number().int().min(0).max(100000000),joinedOn:day.or(z.literal('')),active:z.boolean(),appAccess:z.boolean(),password:z.string().min(8).max(128).or(z.literal(''))};
export const employeeSchema=z.object(employeeFields);
export const expenseSchema=z.object({day,category:z.enum(expenseCategories),amount:z.number().int().min(1).max(100000000),note:z.string().trim().max(200).default('')});
export const salarySchema=z.object({month,day,amount:z.number().int().min(1).max(100000000),note:z.string().trim().max(200).default('')});
async function syncLogin(employee,{appAccess,password}){
 const user=employee.userId?await User.findById(employee.userId).select('+passwordHash'):null;
 if(user&&user.role!=='staff')fail(409,'This employee is linked to an admin account. Manage it from the super admin.');
 appAccess??=!!user?.active;
 if(!appAccess||!employee.active){if(user&&user.active){user.active=false;await user.save();await Session.deleteMany({userId:user.id})}return}
 if(!employee.mobile)fail(400,'Add the employee’s mobile number to give them app access. They sign in with it.');
 if(await User.exists({email:employee.mobile,_id:{$ne:user?._id}}))fail(409,'Another account already signs in with this mobile number.');
 if(!user&&!password)fail(400,'Set a password of at least 8 characters for the employee’s app login.');
 const target=user||new User({role:'staff'});const changed=password||target.email!==employee.mobile||!target.active;
 Object.assign(target,{email:employee.mobile,name:employee.name,outletId:employee.outletId,active:true});if(password)target.passwordHash=await bcrypt.hash(password,12);
 await target.save();if(user&&changed)await Session.deleteMany({userId:target.id});employee.userId=target.id;
}
export async function saveEmployee(employee,data){
 const {appAccess,password,...fields}=data;Object.assign(employee,fields);
 await syncLogin(employee,{appAccess,password});await employee.save();return employee;
}
export async function listEmployees(outletId,salaryMonth){
 const [employees,paid]=await Promise.all([Employee.find({outletId}).sort({active:-1,createdAt:1}).lean(),Expense.aggregate([{$match:{outletId:new mongoose.Types.ObjectId(String(outletId)),category:'Salary',salaryMonth}},{$group:{_id:'$employeeId',amount:{$sum:'$amount'}}}])]);
 const logins=await User.find({_id:{$in:employees.map(e=>e.userId).filter(Boolean)}}).lean();
 return employees.map(e=>({...e,appAccess:!!logins.find(u=>String(u._id)===String(e.userId))?.active,paid:paid.find(p=>String(p._id)===String(e._id))?.amount||0}));
}
