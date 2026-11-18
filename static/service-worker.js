/* =========================================================================
   SMART FINANCE - Service Worker (Offline Cache & Asset Management)
   ========================================================================= */
const CACHE_NAME = 'smart-finance-cache-v1';

const CORE_ASSETS = [
    '/',
    '/login',
    '/register',
    '/dashboard',
    '/income',
    '/expense',
    '/savings',
    '/budget',
    '/history',
    '/report',
    '/wallet',
    '/profile',
    '/settings',
    '/static/manifest.json',
    '/static/css/variables.css',
    '/static/css/main.css',
    '/static/css/responsive.css',
    '/static/js/db-local.js',
    '/static/js/sync.js',
    '/static/js/pin-lock.js',
    '/static/js/charts.js',
    '/static/js/app.js'
];

// Tahap Instalasi: Simpan aset inti ke cache tanpa gagal jika ikon belum tersedia
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                CORE_ASSETS.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[SW] Gagal pre-cache:', url, err);
                    })
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// Tahap Aktivasi: Bersihkan cache versi lama
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((oldName) => caches.delete(oldName))
            );
        }).then(() => self.clients.claim())
    );
});

// Strategi Fetch:
// 1. Endpoint /api/ dan /auth/ selalu lewat jaringan (data offline dikelola IndexedDB)
// 2. Navigasi halaman HTML memakai Network-First dengan fallback ke Cache
// 3. File statis (/static/) memakai Cache-First dengan pembaruan latar belakang
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

    // Navigasi Halaman HTML
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    const cloned = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request).then((cachedPage) => {
                        return cachedPage || caches.match('/dashboard') || caches.match('/');
                    });
                })
        );
        return;
    }

    // Aset Statis (CSS, JS, Gambar, Font)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const cloned = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});
