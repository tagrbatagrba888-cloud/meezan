// Cloud Function: يبعت إشعار للطالب لما موظف الدعم يرد عليه
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { FieldValue } = require('firebase-admin/firestore');

initializeApp();

exports.notifyUserOnSupportReply = onDocumentUpdated('support_chats/{sessionId}', async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  const oldMsgs = before.messages || [];
  const newMsgs = after.messages || [];
  if (newMsgs.length <= oldMsgs.length) return;

  const oldIds = new Set(oldMsgs.map((m) => m.id));
  const fresh = newMsgs.filter((m) => !oldIds.has(m.id) && m.sender && !['user', 'bot'].includes(m.sender) && !m.isSystem);
  if (!fresh.length) return;

  const tokens = after.fcmTokens || [];
  if (!tokens.length) return;

  const last = fresh[fresh.length - 1];
  const body = (last.text || (last.mediaUrl ? '📎 أرسل لك مرفقاً' : 'رسالة جديدة')).slice(0, 140);
  const title = last.senderName || 'الدعم الفني | MEEZAN';

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: { title, body, url: 'user-support.html' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } }
  });

  const bad = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')) bad.push(tokens[i]);
  });
  if (bad.length) await event.data.after.ref.update({ fcmTokens: FieldValue.arrayRemove(...bad) });
});