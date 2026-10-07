const CACHE_NAME = 'wa-business-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/chat.css',
  '/js/chat.js',
  '/manifest.json',
  '/assets/whatsapp-business.svg',
  '/assets/default-avatar.svg',
  '/assets/whatsapp-bg.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/cod-guarantee.svg'
];

// Install: Cache critical static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network first with Cache fallback for seamless real-time + offline support
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not cache socket.io, upload or API requests
  if (url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful static asset responses
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => cached || caches.match('/'));
      })
  );
});
