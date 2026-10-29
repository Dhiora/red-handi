import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {MongoMemoryReplSet}=require('mongodb-memory-server-core');
const db=await MongoMemoryReplSet.create({binary:{version:'7.0.14'},replSet:{count:1}});
const run=(args,env)=>new Promise((resolve,reject)=>{const child=spawn(process.platform==='win32'?'npm.cmd':'npm',args,{stdio:'inherit',env:{...process.env,...env}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Check failed: '+args.join(' '))))});
try{await run(['test','--prefix','backend'],{TEST_MONGODB_URI:db.getUri()});await run(['test','--prefix','frontend']);await run(['run','build'])}finally{await db.stop()}
