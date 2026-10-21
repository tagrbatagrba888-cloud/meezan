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

// يصل الإشعار والموقع مقفول → يظهر هنا
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  return self.registration.showNotification(d.title || 'إشعار جديد', {
    body: d.body || 'ميزان — اضغط لفتح الإشعارات',
    icon: 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png',
    image: d.image || undefined,
    tag: d.tag || 'meezan-notif',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: { url: d.url || 'index.html' }
  });
});

// الضغط على الإشعار يفتح الموقع
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || 'index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));