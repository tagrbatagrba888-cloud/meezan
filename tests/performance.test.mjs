import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../sw-cache.js', import.meta.url), 'utf8');
function fixture() {
  const handlers = {}, buckets = new Map();
  let calls = 0;
  const caches = {
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const bucket = buckets.get(name);
      const key = r => typeof r === 'string' ? r : r.url;
      return {
        async match(r) { return bucket.get(key(r))?.clone(); },
        async put(r, value) { bucket.set(key(r), value.clone()); },
        async keys() { return [...bucket.keys()]; },
        async delete(r) { return bucket.delete(key(r)); },
        async addAll() {}
      };
    },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { return buckets.delete(name); }
  };
  vm.runInNewContext(source, {
    self: {location: {href: 'https://example.test/sw1.js'}, addEventListener(type, fn) { handlers[type] = fn; }},
    caches, URL, Response, setTimeout, clearTimeout,
    async fetch() { calls++; return new Response('image-or-page', {status: 200}); }
  });
  return {
    caches, buckets, calls: () => calls,
    async request(url, options = {}) {
      let response, lifetime;
      handlers.fetch({request: {url, method: 'GET', mode: 'cors', cache: 'default', ...options},
        respondWith(p) { response = p; }, waitUntil(p) { lifetime = p; }});
      if (!response) return null;
      const result = await response; await lifetime; return result;
    },
    async activate() { let p; handlers.activate({waitUntil(value) { p = value; }}); await p; }
  };
}
test('versioned local branding is cached without repeat network requests', async () => {
  const f=fixture(), url='https://example.test/meezan-logo.v1.webp';
  assert.equal((await f.request(url)).status,200); assert.equal(f.calls(),1);
  assert.equal((await f.request(url)).status,200); assert.equal(f.calls(),1);
  assert.ok(f.buckets.has('meezan-v2-20261121-brand'));
});
test('brand cache never changes account-page network-first behavior', async () => {
  const f=fixture(),url='https://example.test/parent.html';
  await f.request(url,{mode:'navigate'});await f.request(url,{mode:'navigate'});
  assert.equal(f.calls(),2);
});
test('external URLs, API-like requests and writes are not intercepted',async()=>{
  const f=fixture();
  assert.equal(await f.request('https://external.test/meezan-logo.v1.webp'),null);
  assert.equal(await f.request('https://example.test/api/account'),null);
  assert.equal(await f.request('https://example.test/meezan-logo.v1.webp',{method:'POST'}),null);
  assert.equal(f.calls(),0);
});
test('existing data caches survive activation and remain separate',async()=>{
  const f=fixture();await f.caches.open('meezan-v2-20261121-data');
  await f.request('https://example.test/meezan-icon-32.v1.png');await f.activate();
  assert.ok(f.buckets.has('meezan-v2-20261121-data'));
  assert.ok(f.buckets.has('meezan-v2-20261121-brand'));
});
