// Service Worker للإشعارات — ارفعه بجانب user-support.html في نفس المجلد
// نفس منطق sw1.js تمامًا (علشان أي واحد منهم يكون هو الشغّال تبقى النتيجة واحدة)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAmkCOrSaklhUiDdDfZCpSDQNmMYP-Gdw0",
  authDomain: "qanon-c716d.firebaseapp.com",
  projectId: "qanon-c716d",
  storageBucket: "qanon-c716d.firebasestorage.app",
  messagingSenderId: "757756130875",
  appId: "1:757756130875:web:63c53534c6843e2a29ce1e"
});

const messaging = firebase.messaging();
const LOGO = 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png';
// الروابط النسبية دايمًا بتتحل من جذر الموقع (مش من scope بتاع الـ service worker)
const ROOT = self.location.origin + '/';
const PUSH_SERVER_HOST = 'vercel-server-nine-tau.vercel.app';
const parseList = (v) => { try { const a = JSON.parse(v); return Array.isArray(a) ? a : null; } catch (e) { return null; } };

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// نستنتج الصفحة من نوع الإشعار (tag = معرّف الإشعار اللي بتبعته صفحة الرسائل)
function fromTag(tag) {
  tag = String(tag || '');
  if (tag.indexOf('chat_') === 0) { const i = tag.lastIndexOf('_'); if (i > 5) return 'rasael.html?c=' + encodeURIComponent(tag.slice(5, i)); }
  if (tag.indexOf('call_') === 0) return 'rasael.html?call=' + encodeURIComponent(tag.slice(5));
  if (tag.indexOf('listen_') === 0) return 'rasael.html';
  return null;
}

// يحوّل أي رابط لعنوان كامل على دومين الموقع (ويصلّح لو السيرفر لزّق دومينه على الرابط)
function resolveTarget(u) {
  try {
    const base = ROOT;
    const x = new URL(u || 'index.html', base);
    if (x.host === PUSH_SERVER_HOST) return new URL(x.pathname.replace(/^\/+/, '') + x.search + x.hash, base).href;
    return x.href;
  } catch (e) { return new URL('index.html', ROOT).href; }
}
async function safeTarget(url) {
  try { if (/\/(rasael|user-support)\.html$/.test(new URL(url).pathname)) return url; } catch (e) {}
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (r.status === 404) return new URL('asharat.html', ROOT).href;
  } catch (e) { /* أوفلاين */ }
  return url;
}


// ===== الرد من الإشعار (زي واتساب) =====
const FS_DB = 'projects/qanon-c716d/databases/(default)/documents';
const FS_KEY = 'AIzaSyAmkCOrSaklhUiDdDfZCpSDQNmMYP-Gdw0';
const PUSH_API = 'https://vercel-server-nine-tau.vercel.app/api/send';
const REPLY_ACTIONS = [{ action: 'reply', type: 'text', title: 'رد', placeholder: 'اكتب ردك...' }];

// معرّف المستخدم الحالي: صفحة الرسائل بتحفظه في الكاش (وبنجرب نستنتجه من الـ tag لو مش موجود)
async function getMe(tag) {
  try { const c = await caches.open('rsl-me'); const r = await c.match('/__rsl_me'); if (r) { const t = (await r.text()).trim(); if (t) return t; } } catch (e) {}
  tag = String(tag || ''); const i = tag.lastIndexOf('_');
  return (tag.indexOf('chat_') === 0 && i > 5) ? tag.slice(i + 1) : null;
}

