'use client'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Converte a chave pública VAPID (Base64 URL) para Uint8Array.
 * Necessário para o applicationServerKey do PushManager.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

/**
 * Resultado detalhado do registro do Push.
 *
 * Mantemos "ok" para continuar compatível com a tela atual,
 * mas também devolvemos uma mensagem de erro para diagnóstico.
 */
export type ResultadoPush = {
  ok: boolean
  erro?: string
}

/**
 * Registra o dispositivo para receber notificações Push.
 */
export async function registrarPush(
  userId: string
): Promise<ResultadoPush> {
  try {
    console.log('[PUSH CLIENT] Iniciando registro do Push...')
    console.log('[PUSH CLIENT] userId:', userId)

    // ---------------------------------------------------------
    // 1. Verifica suporte do navegador
    // ---------------------------------------------------------

    if (typeof window === 'undefined') {
      return {
        ok: false,
        erro: 'window não está disponível.'
      }
    }

    if (!('Notification' in window)) {
      return {
        ok: false,
        erro: 'Este navegador não possui suporte a Notification.'
      }
    }

    if (!('serviceWorker' in navigator)) {
      return {
        ok: false,
        erro: 'Este navegador não possui suporte a Service Worker.'
      }
    }

    if (!('PushManager' in window)) {
      return {
        ok: false,
        erro: 'Este navegador não possui suporte a PushManager.'
      }
    }

    console.log(
      '[PUSH CLIENT] Suporte ao Push detectado.'
    )

    // ---------------------------------------------------------
    // 2. Verifica / solicita permissão
    // ---------------------------------------------------------

    let permission = Notification.permission

    console.log(
      '[PUSH CLIENT] Permissão atual:',
      permission
    )

    if (permission === 'denied') {
      return {
        ok: false,
        erro:
          'A permissão para notificações está bloqueada neste dispositivo. Verifique as configurações de notificações do Organiza no iPhone.'
      }
    }

    if (permission === 'default') {
      console.log(
        '[PUSH CLIENT] Solicitando permissão ao usuário...'
      )

      permission = await Notification.requestPermission()

      console.log(
        '[PUSH CLIENT] Resultado da permissão:',
        permission
      )
    }

    if (permission !== 'granted') {
      return {
        ok: false,
        erro:
          `Permissão para notificações não concedida. Resultado: ${permission}`
      }
    }

    // ---------------------------------------------------------
    // 3. Verifica VAPID
    // ---------------------------------------------------------

    const vapidKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    if (!vapidKey) {
      return {
        ok: false,
        erro:
          'NEXT_PUBLIC_VAPID_PUBLIC_KEY não está configurada no navegador.'
      }
    }

    console.log(
      '[PUSH CLIENT] Chave VAPID pública encontrada.'
    )

    // ---------------------------------------------------------
    // 4. Registra / obtém o Service Worker
    // ---------------------------------------------------------

    console.log(
      '[PUSH CLIENT] Registrando /sw.js...'
    )

    const registration =
      await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

    console.log(
      '[PUSH CLIENT] Service Worker registrado:',
      registration
    )

    await navigator.serviceWorker.ready

    console.log(
      '[PUSH CLIENT] Service Worker pronto.'
    )

    // ---------------------------------------------------------
    // 5. Verifica subscription existente
    // ---------------------------------------------------------

    let subscription =
      await registration.pushManager.getSubscription()

    if (subscription) {
      console.log(
        '[PUSH CLIENT] Subscription existente encontrada.'
      )
    }

    // ---------------------------------------------------------
    // 6. Cria nova subscription se necessário
    // ---------------------------------------------------------

    if (!subscription) {
      console.log(
        '[PUSH CLIENT] Criando nova Push Subscription...'
      )

      const applicationServerKey =
        urlBase64ToUint8Array(vapidKey)

      console.log(
        '[PUSH CLIENT] VAPID convertida para Uint8Array.'
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

    // ---------------------------------------------------------
    // 7. Converte subscription para JSON
    // ---------------------------------------------------------

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
      return {
        ok: false,
        erro:
          'A Push Subscription foi criada, mas não contém endpoint, p256dh ou auth válidos.'
      }
    }

    // ---------------------------------------------------------
    // 8. Salva subscription no Supabase
    // ---------------------------------------------------------

    console.log(
      '[PUSH CLIENT] Salvando subscription no Supabase...'
    )

    const { data: profile, error: profileError } =
      await supabase
        .from('profiles')
        .select('salao_id')
        .eq('id', userId)
        .single()

    if (profileError) {
      console.error(
        '[PUSH CLIENT] Erro ao buscar profile:',
        profileError
      )

      return {
        ok: false,
        erro:
          `Erro ao buscar perfil no Supabase: ${profileError.message}`
      }
    }

    const { error: subscriptionError } =
      await supabase
        .from('push_subscriptions')
        .upsert(
          {
            profile_id: userId,
            user_id: userId,
            salao_id: profile?.salao_id ?? null,
            endpoint: subscriptionJson.endpoint,
            subscription: subscriptionJson,
            updated_at: new Date().toISOString()
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

      return {
        ok: false,
        erro:
          `Erro ao salvar a subscription no Supabase: ${subscriptionError.message}`
      }
    }

    console.log(
      '[PUSH CLIENT] Subscription salva com sucesso.'
    )

    // ---------------------------------------------------------
    // 9. Sucesso
    // ---------------------------------------------------------

    return {
      ok: true
    }

  } catch (error: unknown) {
    console.error(
      '[PUSH CLIENT] ERRO ao registrar Push:',
      error
    )

    let mensagem = 'Erro desconhecido ao registrar Push.'

    if (error instanceof Error) {
      mensagem =
        `${error.name}: ${error.message}`
    } else if (typeof error === 'string') {
      mensagem = error
    } else {
      try {
        mensagem = JSON.stringify(error)
      } catch {
        mensagem = String(error)
      }
    }

    console.error(
      '[PUSH CLIENT] Mensagem:',
      mensagem
    )

    return {
      ok: false,
      erro: mensagem
    }
  }
}

/**
 * Verifica se este dispositivo possui uma Push Subscription ativa.
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

      if (!subscriptionJson.endpoint) {
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
