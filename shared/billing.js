// All amounts are integer paise. Menu prices are inclusive or exclusive as configured.
export function calculateBill(subtotal,deliveryFee=0,settings={}){
 const rate=settings.gstEnabled?Number(settings.gstRate)||0:0;
 const included=!!settings.pricesIncludeGst;
 const tax=rate?Math.round(included?subtotal*rate/(100+rate):subtotal*rate/100):0;
 return {subtotal,deliveryFee,taxableAmount:included?subtotal-tax:subtotal,tax,cgst:Math.floor(tax/2),sgst:tax-Math.floor(tax/2),total:subtotal+deliveryFee+(included?0:tax),gstRate:rate,pricesIncludeGst:included,gstEnabled:!!settings.gstEnabled};
}
export function billingSnapshot(outlet,subtotal,deliveryFee=0){
 return {...calculateBill(subtotal,deliveryFee,outlet),name:outlet.name,address:outlet.address,phone:outlet.phone,gstin:outlet.gstEnabled?outlet.gstin:''};
}
