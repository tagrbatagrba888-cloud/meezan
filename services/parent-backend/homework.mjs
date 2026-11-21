// Homework notification eligibility. Input data must come from a trusted server
// through the authenticated worker. Legacy source data remains editable under inherited rules.
import {createHash} from 'node:crypto';
const eventKey=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function homeworkEvents({homework,student,submissions,now=Date.now(),reminderDelayDays=2,baseline=false}){
 if(baseline||homework?.status!=='published'||student?.status!=='approved')return [];
 if(!homework.id||!student.id)throw new Error('Stable IDs required');
 if(homework.grade&&homework.grade!==student.grade)return [];
 // Do not infer publication time from createdAt: drafts can exist before publication.
 const publishedAt=Date.parse(homework.publishedAt||'');
 if(!Number.isFinite(publishedAt)||publishedAt>now)throw new Error('Verified publication timestamp required');
 if(reminderDelayDays!==null&&![1,2].includes(reminderDelayDays))throw new Error('Explicit reminder choice required');
 const completed=submissions.some(s=>String(s.homeworkId)===String(homework.id)&&String(s.userId)===String(student.id)&&s.submitted===true);
 const events=[{type:'homework-published',key:eventKey(['published',homework.id,student.id,homework.publicationRevision||'1']),homeworkId:String(homework.id),studentId:String(student.id),title:'واجب جديد',body:String(homework.name||'واجب جديد'),publishedAt}];
 if(!completed&&reminderDelayDays!==null&&now>=publishedAt+reminderDelayDays*86400000){
  events.push({type:'homework-unsolved',key:eventKey(['unsolved',homework.id,student.id,homework.publicationRevision||'1']),homeworkId:String(homework.id),studentId:String(student.id),title:'تذكير بواجب لم يُسلّم',body:String(homework.name||'واجب')+' لم يُسلّم بعد.',publishedAt});
 }
 return events;
}
export async function stageHomeworkNotice(db,event,controls={enabled:true,channels:{inSite:true}}){
 if(!['homework-published','homework-unsolved'].includes(event.type)||!/^[a-f0-9]{64}$/.test(event.key))throw new Error('Invalid event');
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(event.studentId))throw new Error('Invalid student');
 return db.runTransaction(async tx=>{
  const ref=db.doc('parent_homework_events/'+event.key);
  if((await tx.get(ref)).exists)return {duplicate:true,notices:0};
  const links=(await tx.get(db.doc('student_links/'+event.studentId))).data()?.parents||{};
  const parents=[];
  for(const uid of Object.keys(links)){
   const p=(await tx.get(db.doc('parents/'+uid))).data();const channels=(await tx.get(db.doc('parent_channels/'+uid))).data()||{};if(p?.status==='approved')parents.push({uid,parent:p,channels});
  }
  let notices=0;
  if(controls.enabled)for(const {uid,parent,channels} of parents){
   if(controls.channels.inSite){notices++;tx.set(db.doc('parent_student_notifications/'+uid+'/students/'+event.studentId+'/items/'+event.key),{...event,read:false,createdAt:Date.now()});}
   const destinations={};
   if(controls.channels.email&&parent.emailVerified===true&&parent.email)destinations.email=parent.email;
   for(const channel of ['telegram','whatsapp'])if(controls.channels[channel]&&channels[channel]?.enabled&&channels[channel]?.verifiedAt)destinations[channel]=channels[channel].destination;
   for(const [channel,destination] of Object.entries(destinations)){
    const jobId=eventKey([event.key,uid,channel]);
    tx.set(db.doc('parent_delivery_jobs/'+jobId),{eventId:event.key,parentUid:uid,studentId:event.studentId,channel,destination,title:event.title,body:event.body,status:'pending',attempts:0,createdAt:Date.now()});
   }
  }
  tx.create(ref,{...event,noticeCount:notices,createdAt:Date.now(),status:'private-notices-staged'});
  // Only private durable jobs are staged; no external send occurs here.
  return {duplicate:false,notices};
 });
}
