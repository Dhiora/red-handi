import {useEffect,useRef,useState} from 'react';
import './restaurant-welcome.css';

/** Silent, AI-generated video playback. Ordering never depends on video playback. */
export default function RestaurantFilm({film,order,tableName,disabled,loading,onOrder}){
 const player=useRef(null),section=useRef(null);
 const [src,setSrc]=useState(film?.src),[idle,setIdle]=useState(false),[ended,setEnded]=useState(false),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[playBlocked,setPlayBlocked]=useState(false);
 const [paused,setPaused]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const poster=film?.poster||'/cinema/waiter-keyframe.png';
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=e=>setPaused(e.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[]);
 useEffect(()=>{const video=player.current;if(!video||failed)return;let active=true;video.muted=true;if(paused)video.pause();else video.play().then(()=>{if(active)setPlayBlocked(false)}).catch(()=>{if(active)setPlayBlocked(true)});return()=>{active=false;video.pause()}},[src,paused,failed]);
 function end(){if(!order&&film?.idle&&!idle){setIdle(true);setSrc(film.idle)}else setEnded(true)}
 function replay(){setEnded(false);setIdle(false);setPaused(false);setSrc(film.src);const video=player.current;if(video){video.currentTime=0;video.play().then(()=>setPlayBlocked(false)).catch(()=>setPlayBlocked(true))}}
 function play(){setPaused(false);player.current?.play().then(()=>setPlayBlocked(false)).catch(()=>setPlayBlocked(true))}
 function bill(){document.getElementById('inperson-bill')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
 async function full(){try{if(document.fullscreenElement)await document.exitFullscreen();else await section.current.requestFullscreen()}catch{}}
 return <section ref={section} className='rh-cinema rh-film' aria-label={order?'Your waiter takes the order to the kitchen':'Welcome to Red Handi'}>
  <img className='rh-film-video rh-film-poster' src={poster} alt='' aria-hidden='true'/>
  {src&&!failed&&<video ref={player} className='rh-film-video' src={src} poster={poster} autoPlay={!paused} muted playsInline preload={paused?'none':'auto'} loop={idle} onLoadedData={()=>setReady(true)} onEnded={end} onError={()=>{setFailed(true);setPlayBlocked(false)}} aria-label={order?'Waiter carries the order to the chef':'Waiter approaches your table and welcomes you'}/>}
  <div className='rh-cinema-shade' aria-hidden='true'/>
  <header className='rh-cinema-top'><a href='/' className='rh-cinema-brand'><img src='/logo.png' alt='Red Handi'/><span>REDHANDI<small>GOOD FOOD. GOOD MOOD.</small></span></a><div className='rh-cinema-tools'>{src&&!failed&&<button onClick={()=>ended?replay():setPaused(v=>!v)} aria-pressed={paused}>{ended?'Replay video':paused?'Play video':'Pause video'}</button>}{document.fullscreenEnabled&&<button onClick={full} aria-label='Toggle full screen'>⛶</button>}</div></header>
  <div className='rh-cinema-title'><span className='rh-cinema-eyebrow'>{order?.tableName||tableName||'WELCOME TO REDHANDI'}</span><h1>{order?<>Thank you.<br/><em>Let us cook.</em></>:<>Make yourself<br/><em>at home.</em></>}</h1><p>{order?'Order #'+order.number:'Your favourites. Fresh from the handi.'}</p></div>
  {src&&!ready&&!paused&&!failed&&!playBlocked&&<div className='rh-scene-loading' role='status'><span/>Your host will be right with you…</div>}
  {playBlocked&&!paused&&!failed&&<button className='rh-film-play' onClick={play}>Play video</button>}
  <div className='rh-cinema-bottom'><div className='rh-host-caption' aria-live='polite'><span>{order?'YOUR ORDER IS CONFIRMED':'YOUR REDHANDI HOST'}</span><p>{order?'“Thank you! I’ll take this to the kitchen.”':'“Welcome! What would you like to order?”'}</p><small>Good food is cooking.</small></div><div className='rh-cinema-action'><button className='rh-order-button' disabled={!order&&disabled} onClick={order?bill:onOrder}>{order?'View your bill':loading?'Loading menu…':'Order Now'}<span>→</span></button>{src&&!failed&&(order||ended)?<button className='rh-replay' onClick={replay}>Replay video</button>:<small>Choose your favourites · Pay at the restaurant</small>}</div></div>
 </section>
}
