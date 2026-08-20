// ============================================================
// ORGANIZA SALÃO - SERVICE WORKER
// Push Notifications
// ============================================================

const CACHE_VERSION = 'organiza-salao-v2'

// ============================================================
// INSTALL
// ============================================================

self.addEventListener('install', event => {
  console.log('[SW PUSH] Service Worker instalado')

  event.waitUntil(
    self.skipWaiting()
  )
})

// ============================================================
// ACTIVATE
// ============================================================

self.addEventListener('activate', event => {
  console.log('[SW PUSH] Service Worker ativado')

  event.waitUntil(
    self.clients.claim()
  )
})

// ============================================================
// PUSH RECEBIDO
// ============================================================

self.addEventListener('push', event => {
  console.log('[SW PUSH] ========================================')
  console.log('[SW PUSH] PUSH RECEBIDO')
  console.log('[SW PUSH] ========================================')

  event.waitUntil(
    (async () => {
      try {
        // --------------------------------------------------------
        // Ler os dados enviados pelo servidor
        // --------------------------------------------------------

        let data = {}

        if (event.data) {
          try {
            data = event.data.json()

            console.log(
              '[SW PUSH] Payload recebido:',
              data
            )
          } catch (jsonError) {
            console.log(
              '[SW PUSH] Payload não era JSON. Tentando texto...'
            )

            try {
              const texto = event.data.text()

              data = {
                title: 'Organiza Salão',
                body: texto || 'Você tem uma nova notificação.'
              }

              console.log(
                '[SW PUSH] Texto recebido:',
                texto
              )
            } catch (textError) {
              console.error(
                '[SW PUSH] Não foi possível ler o payload:',
                textError
              )
            }
          }
        }

        // --------------------------------------------------------
        // Dados da notificação
        // --------------------------------------------------------

        const titulo =
          data?.title ||
          '🔔 Organiza Salão'

        const mensagem =
          data?.body ||
          'Você tem uma nova notificação.'

        const url =
          data?.url ||
          data?.data?.url ||
          '/salao'

        console.log(
          '[SW PUSH] Título:',
          titulo
        )

        console.log(
          '[SW PUSH] Mensagem:',
          mensagem
        )

        console.log(
          '[SW PUSH] URL:',
          url
        )

        // --------------------------------------------------------
        // Opções da notificação
        // --------------------------------------------------------

        const opcoes = {
          body: mensagem,

          // Use um arquivo que realmente exista no seu projeto.
          icon: '/icon.png',

          badge: '/icon.png',

          tag: 'organiza-salao',

          renotify: true,

          requireInteraction: false,

          data: {
            url: url,
            tipo:
              data?.tipo ||
              data?.data?.tipo ||
              'notificacao'
          }
        }

        console.log(
          '[SW PUSH] Chamando showNotification...'
        )

        // --------------------------------------------------------
        // EXIBIR NOTIFICAÇÃO
        // --------------------------------------------------------

        await self.registration.showNotification(
          titulo,
          opcoes
        )

        console.log(
          '[SW PUSH] NOTIFICAÇÃO EXIBIDA COM SUCESSO'
        )

      } catch (error) {
        console.error(
          '[SW PUSH] ERRO AO PROCESSAR PUSH:',
          error
        )

        // ------------------------------------------------------
        // Última tentativa de fallback
        // ------------------------------------------------------

        try {
          await self.registration.showNotification(
            '🔔 Organiza Salão',
            {
              body: 'Você tem uma nova notificação.',
              icon: '/icon.png',
              badge: '/icon.png',
              data: {
                url: '/salao'
              }
            }
          )

          console.log(
            '[SW PUSH] FALLBACK EXIBIDO COM SUCESSO'
          )

        } catch (fallbackError) {
          console.error(
            '[SW PUSH] ERRO TAMBÉM NO FALLBACK:',
            fallbackError
          )
        }
      }
    })()
  )
})

// ============================================================
// CLIQUE NA NOTIFICAÇÃO
// ============================================================

self.addEventListener('notificationclick', event => {
  console.log(
    '[SW PUSH] Usuário clicou na notificação'
  )

  event.notification.close()

  const url =
    event.notification?.data?.url ||
    '/salao'

  event.waitUntil(
    (async () => {
      try {
        const windowClients =
          await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
          })

        // ------------------------------------------------------
        // Procurar uma janela do Organiza já aberta
        // ------------------------------------------------------

        for (const client of windowClients) {
          if (
            client.url &&
            'focus' in client
          ) {
            try {
              await client.focus()

              // Tenta navegar para o destino
              if (
                'navigate' in client &&
                url
              ) {
                await client.navigate(url)
              }

              return
            } catch (error) {
              console.log(
                '[SW PUSH] Não foi possível focar/navegar:',
                error
              )
            }
          }
        }

        // ------------------------------------------------------
        // Nenhuma janela aberta
        // ------------------------------------------------------

        if (
          self.clients.openWindow
        ) {
          await self.clients.openWindow(url)
        }

      } catch (error) {
        console.error(
          '[SW PUSH] Erro ao clicar na notificação:',
          error
        )
      }
    })()
  )
})

// ============================================================
// MESSAGE
// ============================================================

self.addEventListener('message', event => {
  console.log(
    '[SW PUSH] Mensagem recebida:',
    event.data
  )

  if (
    event.data &&
    event.data.type === 'SKIP_WAITING'
  ) {
    self.skipWaiting()
  }
})

// ============================================================
// FETCH
// ============================================================

// Não interceptamos os requests da aplicação.
// O Service Worker fica responsável principalmente
// pelas notificações Push.