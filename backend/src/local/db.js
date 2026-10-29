import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
export const newId=()=>crypto.randomBytes(12).toString('hex');
export const nowIso=()=>new Date().toISOString();
const schema=`
create table if not exists kv(key text primary key,value text not null);
create table if not exists users(id text primary key,email text not null unique,name text,password_hash text not null,role text not null,active integer not null default 1,created_at text not null,updated_at text not null);
create table if not exists sessions(token_hash text primary key,user_id text not null,expires_at integer not null);
create table if not exists docs(kind text not null,id text not null,data text not null,created_at text not null,updated_at text not null,primary key(kind,id));
create table if not exists orders(id text primary key,number text,origin text not null,status text not null,payment_status text,idem text unique,created_at text not null,updated_at text not null,push integer not null default 0,data text not null);
create index if not exists orders_created on orders(created_at);
create index if not exists orders_status on orders(status);
create index if not exists orders_push on orders(push) where push=1;
create table if not exists stock_movements(id text primary key,ingredient_id text,order_id text,type text,quantity real,note text,actor text,created_at text not null);
create index if not exists movements_created on stock_movements(created_at);
create table if not exists expenses(id text primary key,day text not null,category text not null,amount integer not null,note text,employee_id text,salary_month text,actor text,created_at text not null);
create index if not exists expenses_day on expenses(day);
`;
// One SQLite file holds the shop's complete, permanent record. Writes are synchronous, so each transaction is atomic.
export function openShopDb(file){
 if(file!==':memory:')fs.mkdirSync(path.dirname(file),{recursive:true});
 const db=new Database(file);
 db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');db.pragma('busy_timeout = 5000');
 db.exec(schema);
 const parse=row=>row&&{...JSON.parse(row.data),_id:row.id,createdAt:row.created_at,updatedAt:row.updated_at};
 const store={db,
  tx:fn=>db.transaction(fn)(),
  get:(kind,id)=>parse(db.prepare('select * from docs where kind=? and id=?').get(kind,String(id))),
  all:(kind)=>db.prepare('select * from docs where kind=? order by created_at').all(kind).map(parse),
  put(kind,doc){const id=String(doc._id||newId()),now=nowIso(),old=db.prepare('select created_at from docs where kind=? and id=?').get(kind,id);const {_id,createdAt,updatedAt,...data}=doc;
   db.prepare('insert into docs(kind,id,data,created_at,updated_at) values(?,?,?,?,?) on conflict(kind,id) do update set data=excluded.data,updated_at=excluded.updated_at').run(kind,id,JSON.stringify(data),old?.created_at||createdAt||now,now);return store.get(kind,id)},
  remove:(kind,id)=>db.prepare('delete from docs where kind=? and id=?').run(kind,String(id)),
  getKv:(key,fallback=null)=>{const row=db.prepare('select value from kv where key=?').get(key);return row?JSON.parse(row.value):fallback},
  setKv:(key,value)=>db.prepare('insert into kv(key,value) values(?,?) on conflict(key) do update set value=excluded.value').run(key,JSON.stringify(value)),
  order:id=>{const row=db.prepare('select * from orders where id=?').get(String(id));return row&&{...JSON.parse(row.data),_id:row.id,origin:row.origin}},
  orders:(where='1=1',...params)=>db.prepare(`select id,origin,data from orders where ${where}`).all(...params).map(row=>({...JSON.parse(row.data),_id:row.id,origin:row.origin})),
  saveOrder(order,{push}={}){const {_id,origin,...data}=order;data.updatedAt=nowIso();
   db.prepare(`insert into orders(id,number,origin,status,payment_status,idem,created_at,updated_at,push,data) values(@id,@number,@origin,@status,@payment,@idem,@created,@updated,@push,@data)
    on conflict(id) do update set number=excluded.number,status=excluded.status,payment_status=excluded.payment_status,updated_at=excluded.updated_at,push=max(orders.push,excluded.push),data=excluded.data`)
    .run({id:String(_id),number:data.number,origin:origin||'local',status:data.status,payment:data.paymentStatus||null,idem:data.idempotencyKey||null,created:new Date(data.createdAt).toISOString(),updated:data.updatedAt,push:push?1:0,data:JSON.stringify(data)});
   return store.order(_id)},
  close:()=>db.close()
 };
 return store;
}
// Keeps dated copies of the database. Point BACKUP_DIR at a synced folder (Google Drive, OneDrive) or USB drive for off-site safety.
export async function backupShopDb(store,dir,keep=30){
 fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`redhandi-shop-${nowIso().slice(0,10)}.sqlite`);
 await store.db.backup(file);
 const old=fs.readdirSync(dir).filter(f=>/^redhandi-shop-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort().slice(0,-keep);
 for(const f of old)fs.rmSync(path.join(dir,f));
 store.setKv('lastBackup',{at:nowIso(),file});return file;
}
