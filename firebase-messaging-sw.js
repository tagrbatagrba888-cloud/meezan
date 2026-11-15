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
    const base = self.registration.scope;
    const x = new URL(u || 'index.html', base);
    if (x.host === PUSH_SERVER_HOST) return new URL(x.pathname.replace(/^\/+/, '') + x.search + x.hash, base).href;
    return x.href;
  } catch (e) { return new URL('index.html', self.registration.scope).href; }
}
async function safeTarget(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (r.status === 404) return new URL('asharat.html', self.registration.scope).href;
  } catch (e) { /* أوفلاين */ }
  return url;
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
    data: { url: target, tag: d.tag || '' }
  });
});

// الضغط على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const tag = data.tag || '';
  let raw = resolveTarget(data.url);
  const last = new URL(raw).pathname.split('/').pop();
  const derived = fromTag(tag);
  if (derived && (!data.url || last === '' || last === 'index.html' || last === 'asharat.html')) raw = resolveTarget(derived);
  event.waitUntil((async () => {
    const origin = new URL(self.registration.scope).origin;
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
