/* Shared fetch policy for the single messaging + offline service worker. */
(() => {
  const VERSION = 'meezan-v2-20261121';
  const SHELL = VERSION + '-shell';
  const DATA = VERSION + '-data';
  const BRAND = VERSION + '-brand';
  const BASE = new URL('./', self.location.href);
  const local = path => new URL(path, BASE).href;
  // All entries exist in the shipped repository. Optional content is lazy-loaded.
  const REQUIRED = ['index.html', 'login.html', 'manifest.json', 'presence.js'];
  const MAX_PAGES = 40;
  const MAX_DATA = 16;
  async function store(name, request, response, max) {
    if (!response || response.status !== 200 || response.type === 'opaque') return;
    const cache = await caches.open(name);
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map(key => cache.delete(key)));
  }
  self.addEventListener('install', event => {
    // Fail installation if a required shell file is missing, leaving the old SW active.
    event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(REQUIRED.map(local))));
  });
  self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('meezan-') && name !== SHELL && name !== DATA && name !== BRAND).map(name => caches.delete(name)))));
  });
  self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
    const name = url.pathname.slice(BASE.pathname.length);
    const isPage = request.mode === 'navigate';
    const isCode = /\.(?:js|css|webmanifest)$/.test(name) || name === 'manifest.json';
    const isBrand = /^meezan-(?:logo|icon-\d+)\.v1\.(?:png|webp)$/.test(name);
    const isData = ['quran.json', 'tafsir.json', 'asbab.json', 'erab.json', 'lessons.json'].includes(name);
    if (!isPage && !isCode && !isData && !isBrand) return;
    const cacheName = isBrand ? BRAND : isData ? DATA : SHELL;
    async function network() {
      const response = await fetch(request, {cache: 'no-cache'});
      if (response.status >= 500) throw new Error('Server unavailable');
      await store(cacheName, request, response, isBrand ? 8 : isData ? MAX_DATA : MAX_PAGES);
      return response;
    }
    let update;
    const responsePromise = (async () => {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(request);
      // Versioned branding is immutable; account pages still use the network policy below.
      if (isBrand && cached) return cached;
      // JSON explicitly revalidated by the page must reach the network.
      if (isData && cached && request.cache !== 'no-cache' && request.cache !== 'reload') {
        update = network();
        return cached;
      }
      let timer;
      update = network();
      try {
        if (!cached) return await update;
        return await Promise.race([update, new Promise(resolve => {timer = setTimeout(() => resolve(cached), 4000);})]);
      } catch (err) {
        if (cached) return cached;
        if (!isPage) return new Response('Offline', {status: 503});
        return new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>غير متصل</title><body><h1>لا يوجد اتصال بالإنترنت</h1><p>افتح هذه الصفحة مرة أثناء الاتصال، ثم حاول مجدداً.</p><button onclick="location.reload()">إعادة المحاولة</button></body></html>', {status: 503, headers: {'Content-Type':'text/html; charset=utf-8'}});
      } finally { clearTimeout(timer); }
    })();
    // Register the lifetime extension synchronously, before the first await.
    event.respondWith(responsePromise);
    event.waitUntil(responsePromise.then(() => update).catch(() => {}));
  });
})();
