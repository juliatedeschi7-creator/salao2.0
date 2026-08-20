self.addEventListener('install', event => {
  console.log('[SW] Instalando nova versão...')
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  console.log('[SW] Ativando nova versão...')

  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys.map(key => caches.delete(key))
        )
      })
      .then(() => {
        console.log('[SW] Cache limpo')
        return self.clients.claim()
      })
  )
})

self.addEventListener('push', event => {
  console.log('[SW] PUSH RECEBIDO')

  let data = {
    title: 'Organiza Salão',
    body: 'Você tem uma nova mensagem.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/salao'
  }

  try {
    if (event.data) {
      const recebido = event.data.json()

      console.log('[SW] Dados recebidos:', recebido)

      data = {
        ...data,
        ...recebido
      }
    }
  } catch (error) {
    console.error('[SW] Erro ao interpretar payload:', error)
  }

  const notificationOptions = {
    body: data.body,

    // Ícone que você já possui em /public
    icon: '/icon-192.png',

    // Badge que você já possui em /public
    badge: '/icon-192.png',

    data: {
      url: data.url || '/salao'
    }
  }

  console.log('[SW] Exibindo notificação:', notificationOptions)

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Organiza Salão',
      notificationOptions
    )
  )
})

self.addEventListener('notificationclick', event => {
  console.log('[SW] Notificação clicada')

  event.notification.close()

  const url =
    event.notification?.data?.url ||
    '/salao'

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {

      // Se o Organiza já estiver aberto,
      // tenta reutilizar a janela existente.
      for (const client of windowClients) {
        if ('focus' in client) {
          return client
            .navigate(url)
            .then(() => client.focus())
        }
      }

      // Caso não esteja aberto, abre uma nova janela.
      if (clients.openWindow) {
        return clients.openWindow(url)
      }

      return undefined
    })
  )
})

self.addEventListener('notificationclose', event => {
  console.log('[SW] Notificação fechada')
})