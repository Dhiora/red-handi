import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateBill,billingSnapshot} from '../../shared/billing.js';
import {reportRange} from '../src/business.js';
import {validateProductionEnvironment} from '../src/readiness.js';
test('GST is off by default and tax is never added silently',()=>{assert.equal(calculateBill(24900,3000).total,27900);assert.equal(calculateBill(24900,0,{gstEnabled:false,gstRate:5}).tax,0)});
test('exclusive and inclusive prices agree with the final billed paise',()=>{
 const exclusive=calculateBill(24900,3000,{gstEnabled:true,gstRate:5});assert.equal(exclusive.total,29145);assert.equal(exclusive.tax,1245);assert.equal(exclusive.cgst+exclusive.sgst,1245);
 const inclusive=calculateBill(24900,0,{gstEnabled:true,gstRate:5,pricesIncludeGst:true});assert.equal(inclusive.total,24900);assert.equal(inclusive.taxableAmount+inclusive.cgst+inclusive.sgst,24900);
});
test('seller and tax snapshots do not change with later settings',()=>{const outlet={name:'Kitchen',gstin:'36ABCDE1234F1Z5',gstEnabled:true,gstRate:5};const bill=billingSnapshot(outlet,10000);outlet.gstRate=18;outlet.name='New name';assert.equal(bill.gstRate,5);assert.equal(bill.name,'Kitchen');assert.equal(bill.total,10500)});
test('rolling windows are thirty IST days or six calendar months through today',()=>{
 const now=new Date('2026-01-15T12:00:00Z'),month=reportRange('', 'month',now),six=reportRange('','sixmonths',now);
 assert.equal(month.startDay,'2025-12-17');assert.equal(month.endDay,'2026-01-16');assert.equal(six.startDay,'2025-08-01');assert.equal(six.endDay,'2026-01-16');assert.throws(()=>reportRange('','invalid',now));
});
test('production configuration fails closed without HTTPS, database or payment webhook',()=>{
 const env={NODE_ENV:'production',MONGODB_URI:'mongodb://example',APP_ORIGIN:'https://food.example'};
 assert.doesNotThrow(()=>validateProductionEnvironment(env));assert.throws(()=>validateProductionEnvironment({...env,APP_ORIGIN:'http://food.example'}));assert.throws(()=>validateProductionEnvironment({...env,MONGODB_URI:''}));assert.throws(()=>validateProductionEnvironment({...env,PAYMENTS_MODE:'razorpay'}));assert.throws(()=>validateProductionEnvironment({...env,TRUST_PROXY_HOPS:'true'}));
});
