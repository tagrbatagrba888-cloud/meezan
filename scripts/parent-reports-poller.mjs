// Independent parent job. Shared workflow serialization keeps the mail job first.
import {authenticatedWorkerStore} from '../services/parent-backend/client-store.mjs';
import {projectLegacyData} from '../services/parent-backend/worker.mjs';
import {dispatchParentEmails} from '../services/parent-backend/parent-dispatch.mjs';
import {brevoParentSender,PARENT_TEMPLATE_VERSION} from '../services/parent-backend/parent-mail.mjs';
const stage=process.argv.includes('--stage-only'),dispatch=process.argv.includes('--dispatch-email');
if(!stage&&!dispatch){console.log('Parent worker held. No messages sent.');process.exit(0);}
let db;
try{
 db=await authenticatedWorkerStore();
 await db.doc('parent_reports_meta/heartbeat').set({status:'running',startedAt:Date.now(),runUrl:process.env.MAILER_RUN_URL||'',mode:dispatch?'email':'stage-only'},{merge:true});
 const result=await projectLegacyData(db);
 let delivery={processed:0,reason:'dispatch_disabled'};
 if(dispatch){
  if(process.env.MEEZAN_PARENT_EMAIL_ENABLED!=='yes'||process.env.MEEZAN_PARENT_TEMPLATE_VERSION!==PARENT_TEMPLATE_VERSION)throw Error('Parent email activation not configured');
  const raw=(await db.doc('parent_report_settings/global').get()).data();
  if(raw?.approvedTemplateVersion!==PARENT_TEMPLATE_VERSION)throw Error('Approved template not configured');
  const send=brevoParentSender({apiKey:process.env.BREVO_API_KEY,approvedTemplateVersion:process.env.MEEZAN_PARENT_TEMPLATE_VERSION});
  delivery=await dispatchParentEmails(db,{enabled:true,send,limit:5});
 }
 await db.doc('parent_reports_meta/heartbeat').set({status:'ok',completedAt:Date.now(),mode:dispatch?'email':'stage-only',result,delivery},{merge:true});
 console.log(JSON.stringify({result,delivery}));process.exit(0);
}catch{
 if(db)await db.doc('parent_reports_meta/heartbeat').set({status:'error',completedAt:Date.now(),error:'parent_job_failed'},{merge:true}).catch(()=>{});
 console.error('Parent job stopped. Inspect parent job states before any retry.');process.exit(1);
}
