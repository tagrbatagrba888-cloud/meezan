import {test,beforeEach,after} from 'node:test';import assert from 'node:assert/strict';
import {services,ADMIN_UID} from './admin.mjs';import {getApps,deleteApp} from 'firebase-admin/app';
import {makeVerifier,verifyPassword,issueIndependentLoginProof,samePasswordLogin,validateLegacySession,userKey} from './legacy-session.mjs';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Emulators required');
const {db}=services();let minted=0;const auth={createCustomToken:async(uid,claims)=>{minted++;assert.equal(uid,'SYNTHETIC1');assert.equal(claims.legacyStepUp,true);return 'synthetic-custom-token-not-a-real-secret';}};
const input={username:'studentfixture',role:'student',password:'x'};
beforeEach(async()=>{
 await fetch('http://'+process.env.FIRESTORE_EMULATOR_HOST+'/emulator/v1/projects/demo-meezan/databases/(default)/documents',{method:'DELETE'});
 minted=0;await db.doc('auth_identities/SYNTHETIC1').set({role:'student',status:'approved',studentId:'S1'});
 await db.doc('login_names/'+userKey('student','studentfixture')).set({authUid:'SYNTHETIC1'});
 await db.doc('auth_credentials/SYNTHETIC1').set(await makeVerifier(input.password));
});
after(async()=>{await db.terminate();for(const a of getApps())await deleteApp(a);});
const proof=()=>issueIndependentLoginProof(db,{reviewerUid:ADMIN_UID,authUid:'SYNTHETIC1',method:'in-person-known-student',evidenceReference:'synthetic-review/1'},1000);
test('same unchanged short password can be server-hashed without Firebase password reset',async()=>{const v=await makeVerifier('x');assert.equal(await verifyPassword('x',v),true);assert.equal(await verifyPassword('y',v),false);assert.ok(!JSON.stringify(v).includes('"x"'));});
test('known old password alone never authenticates',async()=>{await assert.rejects(samePasswordLogin({db,auth},{...input,proof:''},2000));assert.equal(minted,0);});
test('independent proof + original password authenticates only once',async()=>{
 const p=await proof();const r=await samePasswordLogin({db,auth},{...input,proof:p.token},2000);assert.ok(r.customToken);
 await assert.rejects(samePasswordLogin({db,auth},{...input,proof:p.token},2001));assert.equal(minted,1);
});
test('wrong password or expired proof cannot authenticate',async()=>{
 const p=await proof();await assert.rejects(samePasswordLogin({db,auth},{...input,password:'wrong',proof:p.token},2000));
 await assert.rejects(samePasswordLogin({db,auth},{...input,proof:p.token},400000));assert.equal(minted,0);
});
test('role, account suspension and independent-review requirements enforced',async()=>{
 await assert.rejects(issueIndependentLoginProof(db,{reviewerUid:'P1',authUid:'SYNTHETIC1',method:'in-person-known-student',evidenceReference:'x'}));
 const p=await proof();await db.doc('auth_identities/SYNTHETIC1').update({status:'suspended'});
 await assert.rejects(samePasswordLogin({db,auth},{...input,proof:p.token},2000));assert.equal(minted,0);
});
test('step-up sessions cannot refresh indefinitely without renewed independent verification',()=>{
 validateLegacySession({legacyStepUp:true,stepUpAt:1000},1000001);
 assert.throws(()=>validateLegacySession({legacyStepUp:true,stepUpAt:1000},44200000));
 assert.throws(()=>validateLegacySession({legacyStepUp:true},1000001));
});
