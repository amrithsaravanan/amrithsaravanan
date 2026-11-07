/* EXAM LAB service worker: offline asset caching. No network calls to third parties. */
const BUILD_ID = "__BUILD_ID__";
const PRECACHE = "__PRECACHE__";
const CACHE = 'examlab-' + BUILD_ID;

self.addEventListener('install', (event) => {
  const list = Array.isArray(PRECACHE) ? PRECACHE : ['./'];
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(list.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('examlab-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))));
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
