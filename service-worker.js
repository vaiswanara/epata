const CACHE_VERSION = "epata-v10";
const STATIC_CACHE = "static-" + CACHE_VERSION;
const DYNAMIC_CACHE = "dynamic-" + CACHE_VERSION;

const STATIC_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./config.json",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
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

  // 1️⃣ HTML pages → NETWORK FIRST (MOST IMPORTANT FIX)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (!res.ok || res.status !== 200) return res;
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  const url = new URL(event.request.url);

  // 🚫 NEVER CACHE: config.json & Google Sheets (Always Network)
  if (
    url.pathname.endsWith("config.json") || 
    url.hostname.includes("docs.google.com") || 
    url.hostname.includes("googleusercontent.com")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2️⃣ CSS/JS/Images → CACHE FIRST
  event.respondWith(
    caches.match(event.request)
      .then(cacheRes => {
        return cacheRes || fetch(event.request).then(fetchRes => {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, fetchRes.clone());
            return fetchRes;
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
