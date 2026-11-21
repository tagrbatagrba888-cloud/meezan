// Pure, offline migration planner. Does not read production, reset passwords, send,
// write Firestore, or return legacy password fields. Inputs remain local.
const validId=x=>typeof x==='string'&&x.length>0&&x.length<129&&!x.includes('/');
export function buildEnrollmentPlan({users,verifiedMappings}){
 if(!Array.isArray(users)||!Array.isArray(verifiedMappings))throw new Error('Arrays required');
 const ids=new Set(),codes=new Set(),authUids=new Set(),appIds=new Set();
 const records=[],unmapped=[];
 for(const u of users){
  const id=String(u.id??'');
  if(!validId(id)||ids.has(id))throw new Error('Invalid or duplicate application ID');
  ids.add(id);
  if(u.code){if(!/^USR-[0-9]{6}$/.test(u.code)||codes.has(u.code))throw new Error('Invalid or duplicate student code');codes.add(u.code);}
 }
 const byId=new Map(users.map(u=>[String(u.id),u]));
 for(const m of verifiedMappings){
  if(!validId(m.authUid)||!validId(m.appUserId)||authUids.has(m.authUid)||appIds.has(m.appUserId))throw new Error('Invalid or duplicate identity mapping');
  if(!['student','teacher'].includes(m.role))throw new Error('Unsupported role');
  if(m.verifiedBy!=='4KbUOO6wrHf3jzzKvGIltsNyzFX2'||!m.evidenceReference||!Number.isFinite(m.verifiedAt))throw new Error('Admin-verified ownership evidence required');
  const u=byId.get(m.appUserId);if(!u)throw new Error('Mapping references missing user');
  // A role is never taken from client profile data. Admin's verified mapping owns it.
  if(m.role==='student'&&!/^USR-[0-9]{6}$/.test(u.code||''))throw new Error('Student must have valid existing code');
  authUids.add(m.authUid);appIds.add(m.appUserId);
  const identity={authUid:m.authUid,appUserId:m.appUserId,role:m.role,verifiedBy:m.verifiedBy,verifiedAt:m.verifiedAt,evidenceReference:m.evidenceReference};
  if(m.role==='student'){identity.studentId=m.appUserId;identity.code=u.code;}
  records.push({identity,privateProfile:{appUserId:m.appUserId,fullName:String(u.fullName||u.username||'')},studentCode:m.role==='student'?{code:u.code,studentId:m.appUserId}:null});
 }
 for(const id of ids)if(!appIds.has(id))unmapped.push({appUserId:id,reason:'ownership-not-yet-verified'});
 return {mode:'offline-plan-only',writes:0,accountChanges:0,records,unmapped,canCutover:false};
}
export function migrationChecklist(){return [
 'Obtain separate project/environment/backup/enrollment/cutover approvals.',
 'Use a protected export. Never upload legacy password-bearing records into browser code or a public repository.',
 'Verify each existing account owner and build a server-owned identity map. Do not infer ownership from email or display name.',
 'Keep existing application IDs and result keys. Record conflicts and unmapped users; do not guess or skip silently.',
 'Create restricted profiles, user-scoped results, roles and pending/disabled rules in staging.',
 'Replace every reader/writer of shared users/all and result all-documents; secure correction writes to teachers/admin.',
 'Test student, teacher, admin, rejected, pending, disabled and unrelated accounts. Include old sessions, shared devices and both link directions.',
 'Back up the actual deployed rules/data privately. Prove a restricted rollback without reopening public reads.',
 'After the separately approved window begins, switch compatible clients and rules together, invalidate legacy sessions and monitor failures.',
 'Preserve every existing user-entered password. No resets or new-password requirement are authorized. Remove password-bearing client-readable fields only after an approved verified migration; never mass-email accounts implicitly.'
 ];}
