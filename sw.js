/* Test app only: no Firebase, no external network dependencies. */
const CACHE_NAME = 'koryosan-test-v1';
const PRECACHE = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(x => x.startsWith('koryosan-test-') && x !== CACHE_NAME).map(x => caches.delete(x)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone()).catch(() => {});
      return response;
    } catch (err) {
      return await cache.match(event.request) || (event.request.mode === 'navigate' ? await cache.match('./index.html') : null) || Response.error();
    }
  })());
});
