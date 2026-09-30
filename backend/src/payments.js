import crypto from 'node:crypto';
import {fail} from './policy.js';
export const paymentsReady=()=>process.env.PAYMENTS_MODE==='razorpay'&&!!process.env.RAZORPAY_KEY_ID&&!!process.env.RAZORPAY_KEY_SECRET;
export const previewEnabled=()=>process.env.NODE_ENV!=='production'&&process.env.PREVIEW_CHECKOUT==='true';
export async function razorpay(path,body,method='POST'){
 if(!paymentsReady())fail(503,'Online payments are not connected yet. Please contact the restaurant.');
 const response=await fetch('https://api.razorpay.com/v1/'+path,{method,headers:{Authorization:'Basic '+Buffer.from(process.env.RAZORPAY_KEY_ID+':'+process.env.RAZORPAY_KEY_SECRET).toString('base64'),'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok){console.error('Razorpay error',response.status,data.error?.code);fail(502,'The payment provider could not complete this request. Please try again.')}return data;
}
export function verifyHmac(body,signature,secret){if(!secret||typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;const expected=crypto.createHmac('sha256',secret).update(body).digest();const actual=Buffer.from(signature,'hex');return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual)}
