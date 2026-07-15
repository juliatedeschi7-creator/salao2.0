// src/lib/push-client.ts
import { createClient } from '@supabase/supabase-js'

// Usamos a chave pública (ANON) porque este arquivo roda no navegador do cliente
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function verificarPushAtivo(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  const permission = Notification.permission
  if (permission !== 'granted') return false

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return !!subscription
  } catch (err) {
    console.error('Erro ao verificar push ativo:', err)
    return false
  }
}

export async function registrarPush(
  profileId: string, 
  salaoId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (typeof window === 'undefined') {
      return { ok: false, error: 'Ambiente de execução inválido (Server Side).' }
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push não suportado neste navegador.')
      return { ok: false, error: 'Push não suportado neste navegador.' }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('Permissão de notificação negada.')
      return { ok: false, error: 'Permissão de notificação negada.' }
    }

    const registration = await navigator.serviceWorker.ready

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      console.error('Chave pública VAPID não configurada.')
      return { ok: false, error: 'Chave pública VAPID não configurada.' }
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    })

    // Prepara os dados para salvar no Supabase
    const dadosParaSalvar: any = {
      profile_id: profileId,
      subscription: subscription.toJSON()
    }

    // Se o salaoId foi passado e sua tabela tiver essa coluna, salvamos junto para vincular o aparelho ao salão
    if (salaoId) {
      dadosParaSalvar.salao_id = salaoId
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(dadosParaSalvar, {
        onConflict: 'subscription'
      })

    if (error) {
      console.error('Erro ao salvar no Supabase:', error)
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (err: any) {
    console.error('Erro ao registrar push:', err)
    return { ok: false, error: err?.message || String(err) }
  }
}
