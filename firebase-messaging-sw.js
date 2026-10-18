// Service Worker للإشعارات — ارفعه بجانب user-support.html في نفس المجلد
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

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// وصول رسالة والموقع مقفول أو في الخلفية
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  return self.registration.showNotification(d.title || 'الدعم الفني | MEEZAN', {
    body: d.body || 'لديك رسالة جديدة',
    icon: LOGO,
    badge: LOGO,
    tag: 'meezan-support-chat',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: { url: d.url || 'user-support.html' }
  });
});

// الضغط على الإشعار يفتح المحادثة
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const dir = self.location.origin + self.location.pathname.replace(/[^/]*$/, '');
  const target = new URL((event.notification.data && event.notification.data.url) || 'user-support.html', dir).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('user-support') && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});