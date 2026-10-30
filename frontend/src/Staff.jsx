import {useRestaurantStore} from './state/RestaurantContext';
import {useState,useEffect,useCallback,useRef} from 'react';
import {Link} from 'react-router-dom';
import {LogOut,Bell,BellOff,RefreshCw,Package,PackageCheck,Clock,Check} from 'lucide-react';
import {toast} from 'sonner';
import BrandLoader from './components/feedback/BrandLoader';
import {api,formatTime,formatDate,localDate} from './api';
import {FullscreenButton,Field} from './components/ui';
import {WalkInView} from './KitchenTools';
import {Login} from './Admin';
const dutyLabel={kitchen:'Kitchen',counter:'Counter',service:'Service'};
const where=o=>o.tableName||({pickup:'Pickup',delivery:'Delivery'+(o.area?' · '+o.area:''),dine_in:'Dine in'})[o.fulfilment]||'Counter';
const due=o=>localDate(o.scheduledAt)===localDate(Date.now())?formatTime(o.scheduledAt):formatDate(o.scheduledAt)+' · '+formatTime(o.scheduledAt);
export default function Staff(){
 const store=useRestaurantStore();
 const [user,setUser]=useState(undefined),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[ticks,setTicks]=useState({}),[sound,setSound]=useState(false),[view,setView]=useState(()=>sessionStorage.getItem('rh-staff-duty')||''),[query,setQuery]=useState('');
 const seen=useRef(null),audio=useRef(null),wake=useRef(null);
 const load=useCallback(async()=>{try{const result=await store.load('/staff/orders'+(view?`?duty=${encodeURIComponent(view)}`:''),{force:true});setData(result);setError('');
  const watch=result.duty==='counter'||result.duty==='service'?'ready':'confirmed';
  const fresh=result.orders.filter(o=>o.status===watch).map(o=>o._id);
  if(seen.current&&fresh.some(id=>!seen.current.has(id))){chime();toast.info(watch==='ready'?'An order is ready to hand over.':'New order to pack.')}
  seen.current=new Set(fresh);
  if(result.duties?.length&&!result.duties.includes(view)){sessionStorage.setItem('rh-staff-duty',result.duty);setView(result.duty)}
 }catch(e){if(e.status===401)setUser(null);setError(e.message)}},[view]);
 useEffect(()=>{api('/auth/me').then(d=>setUser(d.user)).catch(e=>{setUser(null);setError(e.message)})},[]);
 useEffect(()=>{if(!user)return;load();const t=setInterval(load,8000);return()=>clearInterval(t)},[user,load]);
 useEffect(()=>()=>{wake.current?.release?.().catch(()=>{});audio.current?.close?.()},[]);
 function chime(){navigator.vibrate?.([200,100,200]);const ctx=audio.current;if(!ctx)return;[0,.22].forEach(at=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=at?1046:784;gain.gain.setValueAtTime(.0001,ctx.currentTime+at);gain.gain.exponentialRampToValueAtTime(.4,ctx.currentTime+at+.02);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+at+.35);osc.connect(gain).connect(ctx.destination);osc.start(ctx.currentTime+at);osc.stop(ctx.currentTime+at+.4)})}
 async function toggleSound(){if(sound){setSound(false);audio.current?.close?.();audio.current=null;wake.current?.release?.().catch(()=>{});wake.current=null;return}
  try{audio.current=new (window.AudioContext||window.webkitAudioContext)();await audio.current.resume();setSound(true);chime()}catch{toast.error('This phone could not turn on sound alerts.')}
  try{wake.current=await navigator.wakeLock?.request('screen')}catch{}}
 async function move(order,status){setBusy(order._id);try{await api('/staff/orders/'+order._id+'/status',{method:'PATCH',body:{status}});toast.success(status==='completed'?`#${order.number} was given to the customer.`:status==='ready'?`#${order.number} is packed and ready.`:`Packing #${order.number}.`);await load()}catch(e){toast.error(e.message);await load()}finally{setBusy('')}}
 async function bill(path,body,method,message){try{const result=await api(path,{method,body});toast.success(message);await load();return result}catch(e){toast.error(e.message);throw e}}
 async function logout(){try{await api('/auth/logout',{method:'POST'})}catch{}sessionStorage.removeItem('rh-staff-duty');store.clear();setUser(null);setData(null);setView('');seen.current=null}
 const tick=(id,i)=>setTicks(t=>({...t,[id+':'+i]:!t[id+':'+i]}));
 function pick(next){if(next===view)return;seen.current=null;setQuery('');sessionStorage.setItem('rh-staff-duty',next);setView(next)}
 if(user===undefined)return <BrandLoader message='Opening the packing screen.'/>;
 if(!user)return <Login staffMode onLogin={u=>{setUser(u);setError('')}}/>;
 const duties=data?.duties?.length?data.duties:['kitchen'],duty=data?.duty||duties[0],orders=data?.orders||[],handoff=duty==='counter'||duty==='service';
 const matches=o=>{const q=query.trim().toLowerCase();if(!q)return true;return [o.number,o.name,o.tableName,o.area,where(o),...o.items.map(i=>i.name)].filter(Boolean).join(' ').toLowerCase().includes(q)};
 const group=s=>orders.filter(o=>o.status===s&&(duty!=='service'||matches(o)));
 const card=o=>{const done=o.items.filter((_,i)=>ticks[o._id+':'+i]).length,packing=duty==='kitchen'&&o.status==='preparing';
  return <article key={o._id} className={'staff-card '+o.status}><header><div><strong>#{o.number}</strong>{o.preview&&<span className='preview-tag'>PREVIEW</span>}</div><span className='staff-where'>{where(o)}</span></header><p className='staff-due'><Clock size={14}/> {o.fulfilment==='dine_in'?'Ordered '+formatTime(o.createdAt):'Due '+due(o)} · {o.name}</p>
  <ul className='staff-items'>{o.items.map((item,i)=><li key={i}>{packing?<button className={ticks[o._id+':'+i]?'ticked':''} aria-pressed={!!ticks[o._id+':'+i]} onClick={()=>tick(o._id,i)}><span className='staff-check'>{ticks[o._id+':'+i]&&<Check size={16}/>}</span><b>{item.quantity} ×</b> {item.name}</button>:<span><b>{item.quantity} ×</b> {item.name}</span>}</li>)}</ul>
  {duty==='kitchen'&&o.status==='confirmed'&&<button className='button red full' disabled={!!busy} onClick={()=>move(o,'preparing')}><Package size={18}/> {busy===o._id?'Starting…':'Start preparing'}</button>}
  {packing&&<button className='button full staff-ready' disabled={!!busy} onClick={()=>move(o,'ready')}><PackageCheck size={18}/> {busy===o._id?'Saving…':done===o.items.length?'Packed · mark ready':`Mark ready (${done}/${o.items.length} ticked)`}</button>}
  {handoff&&o.status==='ready'&&<button className='button red full' disabled={!!busy} onClick={()=>move(o,'completed')}><PackageCheck size={18}/> {busy===o._id?'Saving…':'Given to customer'}</button>}
  </article>};
 const section=(status,title,empty)=>{const list=group(status);return <section className='staff-section'><h2>{title} <span>{list.length}</span></h2>{list.length?list.map(card):<p className='staff-empty'>{empty}</p>}</section>};
 const ready=section('ready',handoff?'Ready to hand over':'Ready',duty==='service'&&query.trim()?'No ready orders match that search.':handoff?'Ready orders appear here after the kitchen packs them.':"Packed orders waiting to be served or collected.");
 return <div className='staff-app'><header className='staff-top'><div className='staff-top-row'><div><img src='/logo.png' alt='RedHandi'/><div><strong>{data?.outlet?.name||'RedHandi'}</strong><small>{user.name}{duties.length<2?` · ${dutyLabel[duty]}`:''}</small></div></div><div className='staff-actions'><FullscreenButton className='icon-button'/><button className={'icon-button'+(sound?' on':'')} aria-label={sound?'Turn off sound alerts':'Turn on sound alerts'} onClick={toggleSound}>{sound?<Bell size={20}/>:<BellOff size={20}/>}</button><button className='icon-button' aria-label='Refresh orders' onClick={load}><RefreshCw size={20}/></button><button className='icon-button' aria-label='Sign out' onClick={logout}><LogOut size={20}/></button></div></div>{duties.length>1&&<nav className='staff-role-nav' aria-label='Switch staff job'>{duties.map(job=><button type='button' key={job} className={job===duty?'active':''} aria-pressed={job===duty} onClick={()=>pick(job)}>{dutyLabel[job]}</button>)}</nav>}</header>
 {!sound&&<button className='staff-sound-banner' onClick={toggleSound}><Bell size={18}/> Tap to turn on sound alerts for new orders</button>}
 {error&&<div className='error-banner' role='alert'>{error}<button onClick={load}>Retry</button></div>}
 {!data?<div className='empty-state'><RefreshCw className='spin'/><p>Loading orders…</p></div>:<main className={duty==='counter'?'is-counter':''}>{duty==='counter'&&data.outlet&&<WalkInView data={data} mutate={bill} busy={!!busy} orderPath='/staff/orders/walk-in'/>}{duty==='service'&&<div className='staff-search'><Field label='Find an order' placeholder='Order number, name, table, or dish' value={query} onChange={e=>setQuery(e.target.value)}/></div>}{duty==='kitchen'&&section('confirmed','New orders','No new orders. New ones appear here automatically.')}{duty==='kitchen'&&section('preparing','Preparing now','Tap “Start preparing” on a new order.')}{duty==='counter'?<div className='staff-handoff'>{ready}</div>:ready}</main>}
 {user.role!=='staff'&&<p className='muted-note staff-admin-link'><Link to='/admin'>Open the kitchen manager</Link></p>}</div>
}
