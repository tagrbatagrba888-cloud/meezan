import {test} from 'node:test';import assert from 'node:assert/strict';import {deliverProvider,reportEmail} from './providers.mjs';
const job={id:'test-job',channel:'email',destination:'fixture@example.invalid',title:'واجب جديد <x>',body:'اختبار & فقط'};
const config={enabled:true,brevoKey:'synthetic-only',senderEmail:'sender@example.invalid',senderVerified:true};
test('no network request without explicit delivery gate',async()=>{let called=false;await assert.rejects(deliverProvider(job,{fetchImpl:()=>{called=true;}}));assert.equal(called,false);});
test('email adapter escapes content, uses verified sender and returns receipt',async()=>{
 const mail=reportEmail(job);assert.ok(mail.html.includes('&lt;x&gt;'));assert.ok(mail.html.includes('&amp;'));assert.ok(!mail.html.includes('<x>'));
 const r=await deliverProvider(job,{...config,fetchImpl:async(url,options)=>{assert.equal(url,'https://api.brevo.com/v3/smtp/email');assert.equal(options.redirect,'error');return {ok:true,status:201,json:async()=>({messageId:'synthetic-receipt'})};}});assert.equal(r.providerMessageId,'synthetic-receipt');
});
test('unverified sender or group destinations blocked without requests',async()=>{
 await assert.rejects(deliverProvider(job,{...config,senderVerified:false}));
 await assert.rejects(deliverProvider({...job,channel:'telegram',destination:'-100123'},{enabled:true,telegramToken:'synthetic-only'}));
});
test('unknown transport result never automatically retried',async()=>{const r=await deliverProvider(job,{...config,fetchImpl:async()=>{throw new Error('synthetic timeout');}});assert.equal(r.retryable,false);assert.equal(r.sent,false);});
test('provider receipt required; rate limits can retry before acceptance',async()=>{
 const r=await deliverProvider(job,{...config,fetchImpl:async()=>({ok:true,status:200,json:async()=>({})})});assert.equal(r.sent,false);assert.equal(r.retryable,false);
 const limited=await deliverProvider(job,{...config,fetchImpl:async()=>({ok:false,status:429})});assert.equal(limited.retryable,true);
});
test('WhatsApp bridge must be HTTPS origin, cannot redirect or inject credentials',async()=>{
 await assert.rejects(deliverProvider({...job,channel:'whatsapp',destination:'201000000001'},{enabled:true,bridgeUrl:'http://localhost:8000',bridgeToken:'synthetic-only'}));
 await assert.rejects(deliverProvider({...job,channel:'whatsapp',destination:'201000000001'},{enabled:true,bridgeUrl:'https://user:pass@example.invalid/',bridgeToken:'synthetic-only'}));
});
