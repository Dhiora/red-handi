import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {app} from './app.js';
import {connectDb} from './db.js';
import {seed} from './seed.js';
import {Order} from './models.js';
import {expireOrder,processRefunds} from './orders.js';
let localMongo;
if(process.env.NODE_ENV!=='production'&&!process.env.MONGODB_URI){const {startLocalMongo}=await import('../scripts/local-mongo.mjs');localMongo=await startLocalMongo();process.env.MONGODB_URI=localMongo.uri}
if(!process.env.MONGODB_URI)throw new Error('Set MONGODB_URI to a MongoDB replica set connection string.');
if(process.env.NODE_ENV!=='production'){
 await mkdir('.data',{recursive:true});let password;try{password=(await readFile('.data/local-admin-password','utf8')).trim()}catch{password=crypto.randomBytes(18).toString('base64url');await writeFile('.data/local-admin-password',password,{mode:0o600})}
 process.env.BOOTSTRAP_PASSWORD ||= password;process.env.PREVIEW_CHECKOUT ??='true';
}
await connectDb(process.env.MONGODB_URI);await seed();
const dist=process.env.FRONTEND_DIST?path.resolve(process.env.FRONTEND_DIST):fileURLToPath(new URL('../../frontend/dist',import.meta.url));
app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
const server=app.listen(Number(process.env.PORT)||4000,process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1',()=>console.log(`RedHandi API ready at http://127.0.0.1:${process.env.PORT||4000}`));
let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{const expired=await Order.find({status:'pending_payment',expiresAt:{$lt:new Date()}}).limit(25);for(const order of expired)await expireOrder(order.id);await processRefunds()}catch(e){console.error('Order maintenance:',e.message)}finally{busy=false}},15000);
async function stop(){clearInterval(timer);server.close();await mongoose.disconnect();await localMongo?.stop();process.exit()};process.on('SIGINT',stop);process.on('SIGTERM',stop);
