import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHandler} from './api.mjs';
import {services,ADMIN_UID} from './admin.mjs';
import {deleteApp,getApps} from 'firebase-admin/app';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Emulators required');
const {db,auth}=services();let server,base;const tokens={};
before(async()=>{
 for(const uid of ['P1','P2','P3','CHILD1',ADMIN_UID]){
  const email=uid.toLowerCase()+'@example.test',password='Synthetic-only-82!';
  try{await auth.createUser({uid,email,password,emailVerified:true});}catch(e){if(e.code!=='auth/uid-already-exists')throw e;}
  const r=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  const b=await r.json();assert.ok(b.idToken);tokens[uid]=b.idToken;
 }
 server=createServer(createHandler());await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
});
beforeEach(async()=>{
 await fetch('http://'+process.env.FIRESTORE_EMULATOR_HOST+'/emulator/v1/projects/demo-meezan/databases/(default)/documents',{method:'DELETE'});
 for(const uid of ['P1','P2'])await db.doc('parents/'+uid).set({status:'approved',fullName:uid,code:uid==='P1'?'PAR-111111':'PAR-222222'});
 await db.doc('student_private/S1').set({status:'approved',fullName:'طالب تجريبي'});
 await db.doc('student_codes/USR-123456').set({studentId:'S1'});
 await db.doc('parent_codes/PAR-111111').set({uid:'P1'});
 await db.doc('auth_identities/CHILD1').set({role:'student',studentId:'S1',code:'USR-123456'});
 await db.doc('student_results/S1').set({items:[{score:8,totalScore:10}]});
});
after(async()=>{await new Promise(r=>server.close(r));await db.terminate();for(const a of getApps())await deleteApp(a);});
async function call(path,uid,body,extra={}){
 const headers={'Content-Type':'application/json',...extra};if(uid)headers.Authorization='Bearer '+tokens[uid];
 const r=await fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};
}
test('real emulator ID token required; hostile origin denied',async()=>{
 assert.equal((await call('/api/parent/me')).status,401);
 assert.equal((await call('/api/parent/me','P1',null,{Origin:'https://untrusted.invalid'})).status,403);
 assert.equal((await call('/api/parent/me','P1')).status,200);
});
test('valid code requests access but cannot expose results before admin review',async()=>{
 assert.equal((await call('/api/parent/results/S1','P1')).status,403);
 const r=await call('/api/parent/link-requests','P1',{kind:'parent',targetCode:'USR-123456',requesterUid:'P2'});
 assert.equal(r.status,202);assert.equal((await db.doc('parent_link_requests/'+r.body.requestId).get()).data().requesterUid,'P1');
 assert.equal((await call('/api/parent/results/S1','P1')).status,403);
 assert.equal((await call('/api/admin/link-requests/'+r.body.requestId+'/review','P1',{approved:true,relationshipVerified:true})).status,403);
 assert.equal((await call('/api/admin/link-requests/'+r.body.requestId+'/review',ADMIN_UID,{approved:true})).status,400);
 assert.equal((await call('/api/admin/link-requests/'+r.body.requestId+'/review',ADMIN_UID,{approved:true,relationshipVerified:true})).status,200);
 assert.equal((await call('/api/parent/results/S1','P1')).status,200);
 assert.equal((await call('/api/parent/results/S1','P2')).status,403);
 const children=await call('/api/parent/children','P1');assert.equal(children.body.children[0].studentId,'S1');
 assert.equal((await call('/api/admin/unlink',ADMIN_UID,{parentUid:'P1',studentId:'S1'})).status,200);
 assert.equal((await call('/api/parent/results/S1','P1')).status,403);
});
test('child direction requires server-owned mapping, then admin review',async()=>{
 assert.equal((await call('/api/parent/link-requests','P2',{kind:'child',targetCode:'PAR-111111'})).status,403);
 const r=await call('/api/parent/link-requests','CHILD1',{kind:'child',targetCode:'PAR-111111'});assert.equal(r.status,202);
 assert.equal((await call('/api/admin/link-requests/'+r.body.requestId+'/review',ADMIN_UID,{approved:true,relationshipVerified:true})).status,200);
 assert.equal((await call('/api/parent/results/S1','P1')).status,200);
});
test('duplicate pending request dedupes and rate limit applies',async()=>{
 let id;
 for(let i=0;i<10;i++){
  const r=await call('/api/parent/link-requests','P1',{kind:'parent',targetCode:'USR-123456'});assert.equal(r.status,202);id??=r.body.requestId;assert.equal(r.body.requestId,id);
 }
 assert.equal((await db.collection('parent_link_requests').get()).size,1);
 assert.equal((await call('/api/parent/link-requests','P1',{kind:'parent',targetCode:'USR-123456'})).status,429);
});
test('channel proof endpoint is authenticated, bounded and approved-parent only',async()=>{
 assert.equal((await call('/api/parent/channel-proof','P1',{channel:'email'})).status,400);
 assert.equal((await call('/api/parent/channel-proof','CHILD1',{channel:'telegram'})).status,403);
 const r=await call('/api/parent/channel-proof','P1',{channel:'telegram'});assert.equal(r.status,201);assert.equal(r.body.token.length,43);
});
test('suspended parent denied even if a link still exists',async()=>{
 await db.doc('student_links/S1').set({parents:{P1:{}}});await db.doc('parents/P1').update({status:'suspended'});
 assert.equal((await call('/api/parent/me','P1')).status,403);assert.equal((await call('/api/parent/results/S1','P1')).status,403);
});

test('new parent enrollment requires verified Firebase email, explicit open registration, admin approval',async()=>{
 assert.equal((await call('/api/parent/register','P3',{fullName:'Parent fixture'})).status,403);
 await db.doc('parent_controls/portal').set({parentRegisterEnabled:true});
 const r=await call('/api/parent/register','P3',{fullName:'Parent fixture',status:'approved',email:'forged@example.invalid'});
 assert.equal(r.status,201);assert.equal(r.body.status,'pending');assert.match(r.body.code,/^PAR-[0-9]{6}$/);
 const p=(await db.doc('parents/P3').get()).data();assert.equal(p.email,'p3@example.test');assert.equal(p.status,'pending');
 assert.equal((await call('/api/parent/me','P3')).status,403);
 const again=await call('/api/parent/register','P3',{fullName:'new'});assert.equal(again.body.code,r.body.code);
});
test('login proof endpoint cannot be called by parent or code holder',async()=>{
 assert.equal((await call('/api/admin/login-proofs','P1',{authUid:'CHILD1',method:'in-person-known-student',evidenceReference:'test'})).status,403);
 assert.equal((await call('/api/session/legacy',null,{username:'missing',password:'synthetic',role:'student',proof:'PAR-111111'})).status,401);
});
