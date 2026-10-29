import {useRestaurantStore} from './state/RestaurantContext';
import {useState,useEffect,useCallback,useRef} from 'react';
import {Link} from 'react-router-dom';
import {LogOut,Bell,BellOff,RefreshCw,Package,PackageCheck,Clock,Check} from 'lucide-react';
import {toast} from 'sonner';
import BrandLoader from './components/feedback/BrandLoader';
import {api,formatTime,formatDate,localDate} from './api';
import {Login} from './Admin';
const where=o=>o.tableName||({pickup:'Pickup',delivery:'Delivery'+(o.area?' · '+o.area:''),dine_in:'Dine in'})[o.fulfilment]||'Counter';
const due=o=>localDate(o.scheduledAt)===localDate(Date.now())?formatTime(o.scheduledAt):formatDate(o.scheduledAt)+' · '+formatTime(o.scheduledAt);
export default function Staff(){
 const store=useRestaurantStore();
 const [user,setUser]=useState(undefined),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[ticks,setTicks]=useState({}),[sound,setSound]=useState(false);
 const seen=useRef(null),audio=useRef(null),wake=useRef(null);
 const load=useCallback(async()=>{try{const result=await store.load('/staff/orders',{force:true});setData(result);setError('');
  const fresh=result.orders.filter(o=>o.status==='confirmed').map(o=>o._id);
  if(seen.current&&fresh.some(id=>!seen.current.has(id))){chime();toast.info('New order to pack.')}
  seen.current=new Set(fresh);
 }catch(e){if(e.status===401)setUser(null);setError(e.message)}},[]);
 useEffect(()=>{api('/auth/me').then(d=>setUser(d.user)).catch(e=>{setUser(null);setError(e.message)})},[]);
 useEffect(()=>{if(!user)return;load();const t=setInterval(load,8000);return()=>clearInterval(t)},[user,load]);
 useEffect(()=>()=>{wake.current?.release?.().catch(()=>{});audio.current?.close?.()},[]);
 function chime(){navigator.vibrate?.([200,100,200]);const ctx=audio.current;if(!ctx)return;[0,.22].forEach(at=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=at?1046:784;gain.gain.setValueAtTime(.0001,ctx.currentTime+at);gain.gain.exponentialRampToValueAtTime(.4,ctx.currentTime+at+.02);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+at+.35);osc.connect(gain).connect(ctx.destination);osc.start(ctx.currentTime+at);osc.stop(ctx.currentTime+at+.4)})}
 async function toggleSound(){if(sound){setSound(false);audio.current?.close?.();audio.current=null;wake.current?.release?.().catch(()=>{});wake.current=null;return}
  try{audio.current=new (window.AudioContext||window.webkitAudioContext)();await audio.current.resume();setSound(true);chime()}catch{toast.error('This phone could not turn on sound alerts.')}
  try{wake.current=await navigator.wakeLock?.request('screen')}catch{}}
 async function move(order,status){setBusy(order._id);try{await api('/staff/orders/'+order._id+'/status',{method:'PATCH',body:{status}});toast.success(status==='ready'?`#${order.number} is packed and ready.`:`Packing #${order.number}.`);await load()}catch(e){toast.error(e.message);await load()}finally{setBusy('')}}
 async function logout(){try{await api('/auth/logout',{method:'POST'})}catch{}store.clear();setUser(null);setData(null);seen.current=null}
 const tick=(id,i)=>setTicks(t=>({...t,[id+':'+i]:!t[id+':'+i]}));
 if(user===undefined)return <BrandLoader message='Opening the packing screen.'/>;
 if(!user)return <Login staffMode onLogin={u=>{setUser(u);setError('')}}/>;
 const orders=data?.orders||[],group=s=>orders.filter(o=>o.status===s);
 const card=o=>{const done=o.items.filter((_,i)=>ticks[o._id+':'+i]).length,packing=o.status==='preparing';
  return <article key={o._id} className={'staff-card '+o.status}><header><div><strong>#{o.number}</strong>{o.preview&&<span className='preview-tag'>PREVIEW</span>}</div><span className='staff-where'>{where(o)}</span></header><p className='staff-due'><Clock size={14}/> {o.fulfilment==='dine_in'?'Ordered '+formatTime(o.createdAt):'Due '+due(o)} · {o.name}</p>
  <ul className='staff-items'>{o.items.map((item,i)=><li key={i}>{packing?<button className={ticks[o._id+':'+i]?'ticked':''} aria-pressed={!!ticks[o._id+':'+i]} onClick={()=>tick(o._id,i)}><span className='staff-check'>{ticks[o._id+':'+i]&&<Check size={16}/>}</span><b>{item.quantity} ×</b> {item.name}</button>:<span><b>{item.quantity} ×</b> {item.name}</span>}</li>)}</ul>
  {o.status==='confirmed'&&<button className='button red full' disabled={!!busy} onClick={()=>move(o,'preparing')}><Package size={18}/> {busy===o._id?'Starting…':'Start preparing'}</button>}
  {packing&&<button className='button full staff-ready' disabled={!!busy} onClick={()=>move(o,'ready')}><PackageCheck size={18}/> {busy===o._id?'Saving…':done===o.items.length?'Packed · mark ready':`Mark ready (${done}/${o.items.length} ticked)`}</button>}
  </article>};
 const section=(status,title,empty)=>{const list=group(status);return <section className='staff-section'><h2>{title} <span>{list.length}</span></h2>{list.length?list.map(card):<p className='staff-empty'>{empty}</p>}</section>};
 return <div className='staff-app'><header className='staff-top'><div><img src='/logo.png' alt='RedHandi'/><div><strong>{data?.outlet?.name||'RedHandi'}</strong><small>{user.name}</small></div></div><div className='staff-actions'><button className={'icon-button'+(sound?' on':'')} aria-label={sound?'Turn off sound alerts':'Turn on sound alerts'} onClick={toggleSound}>{sound?<Bell size={20}/>:<BellOff size={20}/>}</button><button className='icon-button' aria-label='Refresh orders' onClick={load}><RefreshCw size={20}/></button><button className='icon-button' aria-label='Sign out' onClick={logout}><LogOut size={20}/></button></div></header>
 {!sound&&<button className='staff-sound-banner' onClick={toggleSound}><Bell size={18}/> Tap to turn on sound alerts for new orders</button>}
 {error&&<div className='error-banner' role='alert'>{error}<button onClick={load}>Retry</button></div>}
 {!data?<div className='empty-state'><RefreshCw className='spin'/><p>Loading orders…</p></div>:<main>{section('confirmed','New orders','No new orders. New ones appear here automatically.')}{section('preparing','Preparing now','Tap “Start preparing” on a new order.')}{section('ready','Ready',"Packed orders waiting to be served or collected.")}</main>}
 {user.role!=='staff'&&<p className='muted-note staff-admin-link'><Link to='/admin'>Open the kitchen manager</Link></p>}</div>
}
