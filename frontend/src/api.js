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
