// Minimal service worker — enables "Add to Home Screen" / installable app behavior.
// It caches only the app shell (this page + icons) so the app opens instantly,
// while all data (Firestore, Storage, sign-in) always goes over the network live.
//
// Network-first: every load tries the network first so you always get the
// latest version after an update, and only falls back to the cached copy if
// you're offline. (Previous versions were cache-first, which is why updates
// only ever showed up in Incognito — this fixes that for good.)
const CACHE_NAME = 'hse-tracker-shell-v5';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only handle same-origin GET requests; everything else (Firebase, Firestore, Storage,
  // CDN scripts, the weather forecast) always goes straight to the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Page loads (including worker QR links like ?worker=123) are all the same app page:
  // keep ONE cached copy under ./index.html instead of a copy per link.
  // Other pages (site.html — the scaffolding site form) keep their own cached copy.
  const isPage = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const cacheKey = isPage ? new URL('./index.html', self.registration.scope).href : req;

  event.respondWith(
    // cache:'no-cache' asks GitHub Pages whether the file changed, so a new version shows at once
    fetch(req, { cache: 'no-cache' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(cacheKey, { ignoreSearch: true }).then((hit) => hit || caches.match(req, { ignoreSearch: true })))
  );
});
