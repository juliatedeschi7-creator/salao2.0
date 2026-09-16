'use client'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

// =========================================================
// DIAGNÓSTICO DO PUSH
// =========================================================

let ultimoErroPush = ''

export function obterUltimoErroPush(): string {
  return ultimoErroPush
}

function registrarErroPush(
  mensagem: string
): false {

  ultimoErroPush = mensagem

  console.error(
    '[PUSH CLIENT] ERRO:',
    mensagem
  )

  return false
}

// =========================================================
// SUPORTE
// =========================================================

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

export function obterPermissaoPush(): NotificationPermission {

  if (
    typeof window === 'undefined' ||
    !('Notification' in window)
  ) {
    return 'denied'
  }

  return Notification.permission
}

// =========================================================
// VAPID
// =========================================================

function urlBase64ToUint8Array(
  base64String: string
): Uint8Array {

  const padding =
    '='.repeat(
      (4 - (base64String.length % 4)) % 4
    )

  const base64 =
    (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

  const rawData =
    window.atob(base64)

  const outputArray =
    new Uint8Array(rawData.length)

  for (
    let i = 0;
    i < rawData.length;
    ++i
  ) {
    outputArray[i] =
      rawData.charCodeAt(i)
  }

  return outputArray
}

function uint8ArrayToArrayBuffer(
  array: Uint8Array
): ArrayBuffer {

  const buffer =
    new ArrayBuffer(array.byteLength)

  new Uint8Array(buffer).set(array)

  return buffer
}

// =========================================================
// REGISTRAR PUSH
// =========================================================

export async function registrarPush(
  userId: string
): Promise<boolean> {

  ultimoErroPush = ''

  try {

    console.log(
      '[PUSH CLIENT] ================================='
    )

    console.log(
      '[PUSH CLIENT] Iniciando registro do Push'
    )

    console.log(
      '[PUSH CLIENT] userId:',
      userId
    )

    // -------------------------------------------------------
    // 1. Verificar suporte
    // -------------------------------------------------------

    if (!verificarSuportePush()) {

      return registrarErroPush(
        'Este dispositivo/navegador não possui suporte às APIs necessárias para Push.'
      )
    }

    console.log(
      '[PUSH CLIENT] Suporte ao Push detectado.'
    )

    // -------------------------------------------------------
    // 2. Verificar permissão
    // -------------------------------------------------------

    let permission =
      obterPermissaoPush()

    console.log(
      '[PUSH CLIENT] Permissão atual:',
      permission
    )

    if (permission === 'denied') {

      return registrarErroPush(
        'A permissão para notificações está bloqueada neste dispositivo.'
      )
    }

    if (permission === 'default') {

      console.log(
        '[PUSH CLIENT] Solicitando permissão ao usuário...'
      )

      permission =
        await Notification.requestPermission()

      console.log(
        '[PUSH CLIENT] Resultado da permissão:',
        permission
      )
    }

    if (permission !== 'granted') {

      return registrarErroPush(
        `Permissão para notificações não concedida. Resultado: ${permission}`
      )
    }

    console.log(
      '[PUSH CLIENT] Permissão concedida.'
    )

    // -------------------------------------------------------
    // 3. Verificar VAPID
    // -------------------------------------------------------

    const vapidKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    if (!vapidKey) {

      return registrarErroPush(
        'NEXT_PUBLIC_VAPID_PUBLIC_KEY não está configurada no navegador.'
      )
    }

    console.log(
      '[PUSH CLIENT] Chave VAPID pública encontrada.'
    )

    // -------------------------------------------------------
    // 4. Registrar Service Worker
    // -------------------------------------------------------

    console.log(
      '[PUSH CLIENT] Registrando /sw.js...'
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
      registration
    )

    await navigator.serviceWorker.ready

    console.log(
      '[PUSH CLIENT] Service Worker pronto.'
    )

    // -------------------------------------------------------
    // 5. Verificar subscription existente
    // -------------------------------------------------------

    let subscription =
      await registration.pushManager.getSubscription()

    if (subscription) {

      console.log(
        '[PUSH CLIENT] Subscription existente encontrada.'
      )

    } else {

      console.log(
        '[PUSH CLIENT] Nenhuma subscription encontrada.'
      )
    }

    // -------------------------------------------------------
    // 6. Criar nova subscription se necessário
    // -------------------------------------------------------

    if (!subscription) {

      console.log(
        '[PUSH CLIENT] Criando nova Push Subscription...'
      )

      const vapidBytes =
        urlBase64ToUint8Array(
          vapidKey
        )

      const applicationServerKey =
        uint8ArrayToArrayBuffer(
          vapidBytes
        )

      console.log(
        '[PUSH CLIENT] VAPID convertida para ArrayBuffer.'
      )

      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        })

      console.log(
        '[PUSH CLIENT] Nova subscription criada:',
        subscription
      )
    }

    // -------------------------------------------------------
    // 7. Converter subscription para JSON
    // -------------------------------------------------------

    const subscriptionJson =
      subscription.toJSON()

    console.log(
      '[PUSH CLIENT] Subscription JSON:',
      subscriptionJson
    )

    // -------------------------------------------------------
    // 8. Validar dados da subscription
    // -------------------------------------------------------

    if (
      !subscriptionJson.endpoint ||
      !subscriptionJson.keys?.p256dh ||
      !subscriptionJson.keys?.auth
    ) {

      return registrarErroPush(
        'A Push Subscription foi criada, mas está incompleta: faltam endpoint, p256dh ou auth.'
      )
    }

    console.log(
      '[PUSH CLIENT] Subscription possui os dados necessários.'
    )

    // -------------------------------------------------------
    // 9. Buscar profile
    // -------------------------------------------------------

    console.log(
      '[PUSH CLIENT] Buscando profile no Supabase...'
    )

    const {
      data: profile,
      error: profileError
    } = await supabase
      .from('profiles')
      .select('salao_id')
      .eq('id', userId)
      .single()

    if (profileError) {

      console.error(
        '[PUSH CLIENT] Erro ao buscar profile:',
        profileError
      )

      return registrarErroPush(
        `Erro ao buscar perfil no Supabase: ${profileError.message}`
      )
    }

    console.log(
      '[PUSH CLIENT] Profile encontrado:',
      profile
    )

    // -------------------------------------------------------
    // 10. Salvar subscription
    // -------------------------------------------------------

    console.log(
      '[PUSH CLIENT] Salvando subscription no Supabase...'
    )

    const {
      error: subscriptionError
    } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          profile_id: userId,
          user_id: userId,
          salao_id:
            profile?.salao_id ?? null,

          // IMPORTANTE:
          // A tabela push_subscriptions NÃO possui
          // uma coluna "endpoint".
          //
          // O endpoint já está dentro deste objeto:
          //
          // subscription.endpoint
          //
          // junto com:
          // subscription.keys.p256dh
          // subscription.keys.auth
          //
          subscription:
            subscriptionJson,

          updated_at:
            new Date().toISOString()
        },
        {
          onConflict: 'profile_id'
        }
      )

    if (subscriptionError) {

      console.error(
        '[PUSH CLIENT] Erro ao salvar subscription:',
        subscriptionError
      )

      return registrarErroPush(
        `Erro ao salvar a Push Subscription no Supabase: ${subscriptionError.message}`
      )
    }

    // -------------------------------------------------------
    // 11. Sucesso
    // -------------------------------------------------------

    console.log(
      '[PUSH CLIENT] Subscription salva com sucesso.'
    )

    console.log(
      '[PUSH CLIENT] ================================='
    )

    return true

  } catch (error: unknown) {

    console.error(
      '[PUSH CLIENT] ================================='
    )

    console.error(
      '[PUSH CLIENT] ERRO ao registrar Push:',
      error
    )

    if (error instanceof Error) {

      console.error(
        '[PUSH CLIENT] Tipo do erro:',
        error.name
      )

      console.error(
        '[PUSH CLIENT] Mensagem:',
        error.message
      )

      console.error(
        '[PUSH CLIENT] Stack:',
        error.stack
      )

      return registrarErroPush(
        `${error.name}: ${error.message}`
      )

    } else {

      let mensagem =
        'Erro desconhecido ao registrar o Push.'

      try {

        mensagem =
          JSON.stringify(error)

      } catch {

        mensagem =
          String(error)
      }

      return registrarErroPush(
        mensagem
      )
    }
  }
}

// =========================================================
// VERIFICAR PUSH ATIVO
// =========================================================

export async function verificarPushAtivo(
  userId?: string
): Promise<boolean> {

  try {

    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {

      return false
    }

    const registration =
      await navigator.serviceWorker.ready

    const subscription =
      await registration.pushManager.getSubscription()

    if (!subscription) {

      return false
    }

    if (userId) {

      const subscriptionJson =
        subscription.toJSON()

      if (
        !subscriptionJson.endpoint
      ) {

        return false
      }
    }

    return true

  } catch (error) {

    console.error(
      '[PUSH CLIENT] Erro ao verificar Push ativo:',
      error
    )

    return false
  }
}
