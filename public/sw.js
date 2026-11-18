const CACHE_NAME = 'construction-billing-v2';
const APP_ROOT = new URL('./', self.registration.scope).href;
const PRECACHE = [
  APP_ROOT,
  new URL('manifest.webmanifest', APP_ROOT).href,
  new URL('icons/app-192.png', APP_ROOT).href,
  new URL('icons/app-512.png', APP_ROOT).href
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('construction-billing-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(APP_ROOT, response.clone())));
          return response;
        })
        .catch(() => caches.match(APP_ROOT))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())));
      return response;
    }))
  );
});
