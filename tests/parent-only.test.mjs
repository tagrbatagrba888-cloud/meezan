import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';import {doc,getDoc,setDoc,collection,getDocs,writeBatch} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-meezan',firestore:{host:'127.0.0.1',port:8085,rules:readFileSync(new URL('../firestore.parent-only.rules',import.meta.url),'utf8')}});
await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();for(const [path,data] of Object.entries({'parents/P1':{status:'approved'},'parents/P2':{status:'approved'},'student_links/S1':{parents:{P1:{}}},'student_results/S1':{items:[{score:8}]},'users/all':{items:[{id:'S1'}]}}))await setDoc(doc(db,path),data);});
const anon=env.unauthenticatedContext().firestore(),p1=env.authenticatedContext('P1').firestore(),p2=env.authenticatedContext('P2').firestore(),admin=env.authenticatedContext('4KbUOO6wrHf3jzzKvGIltsNyzFX2').firestore();
let count=0;const no=async p=>{await assertFails(p);count++;},yes=async p=>{await assertSucceeds(p);count++;};
await no(getDoc(doc(anon,'parents/P1')));await no(getDocs(collection(p1,'parents')));await yes(getDocs(collection(admin,'parents')));
await yes(getDoc(doc(p1,'student_results/S1')));await no(getDoc(doc(p2,'student_results/S1')));
await no(setDoc(doc(p2,'student_links/S1'),{parents:{P2:{}}}));await no(setDoc(doc(anon,'student_codes/FORGED'),{studentId:'S1'}));
for(const coll of ['parent_report_settings','messaging_channels','channel_outbox','parent_channels','parent_channel_proofs','parent_delivery_jobs','parent_homework_events','admin_outbox','result_emails','result_emails_meta']){await no(getDoc(doc(anon,coll+'/private')));await no(setDoc(doc(p1,coll+'/private'),{x:true}));}
for(const coll of ['admin_outbox','result_emails','result_emails_meta'])await yes(setDoc(doc(admin,coll+'/private'),{x:true}));
await yes(setDoc(doc(admin,'student_links/S1'),{parents:{}}));await no(getDoc(doc(p1,'student_results/S1')));
await no(getDoc(doc(anon,'channel_outbox/job/recipients/recipient')));await no(setDoc(doc(p1,'channel_outbox/job/recipients/recipient'),{state:'accepted'}));await yes(setDoc(doc(admin,'channel_outbox/job/recipients/recipient'),{state:'queued'}));
await yes(getDoc(doc(anon,'parent_controls/portal')));await no(getDoc(doc(anon,'parent_controls/private')));await no(setDoc(doc(anon,'parent_controls/portal'),{parentLoginEnabled:true}));
// This MUST remain true to expose, rather than hide, the limited scope of the candidate.
await yes(getDoc(doc(anon,'users/all')));await yes(getDoc(doc(anon,'admin_gate/unchanged')));await yes(getDoc(doc(anon,'auth_credentials/unchanged')));

const verified=env.authenticatedContext('P3',{email:'p3@example.test',email_verified:true}).firestore();
const unverified=env.authenticatedContext('P4',{email:'p4@example.test',email_verified:false}).firestore();
const profile=(uid,email,code,status='pending')=>({id:uid,authUid:uid,email,emailVerified:true,fullName:'Parent fixture',phone:'',code,status,createdAt:'fixture',updatedAt:'fixture'});
const batchFor=(db,uid,email,code,status='pending')=>{const b=writeBatch(db);b.set(doc(db,'parents/'+uid),profile(uid,email,code,status));b.set(doc(db,'parent_codes/'+code),{uid});return b.commit();};
await yes(batchFor(unverified,'P4','p4@example.test','PAR-444444'));
await no(batchFor(verified,'P3','forged@example.test','PAR-333333'));
await no(batchFor(verified,'P3','p3@example.test','PAR-333333','approved'));
await yes(batchFor(verified,'P3','p3@example.test','PAR-333333'));
await no(getDoc(doc(verified,'student_results/S1')));
await no(setDoc(doc(verified,'parents/P3'),profile('P3','p3@example.test','PAR-333333','approved')));
await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'student_codes/123456'),{studentId:'S3'});});
const {serverTimestamp:reqTs}=await import('firebase/firestore');
const req=(uid,code)=>({requesterUid:uid,kind:'parent',targetCode:code,status:'pending',createdAt:reqTs()});
await yes(setDoc(doc(p1,'parent_link_requests/RA'),req('P1','123456')));
await no(setDoc(doc(p1,'parent_link_requests/RC'),req('P1','USR-999999')));
console.log(count+' parent-only rules assertions passed; public legacy users/all is intentionally NOT fixed.');
await env.cleanup();
