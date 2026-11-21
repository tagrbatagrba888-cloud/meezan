import {test} from 'node:test';import assert from 'node:assert/strict';import {homeworkEvents} from './homework.mjs';
const start=Date.parse('2026-11-21T10:00:00Z');
const base={homework:{id:'H1',name:'واجب',status:'published',publishedAt:'2026-11-21T10:00:00Z',grade:'G1'},student:{id:'S1',status:'approved',grade:'G1'},submissions:[],now:start+3*86400000};
test('unresolved delay never chooses one or two days',()=>{const e=homeworkEvents(base);assert.deepEqual(e.map(x=>x.type),['homework-published']);});
test('explicit day choices respect exact elapsed time',()=>{
 assert.equal(homeworkEvents({...base,reminderDelayDays:1,now:start+86400000-1}).length,1);
 assert.equal(homeworkEvents({...base,reminderDelayDays:1,now:start+86400000}).length,2);
 assert.equal(homeworkEvents({...base,reminderDelayDays:2,now:start+86400000}).length,1);
 assert.equal(homeworkEvents({...base,reminderDelayDays:2,now:start+2*86400000}).length,2);
});
test('preallocated unsubmitted record does not count as solved',()=>{
 assert.equal(homeworkEvents({...base,reminderDelayDays:1,submissions:[{homeworkId:'H1',userId:'S1',submitted:false,score:0}]}).length,2);
});
test('submitted but uncorrected work suppresses unsolved reminder',()=>{
 assert.equal(homeworkEvents({...base,reminderDelayDays:1,submissions:[{homeworkId:'H1',userId:'S1',submitted:true,corrected:false}]}).length,1);
});
test('different child or assignment submission cannot suppress reminder',()=>{
 assert.equal(homeworkEvents({...base,reminderDelayDays:1,submissions:[{homeworkId:'H2',userId:'S1',submitted:true},{homeworkId:'H1',userId:'S2',submitted:true}]}).length,2);
});
test('draft, baseline, unrelated grade and inactive students do not notify',()=>{
 assert.equal(homeworkEvents({...base,baseline:true}).length,0);
 assert.equal(homeworkEvents({...base,homework:{...base.homework,status:'draft'}}).length,0);
 assert.equal(homeworkEvents({...base,student:{...base.student,grade:'G2'}}).length,0);
 assert.equal(homeworkEvents({...base,student:{...base.student,status:'suspended'}}).length,0);
});
test('draft creation date is not silently used as publication date',()=>{
 assert.throws(()=>homeworkEvents({...base,homework:{...base.homework,publishedAt:undefined,createdAt:base.homework.publishedAt}}));
});
test('event IDs stable across reruns; correction does not make duplicate reminder',()=>{
 const a=homeworkEvents({...base,reminderDelayDays:1});const b=homeworkEvents({...base,reminderDelayDays:2});assert.equal(a[1].key,b[1].key);
});
