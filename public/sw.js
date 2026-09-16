self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  // This app intentionally does not provide offline caching. Remove caches
  // created by older workers so every launch loads the current deployment.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('nianrenji-')).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Keep a network-only fetch handler for broad PWA install compatibility.
// Nothing is read from or written to Cache Storage.
const DELIVERY_SHARE_DB = 'nrt-delivery-share-target'
const DELIVERY_SHARE_STORE = 'incoming'

const saveIncomingShare = (record) => new Promise((resolve, reject) => {
  const request = indexedDB.open(DELIVERY_SHARE_DB, 1)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(DELIVERY_SHARE_STORE)) db.createObjectStore(DELIVERY_SHARE_STORE, { keyPath: 'id' })
  }
  request.onerror = () => reject(request.error)
  request.onsuccess = () => {
    const db = request.result
    const transaction = db.transaction(DELIVERY_SHARE_STORE, 'readwrite')
    transaction.objectStore(DELIVERY_SHARE_STORE).put(record)
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { const error = transaction.error; db.close(); reject(error) }
  }
})

const receiveDeliveryShare = async (request) => {
  const form = await request.formData()
  const rawFiles = form.getAll('files').filter((value) => value instanceof File)
  await saveIncomingShare({
    id: `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: String(form.get('title') || ''),
    text: String(form.get('text') || ''),
    url: String(form.get('url') || ''),
    files: rawFiles,
    fileNames: rawFiles.map((file) => file.name),
    fileTypes: rawFiles.map((file) => file.type),
    createdAt: Date.now()
  })
  return Response.redirect('/?delivery-share=1', 303)
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (event.request.method === 'POST' && url.searchParams.get('delivery-share') === '1') {
    event.respondWith(receiveDeliveryShare(event.request).catch(() => Response.redirect('/?delivery-share=1&delivery-error=1', 303)))
    return
  }
  event.respondWith(fetch(event.request))
})

self.addEventListener('sync', (event) => {
  if (event.tag !== 'nianrenji-keep-alive-probe') return
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: 'keep-alive-sync', time: Date.now() }))
  }))
})
