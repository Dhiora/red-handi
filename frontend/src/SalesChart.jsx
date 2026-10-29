import {useId,useState} from 'react';
import {money} from './api';
export default function SalesChart({rows,onSelect}){
 const id=useId().replaceAll(':',''),[active,setActive]=useState(null);
 const points=[...rows].reverse(),max=Math.max(100,...points.map(r=>r.sales)),w=900,h=240,pad=48;
 const xy=(r,i)=>[pad+i*(w-pad*2)/Math.max(1,points.length-1),h-pad-(r.sales/max)*(h-pad*2)];
 const path=points.map((r,i)=>{const[x,y]=xy(r,i);return `${i?'L':'M'}${x},${y}`}).join(' ');
 const selected=points[active]||points.at(-1);
 return <section className='panel sales-chart'><div className='panel-heading'><div><span className='eyebrow'>SALES TREND</span><h2>{points[0]?.key.length===7?'Monthly sales.':'Daily sales.'}</h2><p>Paid orders less refunds · Select a point for details.</p></div>{selected&&<div className='chart-summary'><strong>{money(selected.sales)}</strong><small>{selected.key} · {selected.orders} orders</small></div>}</div>
 <svg viewBox={`0 0 ${w} ${h}`} role='group' aria-label='Sales trend. Each point shows collections for orders placed in that period.'>
 <defs><linearGradient id={id} x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stopColor='#b9261d' stopOpacity='.22'/><stop offset='100%' stopColor='#b9261d' stopOpacity='0'/></linearGradient></defs>
 {[0,.5,1].map(v=><g key={v}><line x1={pad} x2={w-pad} y1={h-pad-v*(h-pad*2)} y2={h-pad-v*(h-pad*2)} stroke='#e5ddd0' strokeDasharray='4 5'/><text x='0' y={h-pad-v*(h-pad*2)+4} fill='#82776b' fontSize='12'>{new Intl.NumberFormat('en-IN',{notation:'compact',maximumFractionDigits:1}).format(max*v/100)}</text></g>)}
 {points.length>0&&<><path d={`${path} L${xy(points.at(-1),points.length-1)[0]},${h-pad} L${pad},${h-pad} Z`} fill={`url(#${id})`}/><path d={path} fill='none' stroke='#b9261d' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'/></>}
 {points.map((r,i)=>{const[x,y]=xy(r,i);return <g key={r.key}><circle cx={x} cy={y} r={active===i?7:4} fill='#b9261d'/><circle cx={x} cy={y} r='14' fill='transparent' role='button' tabIndex='0' aria-label={`${r.key}: ${money(r.sales)}, ${r.orders} orders; open details`} onFocus={()=>setActive(i)} onMouseEnter={()=>setActive(i)} onClick={()=>onSelect(r.key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(r.key)}}}/>{(points.length<=7||i%7===0||i===points.length-1)&&<text x={x} y={h-12} textAnchor='middle' fill='#82776b' fontSize='12'>{r.key.length===7?new Intl.DateTimeFormat('en-IN',{month:'short',timeZone:'UTC'}).format(new Date(r.key+'-01T00:00:00Z')):r.key.slice(5)}</text>}</g>})}
 </svg><p className='muted-note'>Amounts in ₹. Zero-sales days are included. Figures are grouped by order date in IST.</p></section>;
}
