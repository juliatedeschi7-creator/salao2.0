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

/**
 * Retorna o último erro ocorrido durante
 * a tentativa de ativar o Push.
 *
 * Usado para diagnóstico.
 */
export function obterUltimoErroPush(): string {
  return ultimoErroPush
}

/**
 * Registra o erro para que a interface
 * possa mostrar exatamente onde o Push falhou.
 */
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

/**
 * Verifica se o navegador/dispositivo possui
 * suporte às APIs necessárias para Push.
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
 * Retorna a permissão atual para notificações.
 */
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

/**
 * Converte a chave pública VAPID (Base64 URL)
 * para Uint8Array.
 */
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

/**
 * Converte os bytes da VAPID para um
 * ArrayBuffer real.
 *
 * Fazemos uma cópia explícita para evitar
 * o conflito de tipos ArrayBufferLike /
 * ArrayBuffer existente nas versões atuais
 * dos tipos do TypeScript.
 */
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

/**
 * Registra o dispositivo para receber
 * notificações Push.
 *
 * Continua retornando boolean para manter
 * compatibilidade com as páginas existentes.
 */
export async function registrarPush(
  userId: string
): Promise<boolean> {

  // Limpa o erro anterior antes de
  // iniciar uma nova tentativa.
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

    // =========================================================
    // 1. Verificar suporte
    // =========================================================

    if (!verificarSuportePush()) {

      return registrarErroPush(
        'Este dispositivo/navegador não possui suporte às APIs necessárias para Push.'
      )
    }

    console.log(
      '[PUSH CLIENT] Suporte ao Push detectado.'
    )

    // =========================================================
    // 2. Verificar permissão
    // =========================================================

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

    // =========================================================
    // 3. Solicitar permissão
    // =========================================================

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

    // =========================================================
    // 4. Verificar VAPID
    // =========================================================

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

    // =========================================================
    // 5. Registrar Service Worker
    // =========================================================

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

    // =========================================================
    // 6. Aguardar Service Worker ficar pronto
    // =========================================================

    await navigator.serviceWorker.ready

    console.log(
      '[PUSH CLIENT] Service Worker pronto.'
    )

    // =========================================================
    // 7. Procurar subscription existente
    // =========================================================

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

    // =========================================================
    // 8. Criar subscription se necessário
    // =========================================================

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

    // =========================================================
    // 9. Converter subscription para JSON
    // =========================================================

    const subscriptionJson =
      subscription.toJSON()

    console.log(
      '[PUSH CLIENT] Subscription JSON:',
      subscriptionJson
    )

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

    // =========================================================
    // 10. Buscar profile
    // =========================================================

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

    // =========================================================
    // 11. Salvar subscription
    // =========================================================

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
          endpoint:
            subscriptionJson.endpoint,
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

/**
 * Verifica se este dispositivo possui
 * uma Push Subscription ativa.
 */
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
