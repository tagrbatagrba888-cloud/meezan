import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildEnrollmentPlan} from './enrollment-plan.mjs';
const users=[{id:'S1',fullName:'طالب',code:'USR-123456',password:'never-copy-this',email:'untrusted@example.invalid',role:'admin'},{id:'T1',fullName:'مدرس'}];
const mapping={authUid:'auth-S1',appUserId:'S1',role:'student',verifiedBy:'4KbUOO6wrHf3jzzKvGIltsNyzFX2',verifiedAt:1000,evidenceReference:'local-admin-review/1'};
test('planner preserves IDs, strips legacy secrets and does not accept profile role',()=>{
 const p=buildEnrollmentPlan({users,verifiedMappings:[mapping]});
 assert.equal(p.mode,'offline-plan-only');assert.equal(p.writes,0);assert.equal(p.accountChanges,0);assert.equal(p.canCutover,false);
 assert.equal(p.records[0].identity.studentId,'S1');assert.equal(p.records[0].identity.role,'student');
 assert.equal(p.records[0].studentCode.code,'USR-123456');assert.equal(p.unmapped[0].appUserId,'T1');
 const output=JSON.stringify(p);assert.ok(!output.includes('never-copy-this'));assert.ok(!output.includes('untrusted@example.invalid'));
});
test('email alone cannot map an owner',()=>{assert.throws(()=>buildEnrollmentPlan({users,verifiedMappings:[{...mapping,verifiedBy:null,email:'untrusted@example.invalid'}]}));});
test('duplicate and missing identities stop planning',()=>{
 assert.throws(()=>buildEnrollmentPlan({users,verifiedMappings:[mapping,mapping]}));
 assert.throws(()=>buildEnrollmentPlan({users,verifiedMappings:[{...mapping,appUserId:'missing'}]}));
 assert.throws(()=>buildEnrollmentPlan({users:[users[0],users[0]],verifiedMappings:[]}));
});
test('planner cannot assign admin roles or invalid student codes',()=>{
 assert.throws(()=>buildEnrollmentPlan({users,verifiedMappings:[{...mapping,role:'admin'}]}));
 assert.throws(()=>buildEnrollmentPlan({users:[{id:'S1',code:'wrong'}],verifiedMappings:[mapping]}));
});
test('empty mapping does not silently approve a cutover',()=>{const p=buildEnrollmentPlan({users,verifiedMappings:[]});assert.equal(p.unmapped.length,2);assert.equal(p.canCutover,false);});
