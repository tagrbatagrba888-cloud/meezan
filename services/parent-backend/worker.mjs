// Stage private result/homework projections and jobs. Never sends by itself.
import {createHash} from 'node:crypto';
import {reportSettings,settingsDocument} from './settings.mjs';
import {stageResult} from './reports.mjs';
import {homeworkEvents,stageHomeworkNotice} from './homework.mjs';
export async function projectLegacyData(db,{now=Date.now()}={}){
 const metaRef=db.doc('parent_reports_meta/functional-state');
 const baseline=!(await metaRef.get()).exists;
 const settings=reportSettings((await db.doc(settingsDocument).get()).data());
 const controlRef=db.doc('parent_reports_meta/settings-state');
 const {enabledAt:activationCutover,...scopeSettings}=settings;
 const fingerprint=createHash('sha256').update(JSON.stringify(scopeSettings)).digest('hex');
 const controlsChanged=(await controlRef.get()).data()?.fingerprint!==fingerprint;
 const suppress=baseline||controlsChanged;
 const users=(await db.doc('users/all').get()).data()?.items||[];
 let results=0,notices=0;
 for(const u of users){
  if(u?.id&&/^USR-[0-9]{6}$/.test(u.code||''))await db.doc('student_codes/'+u.code).set({studentId:String(u.id)});
 }
 for(const c of [{coll:'exam_subs',kind:'exam',id:'examId',name:'examName'},{coll:'homework_subs',kind:'homework',id:'homeworkId',name:'homeworkName'}]){
  const items=(await db.doc(c.coll+'/all').get()).data()?.items||[];
  for(const s of items){
   if(s?.corrected!==true||!s.userId||!s[c.id]||!Number.isFinite(s.score)||!Number.isFinite(s.totalScore)||s.totalScore<=0)continue;
   await stageResult(db,{studentId:String(s.userId),resultId:c.kind+'-'+String(s[c.id]),revision:String(s.correctedAt||s.score)+'/'+s.totalScore,name:s[c.name]||'',studentName:s.userName||'الطالب',score:s.score,totalScore:s.totalScore,kind:c.kind,correctedAt:s.correctedAt||null},suppress,{enabled:settings.enabled&&settings.types[c.kind+'_result'],channels:settings.channels});results++;
  }
 }
 const homework=(await db.doc('homeworks/all').get()).data()?.items||[];
 const submissions=(await db.doc('homework_subs/all').get()).data()?.items||[];
 for(const h of homework){
  if(!h?.id||!/^[A-Za-z0-9_-]{1,128}$/.test(String(h.id)))continue;
  const ref=db.doc('parent_homework_state/'+h.id),old=(await ref.get()).data();
  let state=old;
  if(!state||h.status!==state.status){
   state={status:h.status||'draft',observedAt:now,revision:(old?.revision||0)+1,baselineExisting:baseline&&h.status==='published'};
   await ref.set(state);
  }
  if(h.status!=='published'||state.baselineExisting||state.observedAt<settings.enabledAt)continue;
  // The old site has no reliable publishedAt. Start the 48h clock at first
  // observed publication, rather than using an old draft-created timestamp.
  for(const u of users){
   if(!u?.id||u.isDisabled===true)continue;
   const events=homeworkEvents({homework:{...h,publishedAt:new Date(state.observedAt).toISOString(),publicationRevision:String(state.revision)},student:{id:String(u.id),grade:u.grade,fullName:u.fullName,username:u.username,status:'approved'},submissions,now,reminderDelayDays:2,baseline});
   for(const e of events){const type=e.type==='homework-published'?'homework_published':'homework_unsolved';const staged=await stageHomeworkNotice(db,e,{enabled:!suppress&&settings.enabled&&settings.types[type],channels:settings.channels});notices+=staged.notices;}
  }
 }
 await controlRef.set({fingerprint,observedAt:now});
 await metaRef.set({baselineDone:true,updatedAt:now},{merge:true});
 return {baseline,results,notices};
}