async function sendReply(chatId, me, text) {
  const doc = FS_DB + '/chats/' + chatId;
  const g = await fetch('https://firestore.googleapis.com/v1/' + doc + '?key=' + FS_KEY);
  if (!g.ok) throw new Error('chat ' + g.status);
  const cj = await g.json();
  const vals = (cj.fields && cj.fields.members && cj.fields.members.arrayValue && cj.fields.members.arrayValue.values) || [];
  if (!vals.map((v) => v.stringValue).includes(me)) throw new Error('not a member'); // نتأكد إنك عضو في المحادثة
  const msgId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const body = { writes: [
    { update: { name: doc + '/messages/' + msgId, fields: { senderId: { stringValue: me }, type: { stringValue: 'text' }, text: { stringValue: text } } },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }], currentDocument: { exists: false } },
    { update: { name: doc, fields: { lastText: { stringValue: text }, lastSenderId: { stringValue: me } } },
      updateMask: { fieldPaths: ['lastText', 'lastSenderId'] },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }, { fieldPath: 'reads.`' + me + '`', setToServerValue: 'REQUEST_TIME' }] }
  ] };
  const r = await fetch('https://firestore.googleapis.com/v1/' + FS_DB + ':commit?key=' + FS_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('commit ' + r.status);
  // إشعار الطرف الآخر — لازم ننتظره (await) عشان المتصفح ما يقتل الـ service worker قبل ما يتبعت
  const other = vals.map((v) => v.stringValue).find((m) => m !== me);
  if (other) await notifyOther(chatId, me, other, cj, text, msgId);
}

// ===== إرسال إشعار للطرف الآخر (نفس منطق notifyUser في صفحة الرسائل) =====
const PUSH_KEY = 'Meezan2026Secret';
const fsv = (v) => typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : Array.isArray(v) ? { arrayValue: { values: v.map(fsv) } } : { stringValue: String(v) };
const fsFields = (o) => { const f = {}; for (const k in o) f[k] = fsv(o[k]); return f; };
const fsGet = async (path) => { try { const r = await fetch('https://firestore.googleapis.com/v1/' + FS_DB + '/' + path + '?key=' + FS_KEY); return r.ok ? r.json() : null; } catch (e) { return null; } };
const fsStr = (d, k) => (d && d.fields && d.fields[k] && d.fields[k].stringValue) || '';
async function notifyOther(chatId, me, other, cj, text, msgId) {
  try {
    // لو الطرف الآخر كاتم الإشعارات منك
    const mm = cj.fields && cj.fields.muted && cj.fields.muted.mapValue && cj.fields.muted.mapValue.fields;
    if (mm && mm[other] && mm[other].booleanValue) return;
    // الاسم اللي يظهر له: اسمك المحفوظ عنده، وإلا اسمك الحقيقي
    let sender = fsStr(await fsGet('contact_names/' + encodeURIComponent(other + '__' + me)), 'name');
    if (!sender) sender = fsStr(await fsGet('profiles/' + encodeURIComponent(me)), 'name');
    if (!sender) sender = 'مستخدم';
    const id = 'chat_' + chatId + '_' + other, now = new Date().toISOString();
    const hdr = { 'Content-Type': 'application/json' };
    const put = (path, fields, mask) => fetch('https://firestore.googleapis.com/v1/' + FS_DB + '/' + path + '?' + (mask || []).map((m) => 'updateMask.fieldPaths=' + m + '&').join('') + 'key=' + FS_KEY, { method: 'PATCH', headers: hdr, body: JSON.stringify({ fields }) });
    const a = await put('notifications/' + id, fsFields({ id, title: sender, body: String(text).slice(0, 140), type: 'page', url: 'rasael.html?c=' + chatId, mediaType: 'page', senderId: me, senderName: sender, createdAt: now, target: 'custom', targetLabel: other, recipients: [other], urgent: false, kind: 'chat' }));
    if (!a.ok) throw new Error('notif ' + a.status);
    const un = await fsGet('user_notifications/' + encodeURIComponent(other));
    const ids = ((un && un.fields && un.fields.notifIds && un.fields.notifIds.arrayValue && un.fields.notifIds.arrayValue.values) || []).map((v) => v.stringValue);
    const unread = parseInt((un && un.fields && un.fields.unreadCount && un.fields.unreadCount.integerValue) || '0', 10) + (ids.includes(id) ? 0 : 1);
    const f2 = fsFields({ userId: other, notifIds: [id].concat(ids.filter((x) => x !== id)).slice(0, 100), unreadCount: unread });
    f2.updatedAt = { timestampValue: now };
    const b = await put('user_notifications/' + encodeURIComponent(other), f2, ['userId', 'notifIds', 'unreadCount', 'updatedAt']);
    if (!b.ok) throw new Error('user_notif ' + b.status);
    const r = await fetch(PUSH_API, { method: 'POST', keepalive: true, headers: Object.assign({ 'x-admin-key': PUSH_KEY }, hdr), body: JSON.stringify({ notifId: id, resend: true, urgent: false, alarm: false, requireInteraction: false }) });
    if (!r.ok) throw new Error('push ' + r.status);
  } catch (e) {
    console.log('[reply] notify failed, fallback', e && e.message);
    // خطة بديلة: السيرفر يبعت الإشعار من الرسالة نفسها
    try { await fetch(PUSH_API, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatMsg: { chatId, msgId } }) }); } catch (x) {}
  }
}

