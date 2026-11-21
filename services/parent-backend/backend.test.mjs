import {test,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {services,requireAdmin,ADMIN_UID} from './admin.mjs';
import {issueChannelProof,consumeChannelProof} from './channels.mjs';
import {stageResult,claimDelivery,finishDelivery} from './reports.mjs';
import {deleteApp,getApps} from 'firebase-admin/app';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Emulators required');
const {db}=services();
const project='demo-meezan';
beforeEach(async()=>{
 await fetch('http://'+process.env.FIRESTORE_EMULATOR_HOST+'/emulator/v1/projects/'+project+'/databases/(default)/documents',{method:'DELETE'});
 await db.doc('parents/P1').set({status:'approved',email:'parent@example.invalid',emailVerified:true});
 await db.doc('student_links/S1').set({parents:{P1:{}}});
});
after(async()=>{await db.terminate();for(const app of getApps())await deleteApp(app);});
const input={studentId:'S1',resultId:'exam-1',name:'اختبار تجريبي',studentName:'طالب تجريبي',score:18,totalScore:20,kind:'exam'};
test('admin UID boundary is exact',()=>{assert.throws(()=>requireAdmin({uid:'P1'}));assert.throws(()=>requireAdmin(null));requireAdmin({uid:ADMIN_UID});});
test('PAR code cannot link a channel',async()=>{await assert.rejects(consumeChannelProof(db,{token:'PAR-123456',channel:'telegram',destination:'111'}));});
test('short-lived proof links only a private channel once',async()=>{
 const p=await issueChannelProof(db,'P1','telegram',1000);
 await assert.rejects(consumeChannelProof(db,{token:p.token,channel:'telegram',destination:'111',privateChat:false},2000));
 await assert.rejects(consumeChannelProof(db,{token:p.token,channel:'whatsapp',destination:'201000000001'},2000));
 await consumeChannelProof(db,{token:p.token,channel:'telegram',destination:'111'},2000);
 await assert.rejects(consumeChannelProof(db,{token:p.token,channel:'telegram',destination:'222'},2000));
 assert.equal((await db.doc('parent_channels/P1').get()).data().telegram.destination,'111');
});
test('expired proof denied',async()=>{const p=await issueChannelProof(db,'P1','telegram',1000);await assert.rejects(consumeChannelProof(db,{token:p.token,channel:'telegram',destination:'111'},700000));});
test('baseline creates results without notifications or sends',async()=>{
 const r=await stageResult(db,input,true);assert.equal(r.jobs,0);
 assert.equal((await db.collection('parent_delivery_jobs').get()).size,0);
 assert.equal((await db.collection('notifications').get()).size,0);
 assert.equal((await db.doc('student_results/S1').get()).data().items[0].score,18);
});
test('events dedupe, channels need proof, private notices only',async()=>{
 const r=await stageResult(db,input);assert.equal(r.jobs,1);
 const dup=await stageResult(db,input);assert.equal(dup.duplicate,true);
 assert.equal((await db.collection('parent_student_notifications/P1/students/S1/items').get()).size,1);
 assert.equal((await db.collection('notifications').get()).size,0);
 assert.equal((await db.collection('parent_delivery_jobs').get()).size,1);
});
test('unlink cancels queued delivery',async()=>{
 await stageResult(db,input);const snap=await db.collection('parent_delivery_jobs').get();
 await db.doc('student_links/S1').set({parents:{}});
 assert.equal(await claimDelivery(db,snap.docs[0].id),null);
 assert.equal((await snap.docs[0].ref.get()).data().status,'cancelled');
});
test('delivery claimed once, ambiguous result not retried',async()=>{
 await stageResult(db,input);const j=(await db.collection('parent_delivery_jobs').get()).docs[0];
 assert.ok(await claimDelivery(db,j.id));assert.equal(await claimDelivery(db,j.id),null);
 await finishDelivery(db,j.id,{error:'unknown transport outcome'});
 assert.equal((await j.ref.get()).data().status,'needs-review');
});
test('safe failure can retry without duplicate jobs',async()=>{
 await stageResult(db,input);const j=(await db.collection('parent_delivery_jobs').get()).docs[0];
 await claimDelivery(db,j.id,1000);await finishDelivery(db,j.id,{retryable:true,error:'provider rejected before acceptance'},1000);
 assert.equal(await claimDelivery(db,j.id,2000),null);assert.ok(await claimDelivery(db,j.id,200000));
 await finishDelivery(db,j.id,{sent:true,providerMessageId:'test-only'});
 assert.equal((await j.ref.get()).data().status,'sent');
});
test('unverified email does not create delivery',async()=>{
 await db.doc('parents/P1').update({emailVerified:false});assert.equal((await stageResult(db,input)).jobs,0);
});
