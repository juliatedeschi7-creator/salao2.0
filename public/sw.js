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
      try {
        let data = {
          title: 'Organiza Salão',
          body: 'Você tem uma nova notificação.',
          url: '/'
        }

        // ============================================================
        // 1. LÊ O PAYLOAD RECEBIDO
        // ============================================================

        if (event.data) {
          try {
            data = event.data.json()

            console.log('[SW] Payload recebido:', data)
          } catch (jsonError) {
            console.log(
              '[SW] Não foi possível interpretar JSON. Tentando texto.'
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
        // 2. GARANTE VALORES VÁLIDOS
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
        // 3. CONFIGURA A NOTIFICAÇÃO
        //
        // IMPORTANTE:
        // Não estamos usando icon/badge aqui propositalmente.
        //
        // Assim eliminamos a possibilidade de um arquivo de imagem
        // inexistente ou incompatível impedir a exibição da
        // notificação no Safari/iOS.
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

        // ============================================================
        // 4. MOSTRA A NOTIFICAÇÃO
        // ============================================================

        await self.registration.showNotification(
          titulo,
          opcoes
        )

        console.log('[SW] ========================================')
        console.log('[SW] NOTIFICAÇÃO EXIBIDA COM SUCESSO')
        console.log('[SW] ========================================')

      } catch (error) {
        console.error(
          '[SW] ========================================'
        )

        console.error(
          '[SW] ERRO AO PROCESSAR PUSH'
        )

        console.error(
          '[SW] ========================================',
          error
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

        console.log('[SW] URL da notificação:', url)

        const windowClients = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        })

        // ============================================================
        // 1. TENTA ENCONTRAR UMA JANELA DO ORGANIZA JÁ ABERTA
        // ============================================================

        for (const client of windowClients) {
          if (
            client.url &&
            'focus' in client
          ) {
            console.log('[SW] Encontrando janela existente')

            await client.focus()

            // Se for possível navegar diretamente para a URL
            if (
              url &&
              url !== '/' &&
              'navigate' in client
            ) {
              try {
                await client.navigate(url)
              } catch (navigateError) {
                console.log(
                  '[SW] Não foi possível navegar pela janela existente:',
                  navigateError
                )
              }
            }

            return
          }
        }

        // ============================================================
        // 2. SE NÃO EXISTIR JANELA, ABRE UMA NOVA
        // ============================================================

        if (clients.openWindow) {
          console.log('[SW] Abrindo nova janela:', url)

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