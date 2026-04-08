const SHELL_CACHE = 'runway-shell-v2';
const DATA_CACHE = 'runway-data-v1';

const SHELL_ASSETS = [
  './',
  'css/main.css',
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

const DATA_PATHS = ['data/data.json', 'data/transactions.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== SHELL_CACHE && k !== DATA_CACHE)
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isData = DATA_PATHS.some(p => url.pathname.endsWith(p));

  if (isData) {
    // Network-first for data files — always try fresh, fall back to cache
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(DATA_CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for app shell
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
});
