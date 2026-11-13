// sw1.js — ضعه في نفس مجلد login.html و index.html (جذر الموقع)
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

// v2 — يصل الإشعار والموقع مقفول → يظهر هنا
const NOTIF_PAGE = 'asharat.html';
const parseList = (v) => { try { const a = JSON.parse(v); return Array.isArray(a) ? a : null; } catch (e) { return null; } };

messaging.onBackgroundMessage((payload) => {
  // نقرأ البيانات من أي مكان وصلت فيه (data أو notification) عشان ما يظهرش إشعار عام فاضي
  const d = Object.assign({}, (payload && payload.notification) || {}, (payload && payload.data) || {});
  console.log('[sw1] push payload:', JSON.stringify(payload));
  const urgent = d.urgent === '1' || d.urgent === 'true' || d.urgent === true;
  // لو الرابط ناقص نفتح صفحة الإشعارات على نفس الإشعار — مش الرئيسية
  const target = d.url || (NOTIF_PAGE + (d.tag ? '?n=' + encodeURIComponent(d.tag) : ''));
  return self.registration.showNotification(d.title || 'إشعار جديد', {
    body: d.body || 'ميزان — اضغط لفتح الإشعارات',
    icon: 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png',
    badge: 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png',
    image: d.image || undefined,
    tag: d.tag || 'meezan-notif',
    renotify: true,
    requireInteraction: urgent,
    silent: false,
    dir: 'rtl',
    lang: 'ar',
    vibrate: urgent ? (parseList(d.vibrate) || [800, 300, 800, 300, 800, 300, 1200]) : [200, 100, 200],
    data: { url: target }
  });
});

// يحوّل أي رابط لعنوان كامل على دومين الموقع نفسه (ويصلّح لو السيرفر لزّق دومينه على الرابط)
const PUSH_SERVER_HOST = 'vercel-server-nine-tau.vercel.app';
function resolveTarget(u) {
  try {
    const base = self.registration.scope;
    const x = new URL(u || 'index.html', base);
    if (x.host === PUSH_SERVER_HOST) {
      return new URL(x.pathname.replace(/^\/+/, '') + x.search + x.hash, base).href;
    }
    return x.href;
  } catch (e) { return new URL('index.html', self.registration.scope).href; }
}

// لو الصفحة المطلوبة مش موجودة (404) نرجع لصفحة الإشعارات بدل الشاشة السوداء
async function safeTarget(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (r.status === 404) return new URL('asharat.html', self.registration.scope).href;
  } catch (e) { /* أوفلاين: نكمل بالرابط كما هو */ }
  return url;
}

// الضغط على الإشعار يفتح الصفحة المطلوبة
// لو في تاب مفتوح للموقع نحوّله للصفحة (تبقى الجلسة محفوظة)، وإلا نفتح تاب جديد
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = resolveTarget(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const sameOrigin = new URL(raw).origin === new URL(self.registration.scope).origin;
    const url = sameOrigin ? await safeTarget(raw) : raw;
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const origin = new URL(self.registration.scope).origin;
    if (sameOrigin) {
      for (const c of list.filter((w) => w.url.startsWith(origin))) {
        try {
          const nc = await c.navigate(url);
          if (nc) { await nc.focus(); return; }
        } catch (e) { /* نجرب اللي بعده */ }
      }
    }
    return clients.openWindow(url);
  })());
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));