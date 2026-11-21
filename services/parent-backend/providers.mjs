// Provider adapter source only. No invocation is scheduled or mounted.
// Enabling this gate is configuration, not owner authorization by itself.
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reportEmail(job){
 return {subject:job.title,text:String(job.title)+'\n'+String(job.body)+'\nبوابة ولي الأمر: https://mee7an.vercel.app/parent.html',html:'<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f5f1e8;font-family:Arial,sans-serif"><div style="max-width:560px;margin:24px auto;background:white;border-radius:16px;padding:28px"><h1 style="font-size:22px;color:#0b3d2e">منصة ميزان</h1><h2 style="font-size:20px">'+escape(job.title)+'</h2><p style="font-size:17px;line-height:1.9">'+escape(job.body)+'</p><p>للمتابعة، افتح بوابة ولي الأمر وسجّل الدخول من الصفحة الموحدة.</p><p><a href="https://mee7an.vercel.app/parent.html" style="display:inline-block;background:#0b3d2e;color:white;text-decoration:none;padding:12px 22px;border-radius:10px">فتح بوابة ولي الأمر</a></p><p style="font-size:12px;color:#66736d">هذا تقرير تعليمي لحساب ولي الأمر المرتبط بالطالب. يمكنك إدارة قنوات التقارير من حسابك بعد تفعيل الخدمة.</p></div></body></html>'};
}
export async function deliverProvider(job,{enabled=false,fetchImpl=fetch,brevoKey,telegramToken,bridgeUrl,bridgeToken,senderEmail,senderVerified=false}={}){
 if(!enabled)throw new Error('External report sends are disabled');
 let url,headers={'Content-Type':'application/json'},body;
 if(job.channel==='email'){
  if(!brevoKey||!senderVerified||!senderEmail||!/^\S+@\S+\.\S+$/.test(senderEmail)||!/^\S+@\S+\.\S+$/.test(job.destination||''))throw new Error('Verified email configuration required');
  url='https://api.brevo.com/v3/smtp/email';headers['api-key']=brevoKey;
  const m=reportEmail(job);body={sender:{name:'منصة ميزان',email:senderEmail},to:[{email:job.destination}],subject:m.subject,textContent:m.text,htmlContent:m.html};
 }else if(job.channel==='telegram'){
  if(!telegramToken||!/^\d{1,20}$/.test(job.destination||''))throw new Error('Private verified Telegram destination required');
  url='https://api.telegram.org/bot'+telegramToken+'/sendMessage';body={chat_id:job.destination,text:String(job.title)+'\n'+String(job.body),disable_web_page_preview:true};
 }else if(job.channel==='whatsapp'){
  if(!bridgeUrl||!bridgeToken||!/^\d{10,15}$/.test(job.destination||''))throw new Error('Verified WhatsApp configuration required');
  const endpoint=new URL(bridgeUrl);
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/')throw new Error('Trusted bridge origin required');
  url=endpoint.origin+'/send';headers.Authorization='Bearer '+bridgeToken;
  body={to:job.destination,text:String(job.title)+'\n'+String(job.body),idempotencyKey:job.id};
 }else throw new Error('Unsupported channel');
 let response;
 try{response=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});}
 catch{return {sent:false,retryable:false,error:'unknown-transport-outcome'};}
 if(response.status===429)return {sent:false,retryable:true,error:'rate-limited-before-acceptance'};
 if(!response.ok)return {sent:false,retryable:false,error:'provider-rejected-'+response.status};
 let data;try{data=await response.json();}catch{return {sent:false,retryable:false,error:'unknown-provider-receipt'};}
 const id=job.channel==='email'?data.messageId:job.channel==='telegram'?data.result?.message_id:data.messageId;
 if(job.channel==='telegram'&&data.ok!==true||!id)return {sent:false,retryable:false,error:'unknown-provider-receipt'};
 return {sent:true,providerMessageId:String(id)};
}
