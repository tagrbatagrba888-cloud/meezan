// Cloud Function: يرسل Push عند إضافة إشعار جديد لمستخدم
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

if (!getApps().length) initializeApp(); // آمن حتى لو index.js استدعاها قبل ذلك
const db = getFirestore();

// ⚠️ يجب أن تطابق منطقة قاعدة Firestore (Firebase Console ← Firestore ← Data، بجانب اسم قاعدة البيانات).
// أمثلة: nam5 → 'us-central1' | eur3 → 'europe-west1' | me-central2 → 'me-central2'
const REGION = 'us-central1';

async function pushNew(userId, beforeIds, afterIds, deleted, read) {
  const fresh = afterIds.filter((id) => !beforeIds.includes(id) && !deleted.includes(id) && !read.includes(id));
  console.log('pushNew', { userId, fresh });
  if (!fresh.length) return;

  const tokSnap = await db.collection('push_tokens').where('userId', '==', userId).get();
  const tokens = tokSnap.docs.map((d) => d.id);
  console.log('tokens found:', tokens.length);
  if (!tokens.length) return;

  for (const nid of fresh) {
    const n = await db.collection('notifications').doc(nid).get();
    if (!n.exists) continue;
    const title = n.data().title || 'إشعار جديد';
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      data: { title, body: 'ميزان — اضغط لفتح الإشعارات', url: 'index.html', tag: nid },
      webpush: { headers: { Urgency: 'high', TTL: '86400' } },
      android: { priority: 'high' }
    });
    console.log('sent', { success: res.successCount, failure: res.failureCount });
    // حذف التوكنات الميتة
    const dead = [];
    res.responses.forEach((r, i) => {
      const c = r.error && r.error.code;
      if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') dead.push(tokens[i]);
    });
    await Promise.all(dead.map((t) => db.collection('push_tokens').doc(t).delete()));
  }
}

exports.onUserNotifUpdated = onDocumentUpdated({ document: 'user_notifications/{userId}', region: REGION }, (event) => {
  const b = event.data.before.data() || {};
  const a = event.data.after.data() || {};
  return pushNew(event.params.userId, b.notifIds || [], a.notifIds || [], a.deletedIds || [], a.readIds || []);
});

exports.onUserNotifCreated = onDocumentCreated({ document: 'user_notifications/{userId}', region: REGION }, (event) => {
  const a = event.data.data() || {};
  return pushNew(event.params.userId, [], a.notifIds || [], a.deletedIds || [], a.readIds || []);
});