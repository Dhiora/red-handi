import {test} from 'node:test';
import assert from 'node:assert/strict';
import {printBill,printKitchenTicket} from '../src/api.js';
const order={number:'TEST-1',createdAt:'2026-10-07T06:30:00Z',scheduledAt:'2026-10-07T06:30:00Z',name:'Test <guest>',mobile:'',source:'walkin',fulfilment:'pickup',status:'confirmed',paymentStatus:'paid',paymentMethod:'upi',subtotal:10000,total:10500,deliveryFee:0,items:[{name:'Biryani <special>',quantity:1,unitPrice:10000}],billing:{name:'Original kitchen',address:'Original address',gstEnabled:true,gstin:'36ABCDE1234F1Z5',gstRate:5,taxableAmount:10000,cgst:250,sgst:250}};
test('printed bills use stored seller/tax details and escape customer input',()=>{
 let html='';const w={document:{open(){},write(value){html=value},close(){}}};printBill(order,{name:'Renamed kitchen'},w);
 assert.match(html,/Original kitchen/);assert.doesNotMatch(html,/Renamed kitchen/);assert.match(html,/CGST 2.5%/);assert.match(html,/SGST 2.5%/);assert.match(html,/UPI/);assert.match(html,/Biryani &lt;special&gt;/);assert.doesNotMatch(html,/Test <guest>/);
});
test('kitchen tickets contain food and table details without customer phone or bill amounts',()=>{
 let html='';globalThis.window={open:()=>({document:{open(){},write(value){html=value},close(){}}})};
 try{printKitchenTicket({...order,tableName:'Table 4',mobile:'9000000000'},{});assert.match(html,/Table 4/);assert.match(html,/Biryani &lt;special&gt;/);assert.doesNotMatch(html,/9000000000|GSTIN|10500/)}finally{delete globalThis.window}
});
