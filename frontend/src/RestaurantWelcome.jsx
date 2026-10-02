import {useEffect,useRef,useState} from 'react';
import './restaurant-welcome.css';

export default function RestaurantWelcome({order=null,tableName,disabled=false,loading=false,onOrder}){
 const stage=useRef(null),section=useRef(null),engine=useRef(null);
 const [status,setStatus]=useState('loading'),[error,setError]=useState(''),[finished,setFinished]=useState(false),[retry,setRetry]=useState(0);
 const [paused,setPaused]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [voice,setVoice]=useState(()=>{try{return sessionStorage.getItem('rh-host-voice')==='on'}catch{return false}});
 const [canSpeak]=useState(()=>typeof window.speechSynthesis!=='undefined');
 const pausedRef=useRef(paused);
 useEffect(()=>{const abort=new AbortController();setStatus('loading');setError('');setFinished(false);
  import('./RestaurantScene').then(async({createRestaurantScene})=>{if(abort.signal.aborted)return;const scene=await createRestaurantScene(stage.current,{order,paused:pausedRef.current,signal:abort.signal,onReady:()=>setStatus('ready'),onError:message=>{setStatus('error');setError(message)},onComplete:()=>setFinished(true)});if(abort.signal.aborted)scene?.dispose();else{engine.current=scene;scene?.setPaused(pausedRef.current)}}).catch(()=>{if(!abort.signal.aborted){setStatus('error');setError('The animated kitchen is unavailable. You can still place your order.')}});
  return()=>{abort.abort();engine.current?.dispose();engine.current=null}
 },[order?._id,retry]);
 useEffect(()=>{pausedRef.current=paused;engine.current?.setPaused(paused)},[paused]);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=e=>setPaused(e.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[]);
 const message=order?`Thank you! Order ${order.number} is confirmed. I’m taking your order to the kitchen. Good food is cooking!`:'Welcome to Red Handi! Good food is cooking. Tap Order Now for your favourite biryani.';
 useEffect(()=>{if(!voice||!canSpeak||status!=='ready')return;const utterance=new SpeechSynthesisUtterance(message);utterance.lang='en-IN';utterance.rate=.93;window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);return()=>window.speechSynthesis.cancel()},[voice,message,status,canSpeak]);
 function toggleVoice(){setVoice(v=>{try{sessionStorage.setItem('rh-host-voice',v?'off':'on')}catch{}return !v})}
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await section.current.requestFullscreen()}catch{setError('Full-screen mode isn’t available in this browser. The scene already fills the page.')}}
 function showBill(){document.getElementById('inperson-bill')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
 return <section ref={section} className={'rh-cinema '+(order?'rh-cinema-order':'')} aria-label={order?'Your host carries the order to the kitchen':'Welcome to the 3D Red Handi restaurant'}>
  <div className='rh-cinema-poster' aria-hidden='true'/><div ref={stage} className='rh-cinema-stage' data-scene-status={status}/><div className='rh-cinema-shade' aria-hidden='true'/>
  <header className='rh-cinema-top'><a href='/' className='rh-cinema-brand'><img src='/logo.png' alt='Red Handi'/><span>REDHANDI<small>GOOD FOOD. GOOD MOOD.</small></span></a><div className='rh-cinema-tools'>{canSpeak&&<button aria-pressed={voice} onClick={toggleVoice}>{voice?'Sound on':'Sound off'}</button>}<button onClick={()=>setPaused(v=>!v)} aria-pressed={paused}>{paused?'Play animation':'Pause animation'}</button>{document.fullscreenEnabled&&<button onClick={fullscreen} aria-label='Toggle full screen'>⛶</button>}</div></header>
  <div className='rh-cinema-title'><span className='rh-cinema-eyebrow'>{tableName||order?.tableName||'WELCOME TO OUR KITCHEN'}</span><h1>{order?<>Good food<br/>is <em>on its way.</em></>:<>A little spice.<br/>A lot of <em>heart.</em></>}</h1><p>{order?`Order #${order.number} · ${finished?'Received by our kitchen':'Your host is taking it from here'}`:'Your favourites. Fresh from the handi.'}</p></div>
  {status==='loading'&&<div className='rh-scene-loading' role='status'><span/>Opening the kitchen…</div>}
  {error&&<div className='rh-scene-error' role='status'>{error}{status==='error'&&<button onClick={()=>setRetry(n=>n+1)}>Retry animation</button>}</div>}
  <div className='rh-cinema-bottom'><div className='rh-host-caption' aria-live='polite'><span>{order?'YOUR ORDER IS CONFIRMED':'YOUR REDHANDI HOST'}</span><p>{order?(finished?'“Chef has your order. Let us cook!”':'“I’m taking your order to the kitchen!”'):'“Welcome to Red Handi!”'}</p><small>Good food is cooking.</small></div><div className='rh-cinema-action'>{order?<><button className='rh-order-button' onClick={showBill}>View your bill <span>→</span></button><button className='rh-replay' disabled={status!=='ready'} onClick={()=>{setFinished(false);engine.current?.replay()}}>Replay animation</button></>:<><button className='rh-order-button' disabled={disabled} onClick={onOrder}>{loading?'Loading menu…':'Order Now'}<span>→</span></button><small>Choose your favourites · Pay at the restaurant</small></>}</div></div>
 </section>
}
