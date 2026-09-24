const CACHE_NAME = 'lifeos-v4';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy.
//
// Pages (and Next's page data requests) go to the network first, falling
// back to the cache only when offline or slow. Serving them cache-first meant
// every deploy showed the previous version until a hard refresh.
//
// Build assets under /_next/static have content hashes in their names, so a
// cached copy can never be stale: those stay cache-first and cost nothing.
const NETWORK_TIMEOUT_MS = 2500;

function isPageRequest(request, url) {
  return request.mode === 'navigate' ||
    request.headers.get('RSC') === '1' ||
    url.searchParams.has('_rsc');
}

function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const fallback = () => caches.match(request).then((cached) => cached ||
      (request.mode === 'navigate' ? caches.match('/') : null) ||
      new Response('Offline', { status: 503 }));
    const timer = setTimeout(() => {
      fallback().then((cached) => {
        if (!settled && cached && cached.status !== 503) { settled = true; resolve(cached); }
      });
    }, NETWORK_TIMEOUT_MS);
    fetch(request).then((response) => {
      clearTimeout(timer);
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      if (!settled) { settled = true; resolve(response); }
    }).catch(() => {
      clearTimeout(timer);
      if (!settled) { settled = true; fallback().then(resolve); }
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Skip API requests and Google OAuth
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (isPageRequest(event.request, url)) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(cacheFirst(event.request));
  }
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Push notifications from the Pi (see lib/server/notifier.ts). The payload is
// { title, body, url, tag }; tag collapses repeats of the same notice.
self.addEventListener('push', (event) => {
  let data = { title: 'LifeOS', body: '', url: '/', tag: undefined };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

// Tapping a notification opens (or focuses) the app on the page it is about.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
