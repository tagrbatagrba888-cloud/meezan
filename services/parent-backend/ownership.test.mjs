import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestOwnership,reviewOwnership,prepareBinding} from './ownership.mjs';
import {ADMIN_UID} from './admin.mjs';
const req=()=>requestOwnership({appUserId:'S1',role:'student'},1000);
const review=r=>reviewOwnership(r,{reviewerUid:ADMIN_UID,method:'in-person-known-student',evidenceReference:'private-review/fixture-1',approved:true},2000);
test('request is not access, password reset or identity binding',()=>{const r=req();assert.equal(r.status,'pending-review');assert.equal(r.authBound,false);assert.equal(r.credentialPolicy,'preserve-existing');assert.equal(r.password,undefined);});
test('legacy password, claimed email and code alone are not ownership methods',()=>{
 for(const method of ['old-password','claimed-email','PAR-code','USR-code'])assert.throws(()=>reviewOwnership(req(),{reviewerUid:ADMIN_UID,method,evidenceReference:'claimed',approved:true},2000));
});
test('non-admin review and expired requests denied',()=>{
 assert.throws(()=>reviewOwnership(req(),{reviewerUid:'P1',method:'in-person-known-student',evidenceReference:'x',approved:true},2000));
 assert.throws(()=>reviewOwnership(req(),{reviewerUid:ADMIN_UID,method:'in-person-known-student',evidenceReference:'x',approved:true},90000000));
});
test('verified ownership alone does not execute or assume credential-processing permission',()=>{
 const p=prepareBinding(review(req()),{authUid:'AUTH-S1',adminReviewedCollisionFree:true},3000);
 assert.equal(p.execute,false);assert.equal(p.needsSeparateCutoverApproval,true);assert.equal(p.liveCredentialProcessingApproved,false);
});
test('reviewed collision and active review required',()=>{
 assert.throws(()=>prepareBinding(req(),{authUid:'AUTH-S1',adminReviewedCollisionFree:true},3000));
 assert.throws(()=>prepareBinding(review(req()),{authUid:'AUTH-S1',adminReviewedCollisionFree:false},3000));
});
