import {PARENT_TEMPLATE_VERSION} from './parent-mail.mjs';
// Re-read mutable legacy eligibility during the atomic claim. No stale reminders.
export async function parentEventEligible(db,tx,job,now){
 if(job.templateVersion!==PARENT_TEMPLATE_VERSION)return false;
 const read=async p=>(await tx.get(db.doc(p))).data();
 const users=(await read('users/all'))?.items||[];
 const student=users.find(x=>String(x.id)===job.studentId);
 if(!student||student.isDisabled===true)return false;
 if(['exam_result','homework_result'].includes(job.reportType)){
  const kind=job.reportType==='exam_result'?'exam':'homework',idKey=kind+'Id';
  const rows=(await read((kind==='exam'?'exam_subs':'homework_subs')+'/all'))?.items||[];
  return rows.some(x=>String(x.userId)===job.studentId&&kind+'-'+String(x[idKey])===job.resultId&&x.corrected===true&&x.score===job.score&&x.totalScore===job.totalScore&&String(x.correctedAt||x.score)+'/'+x.totalScore===job.revision);
 }
 const h=((await read('homeworks/all'))?.items||[]).find(x=>String(x.id)===job.homeworkId);
 if(!h||h.status!=='published'||(h.grade&&h.grade!==student.grade))return false;
 const state=await read('parent_homework_state/'+job.homeworkId);
 if(!state||state.observedAt!==job.publishedAt||state.baselineExisting)return false;
 if(job.reportType==='homework_published')return true;
 if(job.reportType!=='homework_unsolved'||now<job.publishedAt+172800000)return false;
 const rows=(await read('homework_subs/all'))?.items||[];
 return !rows.some(x=>String(x.homeworkId)===job.homeworkId&&String(x.userId)===job.studentId&&x.submitted===true);
}
