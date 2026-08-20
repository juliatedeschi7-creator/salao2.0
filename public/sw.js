// ============================================================
// ORGANIZA SALÃO — SERVICE WORKER
// Web Push / PWA
// ============================================================

const CACHE_NAME = 'organiza-salao-v2'

// ============================================================
// INSTALL
// ============================================================

self.addEventListener('install', event => {
  console.log('[SW] Service Worker instalado')

  event.waitUntil(
    self.skipWaiting()
  )
})

// ============================================================
// ACTIVATE
// ============================================================

self.addEventListener('activate', event => {
  console.log('[SW] Service Worker ativado')

  event.waitUntil(
    self.clients.claim()
  )
})

// ============================================================
// PUSH
// ============================================================

self.addEventListener('push', event => {
  console.log('[SW] PUSH recebido')

  event.waitUntil(
    (async () => {
      let data = {
        title: 'Organiza Salão',
        body: 'Você tem uma nova notificação.',
        icon: '/icon.png',
        badge: '/icon.png',
        url: '/salao'
      }

      try {
        if (event.data) {
          const texto = event.data.text()

          console.log('[SW] Payload recebido:', texto)

          try {
            const json = JSON.parse(texto)

            if (json && typeof json === 'object') {
              data = {
                ...data,
                ...json
              }
            }
          } catch (jsonError) {
            console.log(
              '[SW] Payload não era JSON válido:',
              jsonError
            )

            if (texto) {
              data.body = texto
            }
          }
        }

        const title =
          data.title ||
          'Organiza Salão'

        const body =
          data.body ||
          'Você tem uma nova notificação.'

        const icon =
          data.icon ||
          '/icon.png'

        const badge =
          data.badge ||
          '/icon.png'

        const url =
          data.url ||
          '/salao'

        console.log('[SW] Preparando notificação:', {
          title,
          body,
          icon,
          badge,
          url
        })

        // ========================================================
        // MOSTRA A NOTIFICAÇÃO
        // ========================================================

        await self.registration.showNotification(
          title,
          {
            body,
            icon,
            badge,

            // Guarda a URL para ser usada quando
            // o usuário tocar na notificação.
            data: {
              url
            },

            // Ajuda a evitar várias notificações
            // iguais acumuladas.
            tag: 'organiza-salao-push',

            renotify: true
          }
        )

        console.log('[SW] NOTIFICAÇÃO MOSTRADA COM SUCESSO')

      } catch (error) {
        console.error(
          '[SW] ERRO AO PROCESSAR PUSH:',
          error
        )

        // ========================================================
        // FALLBACK
        // ========================================================
        //
        // Se alguma informação do payload estiver inválida,
        // ainda tentamos mostrar uma notificação simples.
        //

        try {
          await self.registration.showNotification(
            'Organiza Salão',
            {
              body: 'Você tem uma nova notificação.',
              icon: '/icon.png',
              badge: '/icon.png'
            }
          )

          console.log(
            '[SW] FALLBACK DE NOTIFICAÇÃO EXECUTADO'
          )

        } catch (fallbackError) {
          console.error(
            '[SW] ERRO NO FALLBACK:',
            fallbackError
          )
        }
      }
    })()
  )
})

// ============================================================
// NOTIFICATION CLICK
// ============================================================

self.addEventListener('notificationclick', event => {
  console.log('[SW] Notificação clicada')

  event.notification.close()

  event.waitUntil(
    (async () => {
      try {
        const notificationData =
          event.notification.data || {}

        const targetUrl =
          notificationData.url ||
          '/salao'

        console.log(
          '[SW] URL da notificação:',
          targetUrl
        )

        const absoluteUrl =
          new URL(
            targetUrl,
            self.location.origin
          ).href

        // ======================================================
        // PROCURA UMA JANELA DO ORGANIZA SALÃO JÁ ABERTA
        // ======================================================

        const windowClients =
          await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
          })

        for (const client of windowClients) {
          try {
            if (
              client.url &&
              client.url.startsWith(self.location.origin)
            ) {
              if ('focus' in client) {
                await client.focus()
              }

              // Tenta navegar a janela existente
              if (
                'navigate' in client &&
                client.url !== absoluteUrl
              ) {
                await client.navigate(absoluteUrl)
              }

              return
            }
          } catch (error) {
            console.log(
              '[SW] Erro ao reutilizar janela:',
              error
            )
          }
        }

        // ======================================================
        // SE NÃO EXISTIR JANELA, ABRE UMA NOVA
        // ======================================================

        if (self.clients.openWindow) {
          await self.clients.openWindow(
            absoluteUrl
          )
        }

      } catch (error) {
        console.error(
          '[SW] ERRO AO ABRIR NOTIFICAÇÃO:',
          error
        )

        // Fallback para a página principal
        try {
          if (self.clients.openWindow) {
            await self.clients.openWindow(
              '/salao'
            )
          }
        } catch (fallbackError) {
          console.error(
            '[SW] Erro no fallback do clique:',
            fallbackError
          )
        }
      }
    })()
  )
})

// ============================================================
// MESSAGE
// ============================================================

self.addEventListener('message', event => {
  console.log(
    '[SW] Mensagem recebida:',
    event.data
  )

  if (
    event.data &&
    event.data.type === 'SKIP_WAITING'
  ) {
    self.skipWaiting()
  }
})