/* 小兔头节拍器 · service worker
 * HTML: network-first (so deploys show up), assets: cache-first.
 */
var CACHE = 'xiaotutou-v3';

var PRECACHE = [
  '/',
  '/index.html',
  '/en/',
  '/en/index.html',
  '/manifest.json',
  '/js/engine.js',
  '/images/bunny.png',
  '/images/bunny-192.png',
  '/images/bunny-512.png',
  '/assets/sounds/click-strong.mp3',
  '/assets/sounds/click-weak.mp3',
  '/assets/sounds/click-uniform.mp3'
];

(function () {
  var langs = ['zh', 'en'];
  for (var L = 0; L < langs.length; L++) {
    for (var i = 1; i <= 16; i++) {
      var id = i < 10 ? '0' + i : String(i);
      PRECACHE.push('/assets/sounds/voice/' + langs[L] + '/' + id + '.mp3');
    }
  }
})();

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE;
      }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isHtml(url) {
  var path = new URL(url).pathname;
  return path === '/' || path === '/en/' || path === '/en' ||
    path.endsWith('.html');
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isHtml(req.url)) {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
