import {test,beforeEach,after} from 'node:test';import assert from 'node:assert/strict';
import {services} from './admin.mjs';import {issueChannelProof} from './channels.mjs';
import {telegramProofUpdate,whatsappProofMessage} from './inbound.mjs';
import {deleteApp,getApps} from 'firebase-admin/app';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Emulators required');
const {db}=services();
beforeEach(async()=>{await fetch('http://'+process.env.FIRESTORE_EMULATOR_HOST+'/emulator/v1/projects/demo-meezan/databases/(default)/documents',{method:'DELETE'});await db.doc('parents/P1').set({status:'approved'});});
after(async()=>{await db.terminate();for(const a of getApps())await deleteApp(a);});
test('unverified webhook/socket input cannot consume a channel proof',async()=>{
 await assert.rejects(telegramProofUpdate(db,{}));await assert.rejects(whatsappProofMessage(db,{}));
});
test('Telegram ignores group, forwarded identity mismatch and parent code',async()=>{
 const p=await issueChannelProof(db,'P1','telegram');
 assert.deepEqual(await telegramProofUpdate(db,{message:{chat:{id:'111',type:'group'},from:{id:'111'},text:'/start '+p.token}},{verifiedTransport:true}),{ignored:true});
 assert.deepEqual(await telegramProofUpdate(db,{message:{chat:{id:'111',type:'private'},from:{id:'222'},text:'/start '+p.token}},{verifiedTransport:true}),{ignored:true});
 assert.deepEqual(await telegramProofUpdate(db,{message:{chat:{id:'111',type:'private'},from:{id:'111'},text:'/start PAR-111111'}},{verifiedTransport:true}),{ignored:true});
 const r=await telegramProofUpdate(db,{message:{chat:{id:'111',type:'private'},from:{id:'111'},text:'/start '+p.token}},{verifiedTransport:true});assert.equal(r.uid,'P1');
});
test('WhatsApp proof accepted only from private inbound sender on verified socket',async()=>{
 const p=await issueChannelProof(db,'P1','whatsapp');
 const m={key:{remoteJid:'201000000001@s.whatsapp.net',fromMe:false},message:{conversation:'LINK '+p.token}};
 assert.deepEqual(await whatsappProofMessage(db,{...m,key:{...m.key,fromMe:true}},{verifiedSocket:true}),{ignored:true});
 assert.deepEqual(await whatsappProofMessage(db,{...m,key:{remoteJid:'123@g.us',participant:'201000000001@s.whatsapp.net'}},{verifiedSocket:true}),{ignored:true});
 const r=await whatsappProofMessage(db,m,{verifiedSocket:true});assert.equal(r.uid,'P1');assert.equal((await db.doc('parent_channels/P1').get()).data().whatsapp.destination,'201000000001');
 await assert.rejects(whatsappProofMessage(db,m,{verifiedSocket:true}));
});
