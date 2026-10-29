import mongoose from 'mongoose';
import {MenuItem,User} from './models.js';
import {paymentsReady} from './payments.js';
export async function launchReadiness(outlet){
 const [menu,admins,hello]=await Promise.all([MenuItem.countDocuments({outletId:outlet._id,available:true}),User.countDocuments({active:true,role:{$in:['admin','super_admin']}}),mongoose.connection.db.admin().command({hello:1})]);
 const checks=[
  {name:'Production mode',ok:process.env.NODE_ENV==='production',detail:'Run the server in production mode; preview payments are disabled there.'},
  {name:'Secure website address',ok:/^https:\/\//.test(process.env.APP_ORIGIN||''),detail:'Set APP_ORIGIN to the exact public HTTPS address before printing table QR codes.'},
  {name:'Transactional database',ok:!!hello.setName||hello.msg==='isdbgrid',detail:'Orders and stock require a MongoDB replica set or sharded cluster.'},
  {name:'Restaurant details',ok:!!outlet.phone&&!!outlet.address&&!/update your|test address/i.test(outlet.address),detail:'Set the real pickup address and restaurant phone number.'},
  {name:'Active kitchen and menu',ok:outlet.active&&menu>0,detail:'Activate the kitchen and review menu prices, recipes and opening stock.'},
  {name:'Owner access',ok:admins>0,detail:'Use individual staff accounts; verify the owner login and password.'},
 ];
 return {ready:checks.every(c=>c.ok),checks,onlinePayments:paymentsReady()&&!!process.env.RAZORPAY_WEBHOOK_SECRET,manualChecks:['Confirm managed database backups and perform a restore drill.','Place a test order from a physical table QR, print its bill, collect payment and verify the report.','Verify live payment and refund webhooks before enabling online payments.','Verify the configured GST rates and registration details if GST is enabled.']};
}
export function validateProductionEnvironment(env=process.env){
 if(env.NODE_ENV!=='production')return;
 if(!env.MONGODB_URI)throw new Error('Production requires MONGODB_URI.');
 let origin;try{origin=new URL(env.APP_ORIGIN)}catch{throw new Error('Production requires a public HTTPS APP_ORIGIN.')}
 if(origin.protocol!=='https:'||origin.origin!==env.APP_ORIGIN)throw new Error('APP_ORIGIN must be the exact HTTPS origin, without a path or trailing slash.');
 if(env.PAYMENTS_MODE==='razorpay'&&(!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET||!env.RAZORPAY_WEBHOOK_SECRET))throw new Error('Razorpay mode requires key ID, secret and webhook secret.');
 if(env.BOOTSTRAP_PASSWORD&&env.BOOTSTRAP_PASSWORD.length<12)throw new Error('The initial production admin password must contain at least 12 characters.');
 if(env.TRUST_PROXY_HOPS&&!/^[1-5]$/.test(env.TRUST_PROXY_HOPS))throw new Error('TRUST_PROXY_HOPS must be the known proxy count (1–5).');
}
