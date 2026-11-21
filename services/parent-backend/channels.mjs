// Pure channel authorization. Destination proofs are never derived from a PAR code.
import {createHash,randomBytes} from 'node:crypto';
export const digest=s=>createHash('sha256').update(s).digest('hex');
export async function issueChannelProof(db,uid,channel,now=Date.now()){
 if(!['telegram','whatsapp'].includes(channel))throw new Error('Unsupported channel');
 const parent=(await db.doc('parents/'+uid).get()).data();
 if(parent?.status!=='approved')throw new Error('Approved parent required');
 const token=randomBytes(32).toString('base64url');
 await db.doc('parent_channel_proofs/'+digest(token)).set({uid,channel,expiresAt:now+600000,used:false});
 return {token,expiresAt:now+600000};
}
export async function consumeChannelProof(db,{token,channel,destination,privateChat=true},now=Date.now()){
 if(!privateChat || !['telegram','whatsapp'].includes(channel))throw new Error('Private channel required');
 if(typeof token!=='string'||token.length!==43)throw new Error('Invalid proof');
 const valid=channel==='telegram'?/^-?[0-9]{1,20}$/.test(String(destination)):/^[1-9][0-9]{9,14}$/.test(String(destination));
 if(!valid)throw new Error('Invalid destination');
 const ref=db.doc('parent_channel_proofs/'+digest(token));
 return db.runTransaction(async tx=>{
  const proof=(await tx.get(ref)).data();
  if(!proof||proof.used||proof.channel!==channel||proof.expiresAt<=now)throw new Error('Expired or used proof');
  const parentRef=db.doc('parents/'+proof.uid);
  const parent=(await tx.get(parentRef)).data();
  if(parent?.status!=='approved')throw new Error('Approved parent required');
  tx.update(ref,{used:true,usedAt:now});
  tx.set(db.doc('parent_channels/'+proof.uid),{[channel]:{destination:String(destination),verifiedAt:now,enabled:true}},{merge:true});
  return {uid:proof.uid};
 });
}
