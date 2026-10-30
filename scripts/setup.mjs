import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {access,copyFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const npm=process.platform==='win32'?'npm.cmd':'npm';
const nodeMajor=Number(process.versions.node.split('.')[0]);

if(nodeMajor<20){
 console.error(`Node.js 20 or newer is required. This computer has ${process.version}.`);
 process.exit(1);
}

function run(args){
 const result=spawnSync(npm,args,{cwd:root,stdio:'inherit'});
 if(result.status)process.exit(result.status??1);
}

console.log('Installing the kitchen app and the website…');
run(['install','--prefix','backend']);
run(['install','--prefix','frontend']);

const envFile=path.join(root,'backend','.env');
try{
 await access(envFile);
 console.log('backend/.env is already there, so it was left unchanged.');
}catch{
 await copyFile(path.join(root,'backend','.env.example'),envFile);
 const {readFile,writeFile}=await import('node:fs/promises');
 const text=await readFile(envFile,'utf8');
 await writeFile(envFile,text.replace(/^MONGODB_URI=.*\n/m,'# MONGODB_URI is unset so this computer starts its own MongoDB on 127.0.0.1:27018.\n'));
 console.log('Created backend/.env for this computer. It starts a local database and does not call Razorpay.');
}

console.log('Downloading the local MongoDB program (this is skipped if it is already here)…');
const require=createRequire(path.join(root,'backend','package.json'));
const {MongoBinary}=require('mongodb-memory-server-core');
const data=path.join(root,'backend','.data');
await mkdir(path.join(data,'mongodb-bin'),{recursive:true});
await MongoBinary.getPath({version:'7.0.14',downloadDir:path.join(data,'mongodb-bin')});

console.log(`
Setup is finished.
  This computer:  npm run dev
  This Wi-Fi:     npm run global

The first start creates the menu and writes the admin password to
backend/.data/local-admin-password. Sign in at http://127.0.0.1:5173/admin
with admin@redhandi.com.
`);
