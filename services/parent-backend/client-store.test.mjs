import {test,before,after} from 'node:test';import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator} from 'firebase/firestore';import {services,ADMIN_UID} from './admin.mjs';import {getApps as adminApps,deleteApp as deleteAdminApp} from 'firebase-admin/app';
import {clientStore} from './client-store.mjs';import {projectLegacyData} from './worker.mjs';import {readFileSync} from 'node:fs';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Emulators required');
const {auth:adminAuth,db:adminDb}=services();let app,store;
before(async()=>{
 const fsHost='http://'+process.env.FIRESTORE_EMULATOR_HOST;
 await fetch(fsHost+'/emulator/v1/projects/demo-meezan/databases/(default)/documents',{method:'DELETE'});
 await fetch(fsHost+'/emulator/v1/projects/demo-meezan:securityRules',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{content:readFileSync(new URL('../../firestore.parent-only.rules',import.meta.url),'utf8')}]}})});
 const email='client-worker@example.test',password='Synthetic-client-only-824!';
 try{await adminAuth.createUser({uid:ADMIN_UID,email,password,emailVerified:true});}catch(e){if(e.code!=='auth/uid-already-exists')throw e;await adminAuth.updateUser(ADMIN_UID,{email,password,emailVerified:true});}
 app=initializeApp({apiKey:'demo-key',projectId:'demo-meezan',authDomain:'demo-meezan.firebaseapp.com'},'synthetic-client-worker');const auth=getAuth(app),db=getFirestore(app);const [h,p]=process.env.FIRESTORE_EMULATOR_HOST.split(':');connectFirestoreEmulator(db,h,Number(p));connectAuthEmulator(auth,'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,{disableWarnings:true});
 await signInWithEmailAndPassword(auth,email,password);store=clientStore(db);
 await adminDb.doc('parent_report_settings/global').set({schemaVersion:1,enabled:true,types:{exam_result:true,homework_result:true,homework_published:true,homework_unsolved:true},channels:{inSite:true,email:true,telegram:false,whatsapp:false}});
 await adminDb.doc('users/all').set({items:[{id:'S1',code:'USR-123456',grade:'G1'}]});
 await adminDb.doc('student_links/S1').set({parents:{P1:{}}});await adminDb.doc('parents/P1').set({status:'approved',email:'fixture@example.invalid',emailVerified:true});
 await adminDb.doc('exam_subs/all').set({items:[{userId:'S1',examId:'E1',examName:'Fixture',corrected:true,score:8,totalScore:10}]});
 await adminDb.doc('homework_subs/all').set({items:[]});await adminDb.doc('homeworks/all').set({items:[]});
});
after(async()=>{await deleteApp(app);await adminDb.terminate();for(const a of adminApps())await deleteAdminApp(a);});
test('existing authenticated admin can stage without service-account bypass or sends',async()=>{
 const baseline=await projectLegacyData(store,{now:1000});assert.equal(baseline.baseline,true);
 assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,0);
 assert.equal((await adminDb.doc('student_results/S1').get()).data().items[0].score,8);
 await adminDb.doc('exam_subs/all').set({items:[{userId:'S1',examId:'E2',examName:'New fixture',corrected:true,score:9,totalScore:10}]});
 const next=await projectLegacyData(store,{now:2000});assert.equal(next.baseline,false);assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,1);
 await projectLegacyData(store,{now:3000});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,1);
});
test('future publication notices and two-day unsolved reminder use first-observed publication',async()=>{
 await adminDb.doc('homeworks/all').set({items:[{id:'H1',name:'New homework fixture',status:'published',grade:'G1',createdAt:'2020-01-01T00:00:00Z'}]});
 await projectLegacyData(store,{now:100000});
 const initial=(await adminDb.collection('parent_student_notifications/P1/students/S1/items').get()).docs.map(d=>d.data()).filter(d=>d.type?.startsWith('homework'));
 assert.equal(initial.length,1);
 await projectLegacyData(store,{now:100000+86400000});
 assert.equal((await adminDb.collection('parent_student_notifications/P1/students/S1/items').get()).docs.map(d=>d.data()).filter(d=>d.type?.startsWith('homework')).length,1);
 await projectLegacyData(store,{now:100000+2*86400000});
 assert.equal((await adminDb.collection('parent_student_notifications/P1/students/S1/items').get()).docs.map(d=>d.data()).filter(d=>d.type?.startsWith('homework')).length,2);
});

test('settings pause and channel/type gates are effective without backfilling disabled results',async()=>{
 await adminDb.doc('parent_report_settings/global').update({enabled:false});
 await adminDb.doc('exam_subs/all').set({items:[{userId:'S1',examId:'E3',corrected:true,score:7,totalScore:10}]});
 const before=(await adminDb.collection('parent_delivery_jobs').get()).size;
 await projectLegacyData(store,{now:200000000});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,before);
 await adminDb.doc('parent_report_settings/global').update({enabled:true,'types.exam_result':false});
 await projectLegacyData(store,{now:200000001});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,before);
 await adminDb.doc('exam_subs/all').set({items:[{userId:'S1',examId:'E4',corrected:true,score:6,totalScore:10}]});
 await projectLegacyData(store,{now:200000002});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,before);
 await adminDb.doc('parent_report_settings/global').update({'types.exam_result':true,'channels.email':false});
 await projectLegacyData(store,{now:200000003});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,before);
 await adminDb.doc('exam_subs/all').set({items:[{userId:'S1',examId:'E5',corrected:true,score:5,totalScore:10}]});
 await projectLegacyData(store,{now:200000004});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,before);
 assert.ok((await adminDb.collection('parent_student_notifications/P1/students/S1/items').get()).docs.some(d=>d.data().body===': 5/10'));
});
test('settings activation first observation suppresses old unseen events',async()=>{
 const before=(await adminDb.collection('parent_delivery_jobs').get()).size;
 await adminDb.doc('parent_report_settings/global').update({enabled:true,enabledAt:999999999,'channels.email':true});
 await adminDb.doc('exam_subs/all').set({items:[{userId:'S1',examId:'E-old-before-activation',corrected:true,score:4,totalScore:10}]});
 await projectLegacyData(store,{now:999999999});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,before);
 await projectLegacyData(store,{now:1000000000});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,before);
 await adminDb.doc('exam_subs/all').set({items:[{userId:'S1',examId:'E-after-activation',corrected:true,score:3,totalScore:10}]});
 await projectLegacyData(store,{now:1000000001});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,before+1);
});
test('resaving same enabled scope/cutover does not skip new corrections',async()=>{
 const before=(await adminDb.collection('parent_delivery_jobs').get()).size;
 await adminDb.doc('parent_report_settings/global').update({enabledAt:1000000002});
 await adminDb.doc('exam_subs/all').set({items:[{userId:'S1',examId:'E-resave-no-scope-change',corrected:true,score:2,totalScore:10}]});
 await projectLegacyData(store,{now:1000000003});assert.equal((await adminDb.collection('parent_delivery_jobs').get()).size,before+1);
});
