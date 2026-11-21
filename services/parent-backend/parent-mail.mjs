// Fixed parent templates. Transport remains gated until owner approval/version activation.
export const PARENT_TEMPLATE_VERSION='parent-email-v1';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ENTRY='https://mee7an.vercel.app/login.html';
export function parentEmail(job){
 if(job.templateVersion!==PARENT_TEMPLATE_VERSION)throw Error('Unapproved template version');
 const n=job.studentName||'الطالب',p=job.parentName||'ولي الأمر',item=job.itemName||'الواجب';let subject,body;
 if(['exam_result','homework_result'].includes(job.reportType)){
  const kind=job.reportType==='exam_result'?'اختبار':'واجب';
  if(!Number.isFinite(job.score)||!Number.isFinite(job.totalScore)||job.totalScore<=0)throw Error('Invalid result');
  subject=`نتيجة جديدة لـ ${n}`;body=`مرحبًا ${p}، ظهرت نتيجة ${item} للطالب ${n}. الدرجة: ${job.score} من ${job.totalScore}.`;
 }else if(job.reportType==='homework_published'){subject=`واجب جديد لـ ${n}`;body=`مرحبًا ${p}، نُشر واجب جديد للطالب ${n}: ${item}.`;}
 else if(job.reportType==='homework_unsolved'){subject=`تذكير بواجب لم يُسلّم لـ ${n}`;body=`مرحبًا ${p}، واجب ${item} للطالب ${n} لم يُسجَّل تسليمه حتى الآن. يُرجى متابعته.`;}
 else throw Error('Unsupported report type');
 const footer='رسالة تلقائية من منصة ميزان بخصوص الأبناء المرتبطين بحسابك.';
 return {subject,text:`${body}\nعرض حساب ولي الأمر: ${ENTRY}\n${footer}`,html:`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f6f5;font-family:Tahoma,Arial,sans-serif"><div style="max-width:600px;margin:24px auto;padding:16px"><header style="background:#0b3d2e;color:white;padding:24px;border-radius:16px 16px 0 0;text-align:center"><h1 style="font-size:24px;margin:0">منصة ميزان | MEEZAN</h1></header><main style="background:white;padding:28px;border-radius:0 0 16px 16px"><h2 style="color:#0b3d2e;font-size:20px">${esc(subject)}</h2><p style="line-height:2;color:#333">${esc(body)}</p><p style="text-align:center;margin:28px 0"><a href="${ENTRY}" style="display:inline-block;background:#0b3d2e;color:white;text-decoration:none;border-radius:10px;padding:14px 24px">عرض حساب ولي الأمر</a></p><p style="font-size:12px;color:#777;line-height:1.8">${footer}</p></main></div></body></html>`};
}
export function brevoParentSender({apiKey,fetcher=fetch,approvedTemplateVersion}={}){
 return async job=>{
  if(!apiKey||approvedTemplateVersion!==PARENT_TEMPLATE_VERSION)throw Error('Parent mail transport held');
  const mail=parentEmail(job);
  const r=await fetcher('https://api.brevo.com/v3/smtp/email',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({sender:{email:'tagrbatagrba888@gmail.com',name:'منصة ميزان | MEEZAN'},to:[{email:job.destination}],subject:mail.subject,textContent:mail.text,htmlContent:mail.html})});
  if(!r.ok)return {sent:false,error:'provider-rejected-'+r.status};
  const receipt=await r.json();return {sent:!!receipt.messageId,providerMessageId:receipt.messageId||null};
 };
}
