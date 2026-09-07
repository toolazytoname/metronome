/* 小兔头节拍器 · service worker
 * HTML: network-first (so deploys show up), assets: cache-first.
 */
var CACHE = 'xiaotutou-v7';

var PRECACHE = [
  '/',
  '/index.html',
  '/en/',
  '/en/index.html',
  '/manifest.json',
  '/en/manifest.json',
  '/js/engine.js',
  '/js/prefs.js',
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

var HTML_ROUTES = {
  '/': 1,
  '/en': 1,
  '/en/': 1,
  '/about': 1,
  '/about/': 1,
  '/about/en': 1,
  '/about/en/': 1,
  '/privacy': 1,
  '/privacy/': 1,
  '/support': 1,
  '/support/': 1,
  '/en/privacy': 1,
  '/en/privacy/': 1,
  '/en/support': 1,
  '/en/support/': 1
};

function isHtml(url) {
  var path = new URL(url).pathname;
  if (path.endsWith('.html')) return true;
  return !!HTML_ROUTES[path];
}

function isCacheableResponse(res) {
  return !!(res && res.ok && res.status === 200 && res.type === 'basic');
}

/** English paths stay English; do not dump every /en/* URL onto the homepage if a more specific cache hit exists. */
function languageHome(pathname) {
  if (pathname === '/en' || pathname.indexOf('/en/') === 0 ||
      pathname === '/about/en' || pathname === '/about/en/') {
    return '/en/index.html';
  }
  return '/index.html';
}

function htmlOfflineFallback(request) {
  var path = new URL(request.url).pathname;
  return caches.match(request).then(function (exact) {
    if (exact) return exact;
    return caches.match(request, { ignoreSearch: true }).then(function (samePath) {
      if (samePath) return samePath;
      return caches.match(languageHome(path));
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isHtml(req.url)) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (isCacheableResponse(res)) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return htmlOfflineFallback(req);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (isCacheableResponse(res)) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
