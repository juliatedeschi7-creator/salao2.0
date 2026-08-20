import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)

  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)

  return Uint8Array.from(
    [...rawData].map(char => char.charCodeAt(0))
  )
}

/**
 * Registra o dispositivo para receber Push Notifications.
 *
 * IMPORTANTE:
 * - Funciona para cliente e dono.
 * - Não altera a lógica de envio do /api/push/test.
 * - Salva a subscription completa no banco.
 * - Também mantém endpoint e keys separados para compatibilidade.
 */
export async function registrarPush(
  userId: string
): Promise<boolean> {

  if (typeof window === 'undefined') {
    console.log('[PUSH CLIENT] Ambiente SSR')
    return false
  }

  if (!('Notification' in window)) {
    console.log('[PUSH CLIENT] Notification não suportado')
    return false
  }

  if (!('serviceWorker' in navigator)) {
    console.log('[PUSH CLIENT] Service Worker não suportado')
    return false
  }

  if (!('PushManager' in window)) {
    console.log('[PUSH CLIENT] PushManager não suportado')
    return false
  }

  try {
    console.log('[PUSH CLIENT] Iniciando ativação para:', userId)

    // ------------------------------------------------------------
    // 1. VERIFICAR PERMISSÃO
    // ------------------------------------------------------------

    let permission = Notification.permission

    console.log(
      '[PUSH CLIENT] Permissão atual:',
      permission
    )

    if (permission === 'default') {
      console.log(
        '[PUSH CLIENT] Solicitando permissão...'
      )

      permission = await Notification.requestPermission()

      console.log(
        '[PUSH CLIENT] Resultado da permissão:',
        permission
      )
    }

    if (permission !== 'granted') {
      console.log(
        '[PUSH CLIENT] Permissão não concedida:',
        permission
      )

      return false
    }

    // ------------------------------------------------------------
    // 2. VAPID
    // ------------------------------------------------------------

    const vapidKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    if (!vapidKey) {
      console.error(
        '[PUSH CLIENT] NEXT_PUBLIC_VAPID_PUBLIC_KEY não encontrada'
      )

      return false
    }

    // ------------------------------------------------------------
    // 3. SERVICE WORKER
    // ------------------------------------------------------------

    console.log(
      '[PUSH CLIENT] Registrando /sw.js'
    )

    const registration =
      await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

    console.log(
      '[PUSH CLIENT] Service Worker registrado:',
      registration.scope
    )

    // Espera o Service Worker ficar pronto/ativo.
    const readyRegistration =
      await navigator.serviceWorker.ready

    console.log(
      '[PUSH CLIENT] Service Worker pronto'
    )

    // ------------------------------------------------------------
    // 4. VERIFICAR SE JÁ EXISTE UMA SUBSCRIPTION
    // ------------------------------------------------------------

    let subscription =
      await readyRegistration.pushManager.getSubscription()

    if (subscription) {
      console.log(
        '[PUSH CLIENT] Subscription existente encontrada'
      )
    }

    // ------------------------------------------------------------
    // 5. CRIAR SUBSCRIPTION SE NÃO EXISTIR
    // ------------------------------------------------------------

    if (!subscription) {
      console.log(
        '[PUSH CLIENT] Criando nova subscription...'
      )

      subscription =
        await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(vapidKey),
        })

      console.log(
        '[PUSH CLIENT] Nova subscription criada'
      )
    }

    // ------------------------------------------------------------
    // 6. CONVERTER PARA JSON
    // ------------------------------------------------------------

    const subJson = subscription.toJSON()

    if (
      !subJson.endpoint ||
      !subJson.keys?.p256dh ||
      !subJson.keys?.auth
    ) {
      console.error(
        '[PUSH CLIENT] Subscription incompleta:',
        subJson
      )

      return false
    }

    console.log(
      '[PUSH CLIENT] Endpoint:',
      subJson.endpoint
    )

    console.log(
      '[PUSH CLIENT] Keys presentes:',
      {
        p256dh: !!subJson.keys.p256dh,
        auth: !!subJson.keys.auth
      }
    )

    // ------------------------------------------------------------
    // 7. SALVAR NO SUPABASE
    // ------------------------------------------------------------

    const subscriptionData = {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
      },
      expirationTime:
        subJson.expirationTime ?? null
    }

    console.log(
      '[PUSH CLIENT] Salvando subscription no banco...'
    )

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          profile_id: userId,

          // Mantém estes campos para compatibilidade
          endpoint: subJson.endpoint,
          keys: subJson.keys,

          // IMPORTANTE:
          // O /api/push/test lê este campo.
          subscription: subscriptionData,

          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'profile_id'
        }
      )

    if (error) {
      console.error(
        '[PUSH CLIENT] Erro ao salvar subscription:',
        error
      )

      return false
    }

    console.log(
      '[PUSH CLIENT] Subscription salva com sucesso!'
    )

    return true

  } catch (error: any) {

    console.error(
      '[PUSH CLIENT] ERRO ao registrar Push:',
      error
    )

    console.error(
      '[PUSH CLIENT] Mensagem:',
      error?.message
    )

    return false
  }
}

/**
 * Verifica se o usuário já possui Push ativo.
 */
export async function verificarPushAtivo(
  userId: string
): Promise<boolean> {

  if (typeof window === 'undefined') {
    return true
  }

  if (!('Notification' in window)) {
    return true
  }

  // Se o navegador já concedeu a permissão,
  // consideramos o Push ativo.
  if (Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const registration =
          await navigator.serviceWorker.ready

        const subscription =
          await registration.pushManager.getSubscription()

        if (subscription) {
          return true
        }
      }
    } catch {
      // Continua para consultar o banco.
    }
  }

  // ------------------------------------------------------------
  // Consultar banco
  // ------------------------------------------------------------

  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, subscription, endpoint')
      .eq('profile_id', userId)
      .maybeSingle()

    if (error) {
      console.error(
        '[PUSH CLIENT] Erro ao verificar Push:',
        error
      )

      return false
    }

    return !!data
  } catch (error) {
    console.error(
      '[PUSH CLIENT] Erro ao consultar Push:',
      error
    )

    return false
  }
}