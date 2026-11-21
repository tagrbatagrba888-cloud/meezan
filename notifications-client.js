import { doc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Serialize recipient-feed updates instead of replacing a concurrently edited array.
// Authorization still belongs in Firestore rules and the planned trusted backend.
export async function enqueueNotification(db, recipient, notificationId) {
  const userId = String(recipient), id = String(notificationId);
  const ref = doc(db, 'user_notifications', userId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const list = Array.isArray(data.notifIds) ? data.notifIds : [];
    const notifIds = [id, ...list.filter(value => value !== id)].slice(0, 100);
    const readIds = (Array.isArray(data.readIds) ? data.readIds : []).filter(value => value !== id && notifIds.includes(value));
    const deletedIds = (Array.isArray(data.deletedIds) ? data.deletedIds : []).filter(value => value !== id && notifIds.includes(value));
    const unreadCount = notifIds.filter(value => !readIds.includes(value) && !deletedIds.includes(value)).length;
    tx.set(ref, { userId, notifIds, readIds, deletedIds, unreadCount, updatedAt: serverTimestamp() }, { merge: true });
  });
}
