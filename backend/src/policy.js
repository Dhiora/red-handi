export class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
export const fail=(status,message)=>{throw new HttpError(status,message)};
export const rupees=value=>Math.round(Number(value)*100);
export function cancellationQuote(order,now=Date.now()){
 const age=order.confirmedAt?now-new Date(order.confirmedAt).getTime():0;
 const free=age<=180000;
 const fee=free?0:Math.min(order.total,Math.round(order.total*order.cancellationPercent/100));
 return {free,fee,refund:order.total-fee,percent:order.cancellationPercent,freeUntil:order.confirmedAt?new Date(new Date(order.confirmedAt).getTime()+180000).toISOString():null};
}
export function getSlots(outlet,now=Date.now()){
 const slots=[];const localNow=new Date(now+330*60000);const date=localNow.toISOString().slice(0,10);
 const [oh,om]=outlet.opening.split(':').map(Number),[ch,cm]=outlet.closing.split(':').map(Number);
 for(let day=0;day<7;day++){
  const midnight=new Date(date+'T00:00:00+05:30').getTime()+day*86400000;
  for(let minute=oh*60+om;minute<ch*60+cm;minute+=15){const t=midnight+minute*60000;if(t>=now+outlet.leadMinutes*60000)slots.push(new Date(t).toISOString())}
 }
 return slots;
}
export function validateSlot(outlet,value,now=Date.now()){
 const t=new Date(value);if(!Number.isFinite(t.getTime())||!getSlots(outlet,now).includes(t.toISOString()))fail(400,'Choose an available pickup or delivery time.');return t;
}
export function canTransition(order,next){
 const allowed={confirmed:['preparing'],preparing:['ready'],ready:order.fulfilment==='delivery'?['out_for_delivery']:['completed'],out_for_delivery:['completed']};
 return allowed[order.status]?.includes(next)||false;
}
