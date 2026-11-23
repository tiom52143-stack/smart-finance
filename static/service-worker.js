/* =========================================================================
   SMART FINANCE - Service Worker (Network-First untuk Pembaruan Instan)
   ========================================================================= */
const CACHE_NAME = 'smart-finance-cache-v3';
const STATIC_ASSETS = [
    '/',
    '/dashboard',
    '/static/css/variables.css',
    '/static/css/main.css',
    '/static/css/responsive.css',
    '/static/js/db-local.js',
    '/static/js/sync.js',
    '/static/js/pin-lock.js',
    '/static/js/charts.js',
    '/static/js/app.js',
    '/static/manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Strategi Network-First: selalu ambil versi terbaru jika online, pakai cache jika offline
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => caches.match(event.request))
    );
});
