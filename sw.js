// ============================================================
// 🚀 MEEZAN PWA — Service Worker
// ============================================================

const CACHE_VERSION = 'meezan-v1.0.0';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

// الملفات الأساسية التي تُخزَّن مؤقتاً
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/login2.html',
  '/index.html',
  '/index1.html',
  '/admins.html',
  '/users.html',
  '/moalm.html',
  '/manifest.json',
  'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// ============================================================
// 📦 Install — تثبيت الـ SW
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.log('[SW] Some assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// 🔄 Activate — تنظيف الكاش القديم
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('meezan-') && name !== CACHE_STATIC && name !== CACHE_DYNAMIC)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================
// 🌐 Fetch — استراتيجية الشبكة والكاش
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل طلبات Firebase و Google APIs (لأنها realtime)
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      request.method !== 'GET') {
    return;
  }

  // استراتيجية: Network First (للـ HTML)
  if (request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // استراتيجية: Cache First (للأيقونات، CSS، JS)
  event.respondWith(cacheFirstStrategy(request));
});

// ============================================================
// 🥇 Network First — يجرب الشبكة أولاً ثم الكاش
// ============================================================
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    // صفحة offline احتياطية
    return new Response(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>غير متصل | MEEZAN</title>
        <style>
          body {
            font-family: 'Cairo', sans-serif;
            background: linear-gradient(135deg, #0B3D2E, #1E7A5A);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
            padding: 20px;
          }
          .box {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            padding: 40px 30px;
            max-width: 400px;
            border: 2px solid #C9A961;
          }
          h1 { font-size: 24px; margin-bottom: 10px; color: #C9A961; }
          p { font-size: 14px; opacity: 0.9; line-height: 1.6; }
          .icon { font-size: 60px; margin-bottom: 20px; }
          button {
            margin-top: 20px;
            padding: 12px 24px;
            border: none;
            border-radius: 12px;
            background: #C9A961;
            color: #0B3D2E;
            font-family: 'Cairo', sans-serif;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="icon">📡</div>
          <h1>لا يوجد اتصال بالإنترنت</h1>
          <p>تحقق من اتصالك ثم أعد المحاولة</p>
          <button onclick="location.reload()">إعادة المحاولة</button>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// ============================================================
// 🥈 Cache First — يجرب الكاش أولاً ثم الشبكة
// ============================================================
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return new Response('Offline', { status: 503 });
  }
}

// ============================================================
// 🔔 Push Notifications (اختياري)
// ============================================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ميزان | MEEZAN';
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png',
    badge: 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png',
    vibrate: [200, 100, 200],
    data: data.url || '/'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || '/'));
});

console.log('[SW] MEEZAN Service Worker Loaded ✓');