self.addEventListener('install', event => {
  console.log('[SW] Service Worker instalando')

  event.waitUntil(
    self.skipWaiting()
  )
})

self.addEventListener('activate', event => {
  console.log('[SW] Service Worker ativando')

  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys.map(key => caches.delete(key))
        )
      })
      .then(() => self.clients.claim())
      .then(() => {
        console.log('[SW] Service Worker ativo e controlando clientes')
      })
  )
})

self.addEventListener('push', event => {
  console.log('[SW] ========================================')
  console.log('[SW] PUSH RECEBIDO')
  console.log('[SW] ========================================')

  event.waitUntil(
    (async () => {
      let data = {
        title: 'Organiza Salão',
        body: 'Você tem uma nova notificação.',
        url: '/'
      }

      // ============================================================
      // 1. LÊ O PAYLOAD
      // ============================================================

      if (event.data) {
        try {
          data = event.data.json()

          console.log('[SW] Payload recebido:', data)
        } catch (jsonError) {
          console.log(
            '[SW] Payload não é JSON. Tentando texto.'
          )

          try {
            const texto = event.data.text()

            console.log('[SW] Texto recebido:', texto)

            data = {
              ...data,
              body: texto
            }
          } catch (textError) {
            console.error(
              '[SW] Erro ao ler payload:',
              textError
            )
          }
        }
      } else {
        console.log('[SW] Push recebido sem payload')
      }

      // ============================================================
      // 2. GARANTE OS DADOS
      // ============================================================

      const titulo =
        data?.title ||
        'Organiza Salão'

      const mensagem =
        data?.body ||
        'Você tem uma nova notificação.'

      const url =
        data?.url ||
        '/'

      console.log('[SW] Título:', titulo)
      console.log('[SW] Mensagem:', mensagem)
      console.log('[SW] URL:', url)

      // ============================================================
      // 3. DIAGNÓSTICO
      //
      // Esta chamada serve somente para descobrirmos se o push
      // realmente chegou ao Service Worker.
      //
      // Se aparecer [SW-DIAGNOSTIC] nos logs da Vercel, sabemos
      // que o iPhone recebeu o push e executou este código.
      // ============================================================

      try {
        console.log('[SW] Enviando diagnóstico para o servidor...')

        const diagnosticoResponse = await fetch(
          '/api/push/sw-diagnostic',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: titulo,
              body: mensagem,
              url,
              timestamp: new Date().toISOString(),
              userAgent:
                self.navigator?.userAgent ||
                'service-worker'
            })
          }
        )

        console.log(
          '[SW] Diagnóstico enviado. Status:',
          diagnosticoResponse.status
        )

      } catch (diagnosticoError) {
        console.error(
          '[SW] Erro ao enviar diagnóstico:',
          diagnosticoError
        )
      }

      // ============================================================
      // 4. MOSTRA A NOTIFICAÇÃO
      // ============================================================

      const opcoes = {
        body: mensagem,

        data: {
          url
        },

        tag: 'organiza-salao-notificacao',

        renotify: true
      }

      console.log('[SW] Chamando showNotification...')

      try {
        await self.registration.showNotification(
          titulo,
          opcoes
        )

        console.log(
          '[SW] ========================================'
        )

        console.log(
          '[SW] NOTIFICAÇÃO EXIBIDA COM SUCESSO'
        )

        console.log(
          '[SW] ========================================'
        )

      } catch (notificationError) {
        console.error(
          '[SW] ========================================'
        )

        console.error(
          '[SW] ERRO AO MOSTRAR NOTIFICAÇÃO:',
          notificationError
        )

        console.error(
          '[SW] ========================================'
        )
      }
    })()
  )
})

self.addEventListener('notificationclick', event => {
  console.log('[SW] Clique na notificação')

  event.notification.close()

  event.waitUntil(
    (async () => {
      try {
        const url =
          event.notification?.data?.url ||
          '/'

        console.log(
          '[SW] URL da notificação:',
          url
        )

        const windowClients = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        })

        // ============================================================
        // 1. PROCURA UMA JANELA JÁ ABERTA
        // ============================================================

        for (const client of windowClients) {
          if (
            client.url &&
            'focus' in client
          ) {
            console.log(
              '[SW] Encontrada janela existente'
            )

            await client.focus()

            if (
              url &&
              url !== '/' &&
              'navigate' in client
            ) {
              try {
                await client.navigate(url)
              } catch (navigateError) {
                console.log(
                  '[SW] Não foi possível navegar:',
                  navigateError
                )
              }
            }

            return
          }
        }

        // ============================================================
        // 2. ABRE UMA NOVA JANELA
        // ============================================================

        if (clients.openWindow) {
          console.log(
            '[SW] Abrindo nova janela:',
            url
          )

          await clients.openWindow(url)
        }

      } catch (error) {
        console.error(
          '[SW] Erro ao clicar na notificação:',
          error
        )
      }
    })()
  )
})