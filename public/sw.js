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

// ======= SUBSTITUA A PARTIR DAQUI =======
self.addEventListener('push', (event) => {
  console.log('[SW] Evento push disparado pelo navegador')

  let data = { 
    title: 'Organiza Salão', 
    body: 'Você tem uma nova notificação!', 
    url: '/' 
  }

  if (event.data) {
    try {
      data = event.data.json()
      console.log('[SW] Dados do push em JSON:', data)
    } catch (err) {
      console.log('[SW] Dados do push em texto puro:', event.data.text())
      data.body = event.data.text()
    }
  } else {
    console.log('[SW] Push recebido sem dados (payload vazio)')
  }

  const options = {
    body: data.body || 'Nova mensagem',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    tag: 'organiza-salao-notification',
    renotify: true
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Organiza Salão', options)
      .then(() => console.log('[SW] Notificação exibida com sucesso na tela!'))
      .catch((err) => console.error('[SW] Erro ao chamar showNotification:', err))
  )
})
// =========================================

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
