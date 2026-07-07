// Vrittih service worker — makes the app installable + resilient offline.
// Network-first (always fresh when online), cache fallback when offline.
const CACHE = "vrittih-v1"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (e) => {
  const req = e.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return          // don't touch cross-origin
  if (url.pathname.startsWith("/api/")) return             // never cache API calls

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req).then((m) => m || caches.match("/")))
  )
})
