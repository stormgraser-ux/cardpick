const SHELL_CACHE = 'runway-shell-v4';

const SHELL_ASSETS = [
  './',
  'css/main.css',
  'js/config.js',
  'js/db.js',
  'js/auth.js',
  'js/data-manager.js',
  'js/pick.js',
  'js/cards.js',
  'js/caps.js',
  'js/dashboard.js',
  'js/bills.js',
  'js/gf-board.js',
  'js/digest.js',
  'js/app.js',
  'manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== SHELL_CACHE)
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase API — always network, never cache
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Supabase JS CDN — cache for offline shell
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('supabase')) {
    e.respondWith(
      caches.match(e.request).then(r => r ||
        fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
