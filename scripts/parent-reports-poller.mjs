// Safety-held result projection. No email/Telegram/WhatsApp sends from this script.
// Production initialization also requires the backend activation flag and credentials.
import {services} from '../services/parent-backend/admin.mjs';
import {stageResult} from '../services/parent-backend/reports.mjs';
if(!process.argv.includes('--stage-only')){
 console.log('Parent reports held. Explicit --stage-only required; no provider sends are implemented.');
}else{
 const {db}=services();
 const meta=db.doc('parent_reports_meta/state');
 const baseline=!(await meta.get()).exists;
 for(const cfg of [
  {collection:'exam_subs',kind:'exam',id:'examId',name:'examName'},
  {collection:'homework_subs',kind:'homework',id:'homeworkId',name:'homeworkName'}
 ]){
  const items=(await db.doc(cfg.collection+'/all').get()).data()?.items||[];
  for(const s of items){
   if(s?.corrected!==true||!s.userId||!s[cfg.id])continue;
   const revision=String(s.correctedAt||s.score)+'/'+String(s.totalScore);
   await stageResult(db,{
    studentId:String(s.userId),resultId:cfg.kind+'-'+String(s[cfg.id]),revision,
    name:s[cfg.name]||'',studentName:s.userName||'الطالب',score:s.score,totalScore:s.totalScore,
    kind:cfg.kind,correctedAt:s.correctedAt||null
   },baseline);
  }
 }
 await meta.set({baselineDone:true,updatedAt:Date.now()},{merge:true});
 console.log('Private projections/jobs staged. No external messages sent.');
}
