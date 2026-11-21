// Staged same-password session adapter. No legacy password decoding or migration.
// A password that was client-readable MUST NOT become the only login factor.
// All records here must be server-owned and populated only by an approved migration.
import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {ADMIN_UID} from './admin.mjs';
const scrypt=promisify(scryptCallback);
const hash=x=>createHash('sha256').update(x).digest('hex');
const userKey=(role,username)=>hash(JSON.stringify([role,username.trim().toLowerCase()]));
// Product function for the later approved enrollment route. Do not call with live
// credentials during preparation. Synthetic tests only in this change.
export async function makeVerifier(password){
 if(typeof password!=='string'||!password||Buffer.byteLength(password)>1024)throw new Error('Invalid credential');
 const salt=randomBytes(16).toString('hex');
 const derived=await scrypt(password,salt,64);
 return {algorithm:'scrypt-v1',salt,derived:derived.toString('hex')};
}
export async function verifyPassword(password,record){
 if(typeof password!=='string'||Buffer.byteLength(password)>1024||record?.algorithm!=='scrypt-v1'||!/^[a-f0-9]{32}$/.test(record.salt||'')||!/^[a-f0-9]{128}$/.test(record.derived||''))return false;
 const derived=await scrypt(password,record.salt,64);
 return timingSafeEqual(derived,Buffer.from(record.derived,'hex'));
}
export async function issueIndependentLoginProof(db,{reviewerUid,authUid,method,evidenceReference},now=Date.now()){
 if(reviewerUid!==ADMIN_UID||!/^[A-Za-z0-9_-]{1,128}$/.test(authUid||''))throw new Error('Admin-reviewed identity required');
 if(!['in-person-known-student','existing-independently-verified-contact'].includes(method)||!evidenceReference)throw new Error('Independent proof required');
 const token=randomBytes(32).toString('base64url');
 await db.doc('legacy_login_proofs/'+hash(token)).set({authUid,method,evidenceReference,reviewerUid,expiresAt:now+300000,used:false});
 // Do not log, send automatically, or persist this returned ephemeral proof in URLs.
 return {token,expiresAt:now+300000};
}
export async function samePasswordLogin({db,auth},{username,password,role,proof},now=Date.now()){
 const generic=()=>new Error('Account or independent verification invalid');
 if(!['student','teacher'].includes(role)||typeof username!=='string'||username.length>100||typeof proof!=='string'||proof.length!==43)throw generic();
 const key=userKey(role,username),lim=db.doc('legacy_login_limits/'+key+'-'+Math.floor(now/60000));
 // Server-derived name key is only a lookup, never an authority or email binding.
 await db.runTransaction(async tx=>{const p=(await tx.get(lim)).data();if((p?.attempts||0)>=5)throw generic();tx.set(lim,{attempts:(p?.attempts||0)+1,expiresAt:now+120000});});
 const index=(await db.doc('login_names/'+key).get()).data();
 if(!index||!/^[A-Za-z0-9_-]{1,128}$/.test(index.authUid||''))throw generic();
 const uid=index.authUid;
 const credentials=(await db.doc('auth_credentials/'+uid).get()).data();
 if(!await verifyPassword(password,credentials))throw generic();
 await db.runTransaction(async tx=>{
  const identity=(await tx.get(db.doc('auth_identities/'+uid))).data();
  const voucherRef=db.doc('legacy_login_proofs/'+hash(proof));const voucher=(await tx.get(voucherRef)).data();
  if(identity?.role!==role||identity.status!=='approved'||!voucher||voucher.used||voucher.authUid!==uid||voucher.expiresAt<=now)throw generic();
  tx.update(voucherRef,{used:true,usedAt:now});
 });
 // This does not change any user's password. Mounting/enrollment are not enabled.
 const customToken=await auth.createCustomToken(uid,{legacyStepUp:true,stepUpAt:Math.floor(now/1000)});
 return {customToken};
}
export function validateLegacySession(identity,now=Date.now()){
 if(identity.legacyStepUp!==true)return;
 const age=now/1000-identity.stepUpAt;
 if(!Number.isFinite(age)||age<0||age>=43200)throw new Error('Fresh independent verification required');
}
export {userKey};