async function handleReply(event) {
  const n = event.notification, d = n.data || {}, text = String(event.reply || '').trim(), tag = d.tag || n.tag || '';
  let ok = false;
  if (text) {
    try {
      let chatId = null;
      try { chatId = new URL(resolveTarget(d.url)).searchParams.get('c'); } catch (e) {}
      const me = await getMe(tag);
      if (chatId && me) { await sendReply(chatId, me, text); ok = true; }
    } catch (e) { console.log('[reply] failed', e && e.message); }
  }
  return self.registration.showNotification(n.title, {
    body: ok ? 'أنت: ' + text : 'تعذّر إرسال الرد — اضغط لفتح المحادثة',
    icon: n.icon, badge: n.badge, tag: n.tag, renotify: false, silent: true, dir: 'rtl', lang: 'ar',
    actions: ok ? REPLY_ACTIONS : undefined, data: d
  });
}

// وصول رسالة والموقع مقفول أو في الخلفية
messaging.onBackgroundMessage((payload) => {
  const d = Object.assign({}, (payload && payload.notification) || {}, (payload && payload.data) || {});
  const urgent = d.urgent === '1' || d.urgent === 'true' || d.urgent === true;
  const target = d.url || fromTag(d.tag) || (d.tag ? 'asharat.html?n=' + encodeURIComponent(d.tag) : 'user-support.html');
  return self.registration.showNotification(d.title || 'الدعم الفني | MEEZAN', {
    body: d.body || 'لديك رسالة جديدة',
    icon: LOGO,
    badge: LOGO,
    image: d.image || undefined,
    tag: d.tag || 'meezan-support-chat',
    renotify: true,
    requireInteraction: urgent,
    dir: 'rtl',
    lang: 'ar',
    vibrate: urgent ? (parseList(d.vibrate) || [800, 300, 800, 300, 800, 300, 1200]) : [200, 100, 200],
    actions: String(d.tag || '').indexOf('chat_') === 0 ? REPLY_ACTIONS : undefined,
    data: { url: target, tag: d.tag || '' }
  });
});

// الضغط على الإشعار
self.addEventListener('notificationclick', (event) => {
  if (event.action === 'reply') { event.waitUntil(handleReply(event)); return; }
  event.notification.close();
  const data = event.notification.data || {};
  const tag = data.tag || '';
  let raw = resolveTarget(data.url);
  const last = new URL(raw).pathname.split('/').pop();
  const derived = fromTag(tag);
  if (derived && (!data.url || last === '' || last === 'index.html' || last === 'asharat.html')) raw = resolveTarget(derived);
  event.waitUntil((async () => {
    const origin = new URL(ROOT).origin;
    const sameOrigin = new URL(raw).origin === origin;
    const url = sameOrigin ? await safeTarget(raw) : raw;
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (sameOrigin) {
      const tu = new URL(url), mine = list.filter((w) => w.url.startsWith(origin));
      const page = tu.pathname.split('/').pop();
      if (page === 'rasael.html' || page === 'user-support.html') {
        const ex = mine.find((w) => new URL(w.url).pathname === tu.pathname);
        if (ex) {
          try { await ex.focus(); } catch (e) {}
          const c = tu.searchParams.get('c');
          if (c && page === 'rasael.html') ex.postMessage({ type: 'open-chat', c });
          return;
        }
      }
      for (const c of mine) {
        try { const nc = await c.navigate(url); if (nc) { await nc.focus(); return; } } catch (e) {}
      }
    }
    return self.clients.openWindow(url);
  })());
});
