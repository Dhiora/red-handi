import dotenv from 'dotenv';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import mongoose from 'mongoose';
import {connectDb} from '../src/db.js';
import {Order,Slot,Outlet,Expense,Employee,User,Session,MenuItem} from '../src/models.js';
const backend=fileURLToPath(new URL('..',import.meta.url));
dotenv.config({path:path.join(backend,'.env')});
const usage=`Clears local RedHandi data. Start the app first so MongoDB is running.

  npm run clear -- --orders      Live orders, order history, and the next order number
  npm run clear -- --sales       Expenses and salary payments. Paid-order sales stay until --orders
  npm run clear -- --employees   Employees, staff logins, and salary payments. Admin login stays
  npm run clear -- --menu        Menu dishes. Photo files stay in frontend/public/menu
  npm run clear -- --all         Orders, sales, employees, and the menu

Kitchen settings and the admin login are kept.`;
const known=new Set(['--all','--orders','--sales','--employees','--menu']);
const args=process.argv.slice(2);
if(!args.length||args.some(arg=>!known.has(arg))){console.log(usage);process.exit(args.length?1:0)}
const jobs={orders:args.includes('--all')||args.includes('--orders'),sales:args.includes('--all')||args.includes('--sales'),employees:args.includes('--all')||args.includes('--employees'),menu:args.includes('--all')||args.includes('--menu')};
const uri=process.env.MONGODB_URI||'mongodb://127.0.0.1:27018/redhandi?replicaSet=rs0';
if(process.env.NODE_ENV==='production'||!isLocalMongo(uri)){console.error('Refusing to clear data. This command only runs against MongoDB on this computer, and not when NODE_ENV is production.');process.exit(1)}
await connectDb(uri);
try{
 if(jobs.orders)await clearOrders();
 if(jobs.sales)await clearSales();
 if(jobs.employees)await clearEmployees();
 if(jobs.menu)await clearMenu();
 console.log('Done.');
}finally{await mongoose.disconnect()}

function isLocalMongo(value){
 if(/mongodb\+srv:\/\//i.test(value))return false;
 const hosts=value.replace(/^mongodb:\/\//i,'').split('/')[0].split(',');
 return hosts.every(part=>{const host=part.split('@').pop().split(':')[0];return host==='127.0.0.1'||host==='localhost'});
}
async function clearOrders(){
 const orders=await Order.deleteMany({});
 const slots=await Slot.deleteMany({});
 const kitchens=await Outlet.updateMany({},{ $set:{orderSeq:0} });
 console.log(`Orders removed: ${orders.deletedCount}`);
 console.log(`Pickup slots removed: ${slots.deletedCount}`);
 console.log(`Next order number reset on ${kitchens.modifiedCount} kitchen(s).`);
}
async function clearSales(){
 const expenses=await Expense.deleteMany({});
 console.log(`Expenses and salary payments removed: ${expenses.deletedCount}`);
}
async function clearEmployees(){
 const staff=await User.find({role:'staff'}).select('_id');
 const sessions=await Session.deleteMany({userId:{$in:staff.map(user=>user._id)}});
 const users=await User.deleteMany({role:'staff'});
 const salary=await Expense.deleteMany({category:'Salary'});
 const employees=await Employee.deleteMany({});
 console.log(`Employees removed: ${employees.deletedCount}`);
 console.log(`Staff logins removed: ${users.deletedCount} (${sessions.deletedCount} sessions)`);
 console.log(`Salary payments removed: ${salary.deletedCount}`);
}
async function clearMenu(){
 const items=await MenuItem.deleteMany({});
 console.log(`Menu dishes removed: ${items.deletedCount}`);
}
