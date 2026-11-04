// Loaded before generateSW's precache route. Only video Range requests are
// intercepted; complete responses are installed by Workbox, never partial ones.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      !/\.(mp4|webm)$/i.test(url.pathname) || !request.headers.has('range')) return

  event.respondWith((async () => {
    // Restrict lookup to this registration's precache. ignoreSearch handles
    // Workbox's __WB_REVISION__ cache keys for non-hashed assets as well.
    const names = await caches.keys()
    const cacheName = names.find((name) => name.startsWith('workbox-precache-') &&
      name.endsWith(self.registration.scope))
    const response = cacheName && await caches.match(request.url, { cacheName, ignoreSearch: true })
    if (!response || response.status !== 200) return fetch(request)

    const blob = await response.blob()
    const match = /^bytes=(\d*)-(\d*)$/i.exec(request.headers.get('range').trim())
    const start = match?.[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match?.[2]))
    const end = match?.[1] && match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) || start > end || start >= blob.size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } })
    }
    const headers = new Headers(response.headers)
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Content-Range', `bytes ${start}-${end}/${blob.size}`)
    headers.set('Content-Length', String(end - start + 1))
    return new Response(blob.slice(start, end + 1), { status: 206, headers })
  })())
  // Prevent the later Workbox listener from calling respondWith a second time.
  event.stopImmediatePropagation()
})
