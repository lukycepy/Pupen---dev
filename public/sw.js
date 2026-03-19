const CACHE = 'pupen-sw-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['/manifest.json', '/logo.png', '/favicon.ico']))
      .then(() => self.skipWaiting())
      .catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .catch(() => {}),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const isStatic =
            url.pathname.startsWith('/_next/static') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.jpg') ||
            url.pathname.endsWith('.jpeg') ||
            url.pathname.endsWith('.webp') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.ico') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js') ||
            url.pathname === '/manifest.json';

          if (isStatic && res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    }),
  );
});

