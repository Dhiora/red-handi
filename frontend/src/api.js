export async function api(path,{method='GET',body,token,...options}={}){
 const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-RH-Request':'1',...(token?{'X-Order-Token':token}:{})},...(body?{body:JSON.stringify(body)}:{}),...options});
 let data;try{data=await response.json()}catch{throw new Error('The kitchen connection is unavailable. Please try again.')}
 if(!response.ok)throw Object.assign(new Error(data.error||'Something went wrong.'),{status:response.status});return data;
}
export const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:Number(n)%100?2:0}).format((Number(n)||0)/100);
export const formatTime=t=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit'}).format(new Date(t));
export const formatDate=t=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',weekday:'short'}).format(new Date(t));
export const localDate=t=>new Date(new Date(t).getTime()+330*60000).toISOString().slice(0,10);
export function saveOrder(order,token){try{const old=JSON.parse(localStorage.getItem('rh-orders')||'[]');localStorage.setItem('rh-orders',JSON.stringify([{id:order._id,number:order.number,token},...old.filter(o=>o.id!==order._id)].slice(0,20)))}catch{}}
export function recentOrders(){try{return JSON.parse(localStorage.getItem('rh-orders')||'[]')}catch{return []}}
export async function loadRazorpay(){if(window.Razorpay)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=resolve;s.onerror=()=>reject(new Error('Could not load secure checkout. Please check your connection.'));document.head.appendChild(s)})}
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function printBill(order,outlet){
 const rows=order.items.map(i=>`<tr><td>${escapeHtml(i.name)}</td><td class='num'>${i.quantity}</td><td class='num'>${money(i.unitPrice)}</td><td class='num'>${money(i.unitPrice*i.quantity)}</td></tr>`).join('');
 const paymentLine=order.preview?'Preview order · not charged':order.paymentStatus==='paid'?(order.paymentId==='walkin_cash'||order.paymentId==='restaurant_cash'?'Paid at restaurant':'Paid online'):'Payment due at restaurant';
 const html=`<!doctype html><html><head><meta charset="utf-8"><title>Bill ${escapeHtml(order.number)}</title><style>
  *{box-sizing:border-box}body{font-family:'Courier New',monospace;color:#111;margin:0;padding:16px;width:320px}
  .center{text-align:center}.logo{width:56px;height:56px;object-fit:contain;margin:0 auto 6px}
  h1{font-size:18px;margin:0 0 2px;letter-spacing:1px}.muted{font-size:11px;color:#444;margin:1px 0}
  hr{border:none;border-top:1px dashed #999;margin:10px 0}
  table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;font-size:11px;border-bottom:1px dashed #999;padding-bottom:4px}
  td{padding:3px 0;vertical-align:top}.num{text-align:right}
  .totals div{display:flex;justify-content:space-between;font-size:12px;margin:2px 0}
  .grand{font-size:14px;font-weight:bold;border-top:1px dashed #999;margin-top:6px;padding-top:6px}
  .thanks{text-align:center;font-size:12px;margin-top:14px}
  @media print{body{width:auto}}
 </style></head><body>
  <div class="center"><img class="logo" src="/logo.png" alt="RedHandi"/><h1>REDHANDI</h1>
  <p class="muted">${escapeHtml(outlet?.name||'')}</p>
  <p class="muted">${escapeHtml(outlet?.address||'')}</p>
  ${outlet?.phone?`<p class="muted">${escapeHtml(outlet.phone)}</p>`:''}</div>
  <hr/>
  <p class="muted">Order <strong>${escapeHtml(order.number)}</strong></p>
  <p class="muted">${escapeHtml(formatDate(order.scheduledAt))} · ${escapeHtml(formatTime(order.scheduledAt))}</p>
  <p class="muted">${escapeHtml(order.tableName|| (order.fulfilment==='pickup'?'Pickup':'Delivery'))} · ${escapeHtml(order.name)} · ${escapeHtml(order.mobile)}</p>
  ${order.fulfilment==='delivery'?`<p class="muted">${escapeHtml(order.address)} ${escapeHtml(order.area)}</p>`:''}
  <hr/>
  <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amt</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals">
   <div><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
   ${order.deliveryFee>0?`<div><span>Delivery fee</span><span>${money(order.deliveryFee)}</span></div>`:''}
   <div class="grand"><span>Total</span><span>${money(order.total)}</span></div>
  </div>
  <p class="muted center">${escapeHtml(paymentLine)}</p>
  <p class="thanks">Thank you for ordering with RedHandi!</p>
  <script>window.onload=function(){window.print()}</script>
 </body></html>`;
 const w=window.open('','_blank','width=380,height=640');
 if(!w){throw new Error('Please allow pop-ups to print the bill.')}
 w.document.open();w.document.write(html);w.document.close();
}
