self.addEventListener('install', e => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// Não intercepta fetch de API - deixa passar direto
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  
  // Ignora requisições de API completamente
  if (url.pathname.startsWith('/api/')) return
  
  // Para o resto, busca normalmente
  e.respondWith(fetch(e.request).catch(() => fetch(e.request)))
})

self.addEventListener('push', e => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'Organiza Salão', body: e.data.text() } }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Organiza Salão', {
      body: data.body || '',
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const c = cs.find(c => c.url.includes(self.location.origin))
      if (c) { c.focus(); c.navigate(url) }
      else clients.openWindow(url)
    })
  )
})
