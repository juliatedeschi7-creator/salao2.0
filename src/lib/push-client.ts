import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat(
    (4 - (base64String.length % 4)) % 4
  )

  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)

  return Uint8Array.from(
    [...rawData].map(char => char.charCodeAt(0))
  )
}

/**
 * Verifica se o navegador possui suporte básico
 * para Push Notifications.
 */
export function verificarSuportePush(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

/**
 * Retorna o estado atual da permissão.
 *
 * 'default'  = ainda não foi solicitada
 * 'granted'  = permitida
 * 'denied'   = bloqueada
 */
export function obterPermissaoPush():
  | NotificationPermission
  | 'unsupported' {

  if (typeof window === 'undefined') {
    return 'unsupported'
  }

  if (!('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

/**
 * Registra o dispositivo para receber Push Notifications.
 *
 * Funciona para cliente e dono.
 *
 * IMPORTANTE:
 * - Não altera a lógica do /api/push/test.
 * - Não depende do banco para descobrir se o dispositivo possui Push.
 * - Usa a subscription real deste navegador.
 * - Salva a subscription completa no banco.
 */
export async function registrarPush(
  userId: string
): Promise<boolean> {

  if (typeof window === 'undefined') {
    console.log(
      '[PUSH CLIENT] Ambiente SSR'
    )
    return false
  }

  if (!('Notification' in window)) {
    console.log(
      '[PUSH CLIENT] Notification não suportado'
    )
    return false
  }

  if (!('serviceWorker' in navigator)) {
    console.log(
      '[PUSH CLIENT] Service Worker não suportado'
    )
    return false
  }

  if (!('PushManager' in window)) {
    console.log(
      '[PUSH CLIENT] PushManager não suportado'
    )
    return false
  }

  if (!userId) {
    console.error(
      '[PUSH CLIENT] userId não informado'
    )
    return false
  }

  try {

    console.log(
      '[PUSH CLIENT] ================================='
    )

    console.log(
      '[PUSH CLIENT] Iniciando ativação para:',
      userId
    )

    // ============================================================
    // 1. PERMISSÃO
    // ============================================================

    let permission =
      Notification.permission

    console.log(
      '[PUSH CLIENT] Permissão atual:',
      permission
    )

    /**
     * Só solicita a permissão quando ela ainda é "default".
     *
     * IMPORTANTE:
     * requestPermission() deve acontecer em consequência
     * de uma ação do usuário, como clicar no botão.
     */
    if (permission === 'default') {

      console.log(
        '[PUSH CLIENT] Solicitando permissão...'
      )

      permission =
        await Notification.requestPermission()

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

    // ============================================================
    // 2. VAPID
    // ============================================================

    const vapidKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    if (!vapidKey) {

      console.error(
        '[PUSH CLIENT] NEXT_PUBLIC_VAPID_PUBLIC_KEY não encontrada'
      )

      return false
    }

    console.log(
      '[PUSH CLIENT] VAPID encontrado'
    )

    // ============================================================
    // 3. SERVICE WORKER
    // ============================================================

    console.log(
      '[PUSH CLIENT] Registrando /sw.js'
    )

    const registration =
      await navigator.serviceWorker.register(
        '/sw.js',
        {
          scope: '/'
        }
      )

    console.log(
      '[PUSH CLIENT] Service Worker registrado:',
      registration.scope
    )

    const readyRegistration =
      await navigator.serviceWorker.ready

    console.log(
      '[PUSH CLIENT] Service Worker pronto'
    )

    // ============================================================
    // 4. VERIFICAR SUBSCRIPTION LOCAL
    // ============================================================

    let subscription =
      await readyRegistration.pushManager.getSubscription()

    if (subscription) {

      console.log(
        '[PUSH CLIENT] Subscription existente encontrada neste dispositivo'
      )

    } else {

      console.log(
        '[PUSH CLIENT] Nenhuma subscription encontrada neste dispositivo'
      )

    }

    // ============================================================
    // 5. CRIAR SUBSCRIPTION
    // ============================================================

    if (!subscription) {

      console.log(
        '[PUSH CLIENT] Criando nova subscription...'
      )

      subscription =
        await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(vapidKey)
        })

      console.log(
        '[PUSH CLIENT] Nova subscription criada'
      )
    }

    // ============================================================
    // 6. CONVERTER PARA JSON
    // ============================================================

    const subJson =
      subscription.toJSON()

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
      '[PUSH CLIENT] Subscription válida'
    )

    console.log(
      '[PUSH CLIENT] Endpoint:',
      subJson.endpoint
    )

    console.log(
      '[PUSH CLIENT] Keys presentes:',
      {
        p256dh:
          !!subJson.keys.p256dh,

        auth:
          !!subJson.keys.auth
      }
    )

    // ============================================================
    // 7. DADOS DA SUBSCRIPTION
    // ============================================================

    const subscriptionData = {

      endpoint:
        subJson.endpoint,

      keys: {

        p256dh:
          subJson.keys.p256dh,

        auth:
          subJson.keys.auth

      },

      expirationTime:
        subJson.expirationTime ?? null
    }

    // ============================================================
    // 8. SALVAR NO SUPABASE
    // ============================================================

    console.log(
      '[PUSH CLIENT] Salvando subscription no banco...'
    )

    const { error } =
      await supabase
        .from('push_subscriptions')
        .upsert(
          {
            profile_id:
              userId,

            // Mantém compatibilidade
            // com a estrutura existente.
            endpoint:
              subJson.endpoint,

            keys:
              subJson.keys,

            subscription:
              subscriptionData,

            updated_at:
              new Date().toISOString()
          },
          {
            onConflict:
              'profile_id'
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

    console.log(
      '[PUSH CLIENT] Push ATIVO neste dispositivo.'
    )

    console.log(
      '[PUSH CLIENT] ================================='
    )

    return true

  } catch (error: any) {

    console.error(
      '[PUSH CLIENT] ================================='
    )

    console.error(
      '[PUSH CLIENT] ERRO ao registrar Push:',
      error
    )

    console.error(
      '[PUSH CLIENT] Mensagem:',
      error?.message
    )

    console.error(
      '[PUSH CLIENT] ================================='
    )

    return false
  }
}

/**
 * Verifica se o usuário possui Push ativo
 * NESTE dispositivo/navegador.
 *
 * A existência de um registro no banco NÃO é suficiente.
 */
export async function verificarPushAtivo(
  userId: string
): Promise<boolean> {

  if (typeof window === 'undefined') {
    return false
  }

  console.log(
    '[PUSH CLIENT] ================================='
  )

  console.log(
    '[PUSH CLIENT] Verificando status do Push'
  )

  // ============================================================
  // 1. SUPORTE
  // ============================================================

  if (!verificarSuportePush()) {

    console.log(
      '[PUSH CLIENT] Push não suportado neste navegador'
    )

    return false
  }

  // ============================================================
  // 2. PERMISSÃO
  // ============================================================

  const permission =
    Notification.permission

  console.log(
    '[PUSH CLIENT] Permission:',
    permission
  )

  /**
   * Se ainda não foi solicitado,
   * definitivamente não podemos considerar ativo.
   */
  if (permission === 'default') {

    console.log(
      '[PUSH CLIENT] Permissão ainda não solicitada'
    )

    console.log(
      '[PUSH CLIENT] Status final: PRECISA SOLICITAR'
    )

    return false
  }

  /**
   * Se foi bloqueado, não está ativo.
   */
  if (permission === 'denied') {

    console.log(
      '[PUSH CLIENT] Permissão bloqueada pelo navegador'
    )

    console.log(
      '[PUSH CLIENT] Status final: BLOQUEADO'
    )

    return false
  }

  // ============================================================
  // 3. SERVICE WORKER
  // ============================================================

  try {

    const registration =
      await navigator.serviceWorker.ready

    console.log(
      '[PUSH CLIENT] Service Worker: OK'
    )

    // ==========================================================
    // 4. SUBSCRIPTION DESTE DISPOSITIVO
    // ==========================================================

    const subscription =
      await registration.pushManager.getSubscription()

    if (subscription) {

      console.log(
        '[PUSH CLIENT] Subscription local: SIM'
      )

      const subJson =
        subscription.toJSON()

      if (
        subJson.endpoint &&
        subJson.keys?.p256dh &&
        subJson.keys?.auth
      ) {

        console.log(
          '[PUSH CLIENT] Subscription local válida: SIM'
        )

        // ------------------------------------------------------
        // Confere também se o banco possui registro.
        // Se não possuir, não vamos considerar erro:
        // o registrarPush poderá sincronizar depois.
        // ------------------------------------------------------

        try {

          const {
            data,
            error
          } = await supabase
            .from('push_subscriptions')
            .select(
              'id, subscription, endpoint'
            )
            .eq(
              'profile_id',
              userId
            )
            .maybeSingle()

          if (error) {

            console.warn(
              '[PUSH CLIENT] Não foi possível consultar o banco:',
              error
            )

          } else {

            console.log(
              '[PUSH CLIENT] Subscription no banco:',
              !!data
            )
          }

        } catch (error) {

          console.warn(
            '[PUSH CLIENT] Erro secundário ao consultar banco:',
            error
          )
        }

        console.log(
          '[PUSH CLIENT] Status final: PUSH ATIVO'
        )

        console.log(
          '[PUSH CLIENT] ================================='
        )

        return true
      }

      console.warn(
        '[PUSH CLIENT] Subscription local está incompleta'
      )

    } else {

      console.log(
        '[PUSH CLIENT] Subscription local: NÃO'
      )
    }

  } catch (error) {

    console.error(
      '[PUSH CLIENT] Erro ao verificar Service Worker/Subscription:',
      error
    )
  }

  // ============================================================
  // 5. NÃO HÁ SUBSCRIPTION LOCAL
  // ============================================================

  /**
   * Aqui NÃO usamos mais:
   *
   *   return !!data
   *
   * do banco.
   *
   * Se o navegador atual não possui subscription,
   * o Push deste dispositivo não está ativo.
   */

  console.log(
    '[PUSH CLIENT] Status final: PRECISA ATIVAR/REATIVAR'
  )

  console.log(
    '[PUSH CLIENT] ================================='
  )

  return false
}