// Cóndor — hand-rolled service worker
// Versioned cache name: bump CACHE_VER to force re-install.
const CACHE_VER = 'condor-v1';

const APP_SHELL = [
  '/',
  '/anadir',
  '/categorias',
  '/ajustes',
  '/historico',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

// Never cache the FX API — always go to network, fail gracefully.
const NEVER_CACHE = ['api.frankfurter.app'];

function shouldSkipCache(url) {
  return NEVER_CACHE.some((host) => url.includes(host));
}

// ── Install: precache the app shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VER)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: clean up old cache versions ────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VER)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Never intercept non-GET or cross-origin FX requests
  if (request.method !== 'GET' || shouldSkipCache(url)) {
    return; // fall through to network
  }

  // Navigation: network-first → cache → root shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VER).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/'))
        ),
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate
  if (url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.open(CACHE_VER).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          });
          return cached || networkFetch;
        }),
      ),
    );
  }
});
