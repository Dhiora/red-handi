import {MongoBinary} from 'mongodb-memory-server-core';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {MongoClient} from 'mongodb';
import path from 'node:path';
export async function startLocalMongo(){
 const port=27018,uri=`mongodb://127.0.0.1:${port}/redhandi?replicaSet=rs0`;
 try{const c=new MongoClient(uri,{serverSelectionTimeoutMS:1000});await c.connect();await c.close();return {uri,stop:async()=>{}}}catch{}
 const root=path.resolve('.data');await mkdir(root+'/mongodb',{recursive:true});
 const binary=await MongoBinary.getPath({version:'7.0.14',downloadDir:root+'/mongodb-bin'});
 const child=spawn(binary,['--port',String(port),'--bind_ip','127.0.0.1','--dbpath',root+'/mongodb','--replSet','rs0','--logpath',root+'/mongodb.log'],{stdio:['ignore','ignore','pipe']});
 child.stderr.on('data',d=>process.stderr.write(d));
 let client;for(let i=0;i<60;i++){try{client=new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`,{serverSelectionTimeoutMS:1000});await client.connect();break}catch{await client?.close();await new Promise(r=>setTimeout(r,500))}}
 if(!client)throw new Error('Local MongoDB did not start.');
 try{await client.db('admin').command({replSetInitiate:{_id:'rs0',members:[{_id:0,host:`127.0.0.1:${port}`}]}})}catch(e){if(e.codeName!=='AlreadyInitialized')throw e}
 await client.close();const ready=new MongoClient(uri,{serverSelectionTimeoutMS:30000});await ready.connect();await ready.close();
 console.log('MongoDB ready. Data is saved in .data/mongodb.');return {uri,stop:async()=>{child.kill('SIGTERM')}};
}
