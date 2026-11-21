// Local state-machine preparation only. No account creation, credential handling,
// production reads, messages or automatic identity binding.
import {randomBytes} from 'node:crypto';
import {ADMIN_UID} from './admin.mjs';
export function requestOwnership({appUserId,role},now=Date.now()){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(appUserId||'')||!['student','teacher'].includes(role))throw new Error('Invalid enrollment request');
 return {requestId:randomBytes(16).toString('hex'),appUserId,role,status:'pending-review',createdAt:now,expiresAt:now+86400000,credentialPolicy:'preserve-existing',authBound:false};
}
export function reviewOwnership(request,{reviewerUid,method,evidenceReference,approved},now=Date.now()){
 if(reviewerUid!==ADMIN_UID)throw new Error('Admin required');
 if(request.status!=='pending-review'||request.expiresAt<=now)throw new Error('Request expired or already reviewed');
 if(!['in-person-known-student','existing-independently-verified-contact'].includes(method)||!evidenceReference)throw new Error('Independent ownership evidence required');
 return {...request,status:approved?'ownership-verified':'rejected',reviewedAt:now,reviewerUid,method,evidenceReference,authBound:false};
}
export function prepareBinding(request,{authUid,adminReviewedCollisionFree,liveCredentialProcessingApproved=false},now=Date.now()){
 if(request.status!=='ownership-verified'||request.expiresAt<=now)throw new Error('Current ownership review required');
 if(!adminReviewedCollisionFree||typeof authUid!=='string'||!authUid||authUid.includes('/'))throw new Error('Reviewed identity mapping required');
 // This is deliberately not an execution path, even if an input claims approval.
 return {appUserId:request.appUserId,authUid,role:request.role,ownershipEvidence:request.evidenceReference,credentialPolicy:'preserve-existing',needsSeparateCutoverApproval:true,liveCredentialProcessingApproved:liveCredentialProcessingApproved===true,execute:false};
}
