// Independent parent-email dispatcher. No live transport by default.
import {claimDelivery,finishDelivery} from './reports.mjs';
export async function dispatchParentEmails(db,{enabled=false,send,now=Date.now(),limit=20}={}){
 if(!enabled||typeof send!=='function')return {processed:0,reason:'dispatch_disabled'};
 // Reconcile abandoned claims by holding, never guessing or resending.
 const active=await db.collection('parent_delivery_jobs').where('status','==','sending').limit(limit).get();
 for(const row of active.docs)if(row.data().claimedAt<now-900000)await db.runTransaction(async tx=>{const r=db.doc('parent_delivery_jobs/'+row.id),j=(await tx.get(r)).data();if(j?.status==='sending'&&j.claimedAt<now-900000)tx.update(r,{status:'held_unknown',heldAt:now,error:'interrupted-after-claim'});});
 const pending=await db.collection('parent_delivery_jobs').where('status','==','pending').limit(limit).get();let processed=0;
 for(const row of pending.docs){
  if(row.data().channel!=='email')continue;
  const job=await claimDelivery(db,row.id,now);if(!job)continue;
  let outcome;try{outcome=await send(job);}catch{outcome={sent:false,error:'unknown-transport-outcome'};}
  await finishDelivery(db,row.id,outcome,now);processed++;
  // A failure, quota/rate limit or unknown result stops this batch.
  if(!outcome.sent||!outcome.providerMessageId)break;
 }
 return {processed,reason:processed?'batch_processed':'no_eligible_pending_jobs'};
}
