// Native HTTP adapter. Not mounted or deployed. Identity always comes from a verified ID token.
import {createHash,randomInt} from 'node:crypto';
import {services,authenticate,requireAdmin,ADMIN_UID} from './admin.mjs';
import {issueChannelProof} from './channels.mjs';
import {samePasswordLogin,issueIndependentLoginProof} from './legacy-session.mjs';
import {FieldValue} from 'firebase-admin/firestore';
const hash=(...x)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
async function rateLimit(db,uid,action,now){
 const window=Math.floor(now/60000),ref=db.doc('parent_api_limits/'+hash(uid,action,window));
 await db.runTransaction(async tx=>{
  const prior=(await tx.get(ref)).data();const n=prior?.count||0;
  if(n>=10)throw new ApiError(429,'Too many requests');
  tx.set(ref,{count:n+1,expiresAt:now+120000});
 });
}
async function requireParent(db,uid){
 const parent=(await db.doc('parents/'+uid).get()).data();
 if(parent?.status!=='approved')throw new ApiError(403,'Approved parent required');
 return parent;
}
async function parseBody(req){
 let size=0,parts=[];
 for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>8192)throw new ApiError(413,'Request too large');parts.push(chunk);}
 try{return JSON.parse(Buffer.concat(parts.map(x=>Buffer.from(x))).toString()||'{}');}catch{throw new ApiError(400,'Invalid JSON');}
}
export function createHandler({getServices=services,verify=authenticate,clock=Date.now,origin='https://mee7an.vercel.app'}={}){
 return async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try{
   if(req.headers.origin&&req.headers.origin!==origin)throw new ApiError(403,'Origin denied');
   if(!['GET','POST'].includes(req.method))throw new ApiError(405,'Method denied');
   const path=new URL(req.url,'https://local.invalid').pathname;
   if(req.method==='POST'&&path==='/api/session/legacy'){
    const body=await parseBody(req);
    try {return reply(200,await samePasswordLogin(getServices(),body,clock()));}
    catch{return reply(401,{error:'Account or independent verification invalid'});}
   }
   let identity;try{identity=await verify(req.headers.authorization);}catch{throw new ApiError(401,'Authentication required');}
   const {db}=getServices(),uid=identity.uid;
   if(!safeId(uid))throw new ApiError(403,'Identity invalid');
   const isAdmin=uid===ADMIN_UID;
   if(req.method==='POST'&&path==='/api/admin/login-proofs'){
    if(!isAdmin)throw new ApiError(403,'Admin required');
    const body=await parseBody(req);await rateLimit(db,uid,'login-proof-issue',clock());
    if(!safeId(body.authUid)||!['in-person-known-student','existing-independently-verified-contact'].includes(body.method)||typeof body.evidenceReference!=='string'||body.evidenceReference.length<3||body.evidenceReference.length>200)throw new ApiError(400,'Independent review reference required');
    return reply(201,await issueIndependentLoginProof(db,{reviewerUid:uid,authUid:body.authUid,method:body.method,evidenceReference:body.evidenceReference},clock()));
   }
   if(req.method==='POST'&&path==='/api/parent/register'){
    const body=await parseBody(req);
    if(identity.email_verified!==true||!identity.email)throw new ApiError(403,'Verified email required');
    const fullName=String(body.fullName||'').trim();
    if(fullName.length<2||fullName.length>100)throw new ApiError(400,'Valid name required');
    await rateLimit(db,uid,'parent-register',clock());
    let created;
    for(let attempt=0;attempt<5;attempt++){
     const code='PAR-'+randomInt(100000,1000000);
     created=await db.runTransaction(async tx=>{
      const ref=db.doc('parents/'+uid),old=(await tx.get(ref)).data();
      const controls=(await tx.get(db.doc('parent_controls/portal'))).data();
      const codeRef=db.doc('parent_codes/'+code),occupied=(await tx.get(codeRef)).exists;
      if(old)return {uid,code:old.code,status:old.status};
      if(controls?.parentRegisterEnabled!==true)throw new ApiError(403,'Registration closed');
      if(occupied)return null;
      tx.create(ref,{id:uid,authUid:uid,email:identity.email,emailVerified:true,fullName,code,status:'pending',createdAt:FieldValue.serverTimestamp()});
      tx.create(codeRef,{uid});
      return {uid,code,status:'pending'};
     });
     if(created)break;
    }
    if(!created)throw new ApiError(503,'Registration temporarily unavailable');
    return reply(201,created);
   }
   if(req.method==='GET'&&path==='/api/parent/me'){
    const p=await requireParent(db,uid);
    return reply(200,{uid,fullName:p.fullName||'',code:p.code||'',status:p.status});
   }
   if(req.method==='GET'&&path==='/api/parent/children'){
    await requireParent(db,uid);
    const children=(await db.doc('parent_links/'+uid).get()).data()?.children||{};
    const filtered=[];
    // Verify authoritative access independently of display/cache links.
    for(const [studentId,info] of Object.entries(children).slice(0,30)){
     if(!safeId(studentId))continue;
     const links=(await db.doc('student_links/'+studentId).get()).data()?.parents||{};
     if(Object.hasOwn(links,uid))filtered.push({studentId,name:String(info.name||''),code:String(info.code||'')});
    }
    return reply(200,{children:filtered});
   }
   const result=/^\/api\/parent\/results\/([A-Za-z0-9_-]{1,128})$/.exec(path);
   if(req.method==='GET'&&result){
    // A transaction checks parent status, current links and data in one snapshot.
    const studentId=result[1];
    const data=await db.runTransaction(async tx=>{
     const p=(await tx.get(db.doc('parents/'+uid))).data();
     const links=(await tx.get(db.doc('student_links/'+studentId))).data()?.parents||{};
     if(p?.status!=='approved'||!Object.hasOwn(links,uid))throw new ApiError(403,'Access denied');
     return (await tx.get(db.doc('student_results/'+studentId))).data()?.items||[];
    });return reply(200,{studentId,items:data});
   }
   if(req.method==='POST'&&path==='/api/parent/link-requests'){
    const body=await parseBody(req);
    if(!['parent','child'].includes(body.kind))throw new ApiError(400,'Invalid request kind');
    const code=String(body.targetCode||'').trim().toUpperCase();
    const codeOk=body.kind==='parent'?(code.length>=1&&code.length<=64&&!code.includes('/')):/^PAR-[0-9]{6}$/.test(code);
    if(!codeOk)throw new ApiError(400,'Invalid code');
    if(body.kind==='parent')await requireParent(db,uid);
    else{
     const mapping=(await db.doc('auth_identities/'+uid).get()).data();
     if(mapping?.role!=='student'||!safeId(mapping.studentId))throw new ApiError(403,'Verified student identity required');
    }
    await rateLimit(db,uid,'link-request',clock());
    const id=hash(uid,body.kind,code);
    await db.runTransaction(async tx=>{
     const ref=db.doc('parent_link_requests/'+id),old=(await tx.get(ref)).data();
     if(old?.status==='pending')return;
     tx.set(ref,{requesterUid:uid,kind:body.kind,targetCode:code,status:'pending',createdAt:FieldValue.serverTimestamp()});
    });return reply(202,{requestId:id,status:'pending'});
   }
   if(req.method==='POST'&&path==='/api/parent/channel-proof'){
    const body=await parseBody(req);
    if(!['telegram','whatsapp'].includes(body.channel))throw new ApiError(400,'Unsupported channel');
    await requireParent(db,uid);
    await rateLimit(db,uid,'channel-proof',clock());
    const proof=await issueChannelProof(db,uid,body.channel,clock());
    return reply(201,proof);
   }
   const review=/^\/api\/admin\/link-requests\/([a-f0-9]{64})\/review$/.exec(path);
   if(req.method==='POST'&&review){
    if(!isAdmin)throw new ApiError(403,'Admin required');
    const body=await parseBody(req);
    if(typeof body.approved!=='boolean'||body.approved&&body.relationshipVerified!==true)throw new ApiError(400,'Explicit relationship verification required');
    await rateLimit(db,uid,'link-review',clock());
    await db.runTransaction(async tx=>{
     const ref=db.doc('parent_link_requests/'+review[1]);const r=(await tx.get(ref)).data();
     if(!r||r.status!=='pending')throw new ApiError(409,'Request unavailable');
     if(!body.approved){tx.update(ref,{status:'rejected',reviewedBy:uid,reviewedAt:FieldValue.serverTimestamp()});return;}
     let parentUid,studentId,code;
     if(r.kind==='parent'){
      parentUid=r.requesterUid;code=r.targetCode;
      studentId=(await tx.get(db.doc('student_codes/'+code))).data()?.studentId;
     }else{
      const mapping=(await tx.get(db.doc('auth_identities/'+r.requesterUid))).data();
      if(mapping?.role!=='student')throw new ApiError(409,'Identity not verified');
      studentId=mapping.studentId;code=mapping.code;
      parentUid=(await tx.get(db.doc('parent_codes/'+r.targetCode))).data()?.uid;
     }
     if(!safeId(parentUid)||!safeId(studentId))throw new ApiError(409,'Identity unavailable');
     const parent=(await tx.get(db.doc('parents/'+parentUid))).data();
     const student=(await tx.get(db.doc('student_private/'+studentId))).data();
     if(parent?.status!=='approved'||!student||student.status!=='approved')throw new ApiError(409,'Approved accounts required');
     const now=FieldValue.serverTimestamp();
     tx.set(db.doc('parent_links/'+parentUid),{children:{[studentId]:{studentId,code,name:String(student.fullName||''),linkedBy:'admin',linkedAt:now}}},{merge:true});
     tx.set(db.doc('student_links/'+studentId),{parents:{[parentUid]:{parentUid,linkedBy:'admin',linkedAt:now}}},{merge:true});
     tx.update(ref,{status:'approved',reviewedBy:uid,reviewedAt:now});
     tx.set(db.doc('parent_notifications/'+parentUid+'/items/link-'+review[1]),{title:'تم اعتماد طلب الربط',body:'راجعت الإدارة صلة ولي الأمر ووافقت على الطلب.',createdAt:now,read:false});
    });return reply(200,{status:body.approved?'approved':'rejected'});
   }
   if(req.method==='POST'&&path==='/api/admin/unlink'){
    if(!isAdmin)throw new ApiError(403,'Admin required');
    const b=await parseBody(req);
    if(!safeId(b.parentUid)||!safeId(b.studentId))throw new ApiError(400,'Invalid identifiers');
    const batch=db.batch();
    // FieldPath prevents interpolation of account IDs into nested paths.
    const {FieldPath}=await import('firebase-admin/firestore');
    batch.update(db.doc('parent_links/'+b.parentUid),new FieldPath('children',b.studentId),FieldValue.delete());
    batch.update(db.doc('student_links/'+b.studentId),new FieldPath('parents',b.parentUid),FieldValue.delete());
    await batch.commit();return reply(200,{status:'unlinked'});
   }
   throw new ApiError(404,'Not found');
  }catch(e){
   if(e instanceof ApiError)return reply(e.status,{error:e.message});
   // Never include tokens, credentials, provider payloads or private records in errors.
   return reply(500,{error:'Request failed'});
  }
 };
}
