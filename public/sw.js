// Service Worker for static assets and media caching only (never caches API/Git data or HTML documents).
const STATIC_CACHE = 'yggit-static-v1'
const MEDIA_CACHE = 'yggit-media-v1'

const MEDIA_EXTENSIONS = /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|ogg|wav)$/i

function isImmutableNextStatic(url) {
  return url.pathname.startsWith('/_next/static/')
}

function isStaticMediaAsset(url) {
  if (url.pathname.startsWith('/world-tree-assets/') || url.pathname.startsWith('/assets/')) {
    return MEDIA_EXTENSIONS.test(url.pathname) || url.pathname.endsWith('.json')
  }
  return MEDIA_EXTENSIONS.test(url.pathname)
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  const allowed = new Set([STATIC_CACHE, MEDIA_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !allowed.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || request.mode === 'navigate') return

  // Content-hashed Next.js static bundles: CacheFirst
  if (isImmutableNextStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) {
          void cache.put(request, response.clone())
        }
        return response
      })
    )
    return
  }

  // Static images, icons, fonts, and world-tree assets: StaleWhileRevalidate
  if (isStaticMediaAsset(url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const networkPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              void cache.put(request, response.clone())
            }
            return response
          })
          .catch(() => cached)

        return cached || networkPromise
      })
    )
  }
})
