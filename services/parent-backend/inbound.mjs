// Called only from a trusted provider receiver, never a caller-supplied webhook
// that has not passed provider-specific authentication.
import {consumeChannelProof} from './channels.mjs';
export async function telegramProofUpdate(db,update,{verifiedTransport=false}={}){
 if(!verifiedTransport)throw new Error('Verified bot transport required');
 const msg=update?.message;
 if(msg?.chat?.type!=='private'||!msg.from||String(msg.from.id)!==String(msg.chat.id)||msg.from.is_bot)return {ignored:true};
 const m=/^\/start\s+([A-Za-z0-9_-]{43})$/.exec(String(msg.text||'').trim());
 if(!m)return {ignored:true};
 return consumeChannelProof(db,{token:m[1],channel:'telegram',destination:String(msg.chat.id),privateChat:true});
}
export async function whatsappProofMessage(db,message,{verifiedSocket=false}={}){
 if(!verifiedSocket)throw new Error('Authenticated WhatsApp socket required');
 const jid=message?.key?.remoteJid;
 if(message?.key?.fromMe||typeof jid!=='string'||!/^\d{10,15}@s\.whatsapp\.net$/.test(jid)||message.key.participant)return {ignored:true};
 const text=message.message?.conversation||message.message?.extendedTextMessage?.text||'';
 const m=/^LINK\s+([A-Za-z0-9_-]{43})$/i.exec(String(text).trim());
 if(!m)return {ignored:true};
 return consumeChannelProof(db,{token:m[1],channel:'whatsapp',destination:jid.split('@')[0],privateChat:true});
}
