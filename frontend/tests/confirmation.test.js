import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldCelebrateOrder} from '../src/components/feedback/confirmation.js';
const order={_id:'order-1',status:'confirmed',paymentStatus:'paid',confirmedAt:'2026-09-30T10:00:00Z'};
const input={order,routeId:'order-1',requested:true,seen:false};
test('new server-confirmed orders celebrate, including explicit preview orders',()=>{assert.equal(shouldCelebrateOrder(input),true);assert.equal(shouldCelebrateOrder({...input,order:{...order,preview:true}}),true)});
test('a pending payment or checkout navigation cannot claim success',()=>{for(const status of ['pending_payment','cancelled','expired','completed'])assert.equal(shouldCelebrateOrder({...input,order:{...order,status}}),false);assert.equal(shouldCelebrateOrder({...input,order:{...order,paymentStatus:'pending'}}),false);assert.equal(shouldCelebrateOrder({...input,order:{...order,confirmedAt:null}}),false)});
test('delayed payment confirmation celebrates when polling observes the transition',()=>{assert.equal(shouldCelebrateOrder({...input,requested:false,previousStatus:'pending_payment'}),true)});
test('refreshing old orders, repeat polling and a stale order from another route do not celebrate',()=>{assert.equal(shouldCelebrateOrder({...input,requested:false}),false);assert.equal(shouldCelebrateOrder({...input,seen:true}),false);assert.equal(shouldCelebrateOrder({...input,routeId:'order-2'}),false)});
