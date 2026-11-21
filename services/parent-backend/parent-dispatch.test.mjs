import {test,beforeEach,after} from 'node:test';import assert from 'node:assert/strict';import {services} from './admin.mjs';import {getApps,deleteApp} from 'firebase-admin/app';import {stageResult,confirmParentDelivery} from './reports.mjs';import {dispatchParentEmails} from './parent-dispatch.mjs';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Emulators required');const {db}=services();
beforeEach(async()=>{await fetch('http://'+process.env.FIRESTORE_EMULATOR_HOST+'/emulator/v1/projects/demo-meezan/databases/(default)/documents',{method:'DELETE'});await db.doc('parents/P1').set({status:'approved',emailVerified:true,email:'fake@example.invalid'});await db.doc('student_links/S1').set({parents:{P1:{}}});await db.doc('parent_report_settings/global').set({schemaVersion:1,enabled:true,types:{exam_result:true},channels:{email:true}});await db.doc('users/all').set({items:[{id:'S1'}]});await db.doc('exam_subs/all').set({items:[{userId:'S1',examId:'R1',corrected:true,score:1,totalScore:2}]});await stageResult(db,{studentId:'S1',resultId:'exam-R1',revision:'1/2',kind:'exam',name:'Synthetic',score:1,totalScore:2});});
after(async()=>{await db.terminate();for(const a of getApps())await deleteApp(a);});
const row=async()=>(await db.collection('parent_delivery_jobs').get()).docs[0];
test('default disabled and settings revocation block network calls',async()=>{let calls=0;const send=async()=>{calls++;};await dispatchParentEmails(db,{send});await db.doc('parent_report_settings/global').update({enabled:false});await dispatchParentEmails(db,{enabled:true,send});assert.equal(calls,0);});
test('parallel drains claim once, accepted is not delivered',async()=>{let calls=0;const options={enabled:true,send:async()=>{calls++;return {sent:true,providerMessageId:'fake-receipt'};}};await Promise.all([dispatchParentEmails(db,options),dispatchParentEmails(db,options)]);assert.equal(calls,1);const r=await row();assert.equal((await r.ref.get()).data().status,'accepted');await assert.rejects(confirmParentDelivery(db,r.id,{providerMessageId:'fake-receipt',delivered:true}));await confirmParentDelivery(db,r.id,{providerMessageId:'fake-receipt',verifiedReceipt:true,destination:'fake@example.invalid',delivered:true});assert.equal((await r.ref.get()).data().status,'delivered');});
test('unknown outcome held and never retried',async()=>{let calls=0;const options={enabled:true,send:async()=>{calls++;throw Error('fake timeout');}};await dispatchParentEmails(db,options);await dispatchParentEmails(db,options);assert.equal(calls,1);assert.equal((await (await row()).ref.get()).data().status,'held_unknown');});
test('unlinked parent is canceled before transport',async()=>{await db.doc('student_links/S1').set({parents:{}});await dispatchParentEmails(db,{enabled:true,send:async()=>{throw Error('must not call');}});assert.equal((await (await row()).ref.get()).data().status,'cancelled');});
test('abandoned sending claim is held without network',async()=>{await (await row()).ref.update({status:'sending',claimedAt:1});await dispatchParentEmails(db,{enabled:true,now:1000001,send:async()=>{throw Error('must not call');}});assert.equal((await (await row()).ref.get()).data().status,'held_unknown');});
test('a fresh activation cancels prior queued backlog',async()=>{await db.doc('parent_report_settings/global').update({enabledAt:Date.now()+1000});let calls=0;await dispatchParentEmails(db,{enabled:true,send:async()=>{calls++;}});assert.equal(calls,0);assert.equal((await (await row()).ref.get()).data().status,'cancelled');});

test('changed current result cancels a stale queued report',async()=>{await db.doc('exam_subs/all').set({items:[{userId:'S1',examId:'R1',corrected:true,score:2,totalScore:2}]});let n=0;await dispatchParentEmails(db,{enabled:true,send:async()=>{n++;}});assert.equal(n,0);assert.equal((await (await row()).ref.get()).data().status,'cancelled');});
test('submitted uncorrected work cancels an already queued unsolved reminder',async()=>{
 const {stageHomeworkNotice,homeworkEvents}=await import('./homework.mjs');
 const publishedAt=1000,now=publishedAt+172800000;
 await db.doc('parent_report_settings/global').update({'types.homework_unsolved':true});
 await db.doc('homeworks/all').set({items:[{id:'H1',name:'Fixture',status:'published'}]});
 await db.doc('parent_homework_state/H1').set({observedAt:publishedAt,baselineExisting:false});
 await db.doc('homework_subs/all').set({items:[]});
 const event=homeworkEvents({homework:{id:'H1',status:'published',publishedAt:new Date(publishedAt).toISOString()},student:{id:'S1',status:'approved'},submissions:[],now})[1];
 await stageHomeworkNotice(db,event,{enabled:true,channels:{email:true}});
 await db.doc('homework_subs/all').set({items:[{userId:'S1',homeworkId:'H1',submitted:true,corrected:false}]});
 let reminder=0;await dispatchParentEmails(db,{enabled:true,now,send:async job=>{if(job.reportType==='homework_unsolved')reminder++;return {sent:true,providerMessageId:'fake'};}});
 assert.equal(reminder,0);
 const rows=(await db.collection('parent_delivery_jobs').get()).docs.map(x=>x.data());assert.equal(rows.find(x=>x.reportType==='homework_unsolved').status,'cancelled');
});

test('empty enabled dispatch replaces stage-only status reason',async()=>{await (await row()).ref.delete();const result=await dispatchParentEmails(db,{enabled:true,send:async()=>{throw Error('not called');}});assert.equal(result.reason,'no_eligible_pending_jobs');assert.equal(result.processed,0);});
