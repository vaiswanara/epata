/* ===============================
   e-PATA PWA Service Worker
   Works on GitHub Pages + Subdomain
   =============================== */

const BASE_PATH = self.location.pathname.replace("service-worker.js", "");
const CACHE_NAME = "epata2-pwa-v3";

const urlsToCache = [
  BASE_PATH,
  BASE_PATH + "index.html",
  BASE_PATH + "style.css",
  BASE_PATH + "script.js",
  BASE_PATH + "icons/icon-192.png",
  BASE_PATH + "icons/icon-512.png"
];

/* INSTALL */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

/* ACTIVATE */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/* FETCH */
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;

      return fetch(event.request).catch(() => {
        // Offline navigation fallback
        if (event.request.mode === "navigate") {
          return caches.match(BASE_PATH + "index.html");
        }
      });
    })
  );
});
