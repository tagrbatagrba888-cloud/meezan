// Staged private report projection and durable per-recipient delivery jobs. No sends.
import {reportSettings,settingsDocument} from './settings.mjs';
import {parentEventEligible} from './parent-eligibility.mjs';
import {PARENT_TEMPLATE_VERSION} from './parent-mail.mjs';
import {createHash} from 'node:crypto';
const key=(...parts)=>createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export async function stageResult(db,{studentId,resultId,revision='1',name,studentName,score,totalScore,kind,correctedAt},baseline=false,controls={enabled:true,channels:{inSite:true,email:true,telegram:true,whatsapp:true}}){
 if(!studentId||!resultId||!Number.isFinite(score)||!Number.isFinite(totalScore)||totalScore<=0||score<0||score>totalScore||!['exam','homework'].includes(kind))throw new Error('Invalid result');
 const eventId=key(studentId,resultId,revision);
 const event=db.doc('parent_result_events/'+eventId);
 return db.runTransaction(async tx=>{
  if((await tx.get(event)).exists)return {duplicate:true,jobs:0};
  const links=(await tx.get(db.doc('student_links/'+studentId))).data()?.parents||{};
  const recipients=[];
  for(const uid of Object.keys(links)){
   const parent=(await tx.get(db.doc('parents/'+uid))).data();
   const channels=(await tx.get(db.doc('parent_channels/'+uid))).data()||{};
   if(parent?.status==='approved')recipients.push({uid,parent,channels});
  }
  const projectionRef=db.doc('student_results/'+studentId);
  const prior=(await tx.get(projectionRef)).data()||{};
  const result={key:resultId,kind,itemName:String(name||''),score,totalScore,correctedAt:correctedAt||null};
  const items=[result,...(prior.items||[]).filter(x=>x.key!==resultId)].slice(0,200);
  tx.set(projectionRef,{studentId,items,updatedAt:Date.now()});
  let jobs=0;
  if(!baseline&&controls.enabled)for(const {uid,parent,channels} of recipients){
   const title='نتيجة جديدة: '+String(studentName||'الطالب');
   const body=String(name||'')+': '+score+'/'+totalScore;
   if(controls.channels.inSite)tx.set(db.doc('parent_student_notifications/'+uid+'/students/'+studentId+'/items/'+eventId),{title,body,read:false,studentId,createdAt:Date.now()});
   // Email must be verified by enrollment. Phone/chat must be proved by inbound channel challenge.
   const destinations={};
   if(controls.channels.email && parent.emailVerified===true && parent.email)destinations.email=parent.email;
   for(const channel of ['telegram','whatsapp'])if(controls.channels[channel]&&channels[channel]?.enabled&&channels[channel]?.verifiedAt)destinations[channel]=channels[channel].destination;
   for(const [channel,destination] of Object.entries(destinations)){
    const id=key(eventId,uid,channel);
    tx.set(db.doc('parent_delivery_jobs/'+id),{schemaVersion:1,reportType:kind+'_result',templateVersion:PARENT_TEMPLATE_VERSION,studentName:String(studentName||'الطالب'),parentName:String(parent.fullName||'ولي الأمر'),itemName:String(name||''),score,totalScore,resultId,revision,kind,eventId,parentUid:uid,studentId,channel,destination,title,body,status:'pending',attempts:0,createdAt:Date.now()});jobs++;
   }
  }
  tx.create(event,{studentId,resultId,revision,baseline,status:'staged',jobs,createdAt:Date.now()});
  return {duplicate:false,jobs};
 });
}
export async function claimDelivery(db,id,now=Date.now()){
 const ref=db.doc('parent_delivery_jobs/'+id);
 return db.runTransaction(async tx=>{
  const job=(await tx.get(ref)).data();
  if(!job||job.status!=='pending'||job.nextAttemptAt>now)return null;
  const settings=reportSettings((await tx.get(db.doc(settingsDocument))).data());
  if(job.schemaVersion!==1||!settings.enabled||!settings.types[job.reportType]||!settings.channels[job.channel])return null;
  if(job.createdAt<settings.enabledAt){tx.update(ref,{status:'cancelled',reason:'before-current-activation'});return null;}
  const parent=(await tx.get(db.doc('parents/'+job.parentUid))).data();
  const links=(await tx.get(db.doc('student_links/'+job.studentId))).data()?.parents||{};
  const channels=(await tx.get(db.doc('parent_channels/'+job.parentUid))).data()||{};
  const stillVerified=job.channel==='email'?(parent?.emailVerified===true&&parent.email===job.destination):(channels[job.channel]?.enabled&&channels[job.channel]?.verifiedAt&&channels[job.channel]?.destination===job.destination);
  if(parent?.status!=='approved'||!links[job.parentUid]||!stillVerified){tx.update(ref,{status:'cancelled',reason:'access-or-consent-revoked'});return null;}
  if(!await parentEventEligible(db,tx,job,now)){tx.update(ref,{status:'cancelled',reason:'event-no-longer-eligible'});return null;}
  // An ambiguous send never retries automatically. Reconcile its provider message ID first.
  tx.update(ref,{status:'sending',attempts:job.attempts+1,claimedAt:now});
  return {...job,id};
 });
}
export async function finishDelivery(db,id,{sent=false,providerMessageId=null,retryable=false,error=null},now=Date.now()){
 const ref=db.doc('parent_delivery_jobs/'+id);
 return db.runTransaction(async tx=>{
  const job=(await tx.get(ref)).data();if(job?.status!=='sending')throw new Error('Delivery not claimed');
  if(sent&&providerMessageId)tx.update(ref,{status:'accepted',providerMessageId:String(providerMessageId),acceptedAt:now});
  else tx.update(ref,{status:'held_unknown',error:String(error||'unknown-provider-outcome'),heldAt:now});
 });
}
export async function confirmParentDelivery(db,id,{providerMessageId,destination,verifiedReceipt=false,delivered=false},now=Date.now()){
 if(!verifiedReceipt||!delivered)throw new Error('Verified matching provider receipt required');
 return db.runTransaction(async tx=>{
  const ref=db.doc('parent_delivery_jobs/'+id),job=(await tx.get(ref)).data();
  if(job?.status!=='accepted'||job.providerMessageId!==String(providerMessageId)||job.destination!==destination)throw new Error('Receipt mismatch');
  tx.update(ref,{status:'delivered',deliveredAt:now});
 });
}
