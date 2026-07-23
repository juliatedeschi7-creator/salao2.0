self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

// ⚠️ ESSENCIAL: No Next.js, é mais seguro NÃO interceptar o fetch com cache agressivo 
// a menos que você esteja fazendo um PWA offline avançado. Deixe o navegador gerenciar o fetch puro:
self.addEventListener('fetch', (event) => {
  // Apenas deixa o navegador lidar com todas as requisições nativamente
  return
})

self.addEventListener('push', (event) => {
  let data = { title: 'Organiza Salão', body: 'Você tem uma nova notificação!', url: '/' }

  if (event.data) {
    try {
      data = event.data.json()
    } catch (err) {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', inclusive: true }).then((windowClients) => {
      // Tenta focar em uma aba já aberta do app
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          if ('navigate' in client) {
            return client.navigate(targetUrl)
          }
          return
        }
      }
      // Se nenhuma aba estiver aberta, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
