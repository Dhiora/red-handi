// Ingredient costs are integer paise per unit (1 kg, 1 litre, or 1 piece).
export function ingredientPlan(item){
 const available=Math.max(0,Math.round(((Number(item?.stock)||0)-(Number(item?.reserved)||0))*1e6)/1e6);
 const cost=Math.max(0,Math.round(Number(item?.cost)||0));
 const lowAt=Number(item?.lowAt)||0;
 const refillTo=Number(item?.refillTo)||0;
 const low=available<=lowAt+1e-8;
 const buy=low&&refillTo>available+1e-8?Math.round((refillTo-available)*1e6)/1e6:0;
 return {available,cost,lowAt,refillTo,low,buy,fund:Math.round(buy*cost),onHandValue:Math.round(available*cost)};
}
export function restockFund(items){
 const plans=(items||[]).map(item=>({item,...ingredientPlan(item)}));
 return {plans,onHandValue:plans.reduce((n,p)=>n+p.onHandValue,0),fund:plans.reduce((n,p)=>n+p.fund,0)};
}
