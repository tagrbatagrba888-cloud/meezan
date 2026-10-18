// sw1.js — استقبال الإشعارات والموقع مغلق
// ملاحظة: إذا كان عندك كود كاش قديم في sw1.js ضعه في أعلى هذا الملف.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) {}
  const d = p.data || p.notification || p || {};
  const title = d.title || 'ميزان';
  const options = {
    body: d.body || 'لديك إشعار جديد',
    icon: d.icon || 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png',
    badge: d.icon || 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png',
    tag: d.tag || 'meezan-notif',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: { url: d.url || 'index.html' }
  };

  // يعرض الإشعار دائماً (في أي صفحة أو والموقع مغلق). نفس الـ tag مع إشعار الصفحة يمنع التكرار.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || 'index.html';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if ('focus' in c) { await c.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});