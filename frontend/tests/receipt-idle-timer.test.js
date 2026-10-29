import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startReceiptIdleTimer} from '../src/receiptIdleTimer.js';
function setup(t){
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date']});
 const target=new EventTarget();let expired=0,seconds;
 const stop=startReceiptIdleTimer({target,onExpire:()=>expired++,onTick:n=>seconds=n});
 return {target,stop,get expired(){return expired},get seconds(){return seconds}};
}
test('an unattended receipt returns after exactly ten seconds, once',t=>{
 const state=setup(t);assert.equal(state.seconds,10);
 t.mock.timers.tick(9000);assert.equal(state.expired,0);assert.equal(state.seconds,1);
 t.mock.timers.tick(1000);assert.equal(state.expired,1);assert.equal(state.seconds,0);
 t.mock.timers.tick(10000);assert.equal(state.expired,1);
});
test('receipt interaction restarts the full countdown',t=>{
 const state=setup(t);t.mock.timers.tick(9000);state.target.dispatchEvent(new Event('pointerdown'));
 assert.equal(state.seconds,10);t.mock.timers.tick(9000);assert.equal(state.expired,0);
 t.mock.timers.tick(1000);assert.equal(state.expired,1);
});
test('leaving the receipt cancels the timer and removes activity listeners',t=>{
 const state=setup(t);state.stop();state.target.dispatchEvent(new Event('keydown'));
 t.mock.timers.tick(30000);assert.equal(state.expired,0);
});
test('printing suspends expiry and restarts the countdown afterwards',t=>{
 const state=setup(t);t.mock.timers.tick(9000);state.target.dispatchEvent(new Event('beforeprint'));
 t.mock.timers.tick(30000);assert.equal(state.expired,0);
 state.target.dispatchEvent(new Event('afterprint'));assert.equal(state.seconds,10);
 t.mock.timers.tick(10000);assert.equal(state.expired,1);
});
