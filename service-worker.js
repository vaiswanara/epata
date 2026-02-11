const CACHE_VERSION = "epata-v24";
const STATIC_CACHE = "static-" + CACHE_VERSION;
const DYNAMIC_CACHE = "dynamic-" + CACHE_VERSION;

const STATIC_FILES = [
  "./",
  "./style.css",
  "./script.js",
  "./config.json",
  "./data/lessons_archive.json",
  "./data/app_urls.json",
  "./data/courses.json",
  "./data/quiz.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/logo.png",
  "./icons/srik.png",
  "./icons/donate.png"
];

/* INSTALL */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

/* ACTIVATE */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (!key.includes(CACHE_VERSION)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/* FETCH */
self.addEventListener("fetch", event => {
    const { request } = event;
    const url = new URL(request.url);

    // Strategy 1: Navigation requests (HTML)
    // Network first, fallback to cache. Ensures users get the latest app shell.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('./'))
        );
        return;
    }

    // Strategy 2: Data files (local JSON)
    // Stale-While-Revalidate. Serve from cache for speed, update in background.
    if (url.pathname.endsWith('.json') && !url.hostname.includes('github')) {
        event.respondWith(
            caches.open(STATIC_CACHE).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    const fetchPromise = fetch(request).then(networkResponse => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // Strategy 3: Dynamic content (Google Sheets, GitHub, Analytics)
    // Network only. Always fetch the latest version.
    if (url.hostname.includes('google.com') || 
        url.hostname.includes('githubusercontent') ||
        url.hostname.includes('googletagmanager') || 
        url.hostname.includes('google-analytics')) {
        event.respondWith(fetch(request));
        return;
    }

    // Strategy 4: Static assets (CSS, JS, images)
    // Cache first, fallback to network. These files don't change often.
    event.respondWith(
        caches.match(request).then(response => {
            return response || fetch(request).then(fetchResponse => {
                return caches.open(DYNAMIC_CACHE).then(cache => {
                    cache.put(request, fetchResponse.clone());
                    return fetchResponse;
                });
            });
        })
    );
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
