/** Return an unattended confirmation screen to welcome, with printable-bill support. */
export function startReceiptIdleTimer({onExpire,onTick,target=window,delayMs=10000}){
 let deadline=0,timeout,interval,stopped=false,printing=false;
 const events=['pointerdown','keydown','scroll'];
 function clear(){clearTimeout(timeout);clearInterval(interval)}
 function tick(){onTick(Math.max(0,Math.ceil((deadline-Date.now())/1000)))}
 function expire(){if(stopped)return;stop();onTick(0);onExpire()}
 function reset(){if(stopped||printing)return;clear();deadline=Date.now()+delayMs;tick();timeout=setTimeout(expire,delayMs);interval=setInterval(tick,250)}
 function beforePrint(){printing=true;clear()}
 function afterPrint(){printing=false;reset()}
 function stop(){stopped=true;clear();for(const event of events)target.removeEventListener(event,reset,true);target.removeEventListener('beforeprint',beforePrint);target.removeEventListener('afterprint',afterPrint)}
 for(const event of events)target.addEventListener(event,reset,{capture:true,passive:true});
 target.addEventListener('beforeprint',beforePrint);target.addEventListener('afterprint',afterPrint);
 reset();return stop;
}
