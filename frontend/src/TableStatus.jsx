import {money} from './api';
import './inperson.css';
const activeStatuses=['confirmed','preparing','ready'];
const servedAt=o=>new Date(o.history?.find(h=>h.status==='completed')?.at||o.updatedAt||0);
export function tableStatus(table,orders){
 const mine=orders.filter(o=>o.tableId===table._id);
 const waiting=mine.filter(o=>activeStatuses.includes(o.status));
 if(waiting.length)return {state:'waiting',label:'Waiting for food',orders:waiting};
 const since=new Date(table.clearedAt||table.createdAt||0);
 const eating=mine.filter(o=>o.status==='completed'&&servedAt(o)>since);
 if(eating.length)return {state:'eating',label:'Eating',orders:eating};
 return {state:'empty',label:table.active===false?'Free · QR paused':'Free',orders:[]};
}
const icons={waiting:'hourglass_top',eating:'restaurant',empty:'table_restaurant'};
export function StatusIcon({state}){return <span className='ts-icon' aria-hidden='true'><span className='material-symbols-outlined'>{icons[state]}</span>{state==='eating'&&<span className='ts-steam'><i/><i/><i/></span>}</span>}
export function TableBoard({tables,orders,mutate,busy}){
 if(!tables?.length)return null;
 const statuses=tables.map(t=>({table:t,...tableStatus(t,orders)}));
 const count=s=>statuses.filter(x=>x.state===s).length;
 return <section className='panel ts-board'><div className='panel-heading'><div><h2>Tables right now</h2><p>{count('waiting')} waiting · {count('eating')} eating · {count('empty')} free</p></div></div><div className='ts-grid'>{statuses.map(({table,state,label,orders:list})=><article key={table._id} className={'ts-card '+state}><StatusIcon state={state}/><div><strong>{table.name}</strong><span>{label}{state==='waiting'&&<b className='ts-dots'><i/><i/><i/></b>}</span>{list.length>0&&<small>{list.map(o=>'#'+o.number).join(', ')} · {money(list.reduce((s,o)=>s+o.total,0))}</small>}</div>{state==='eating'&&<button className='button outline small' disabled={busy} onClick={()=>mutate('/admin/tables/'+table._id,{cleared:true},'PATCH',table.name+' is free.').catch(()=>{})}>Mark free</button>}</article>)}</div></section>
}
