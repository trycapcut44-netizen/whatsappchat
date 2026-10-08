const CACHE_NAME = 'wa-business-cache-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/chat.css',
  '/css/admin.css',
  '/js/chat.js',
  '/js/admin.js',
  '/manifest.json',
  '/admin-manifest.json',
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
  if (url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/login')) {
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

// Notification Click handler: Brings user directly back to the chat & triggers quick reply popup
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';

  // 1. If user used Android inline quick reply directly on the notification banner
  if (event.action === 'reply' && event.reply) {
    const replyText = (event.reply || '').trim();
    if (replyText) {
      event.waitUntil(
        fetch('/api/visitor/reply-from-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId: notifData.msg ? notifData.msg.visitorId : null,
            text: replyText
          })
        }).catch((err) => console.warn('Reply error:', err))
      );
      return;
    }
  }

  // 2. Normal tap: Open or focus chat window and show interactive reply popup
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If an existing window/tab is open, focus it and tell it to show the reply popup
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            if (focusedClient && 'postMessage' in focusedClient) {
              focusedClient.postMessage({
                type: 'OPEN_REPLY_POPUP',
                msg: notifData.msg
              });
            }
          });
        }
      }

      // If no window is currently open, open a new window with open_reply=true flag
      if (self.clients.openWindow) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        return self.clients.openWindow(`${targetUrl}${separator}open_reply=true`);
      }
    })
  );
});

// Optional Web Push support
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'WhatsApp Business', body: event.data ? event.data.text() : 'New message' };
  }

  const title = data.title || 'WhatsApp Business';
  const options = {
    body: data.body || 'New message received',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    tag: data.tag || 'wa_push_' + Date.now(),
    renotify: true,
    vibrate: [250, 100, 250, 100, 250],
    data: data
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
