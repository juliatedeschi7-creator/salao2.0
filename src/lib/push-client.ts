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

// Evita que o app fique travado pra sempre esperando uma Promise que nunca resolve
function comTimeout<T>(promise: Promise<T>, ms: number, mensagemErro: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(mensagemErro)), ms))
  ])
}

export async function verificarPushAtivo(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  const permission = Notification.permission
  if (permission !== 'granted') return false

  try {
    const registration = await comTimeout(navigator.serviceWorker.ready, 5000, 'Timeout ao verificar service worker')
    const subscription = await registration.pushManager.getSubscription()
    return !!subscription
  } catch (err) {
    console.error('Erro ao verificar push ativo:', err)
    return false
  }
}

export async function registrarPush(profileId: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push não suportado neste navegador.')
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('Permissão de notificação negada.')
      return false
    }

    // Registra o service worker explicitamente — se ele já estiver registrado,
    // o navegador só devolve o registration existente, sem duplicar nada.
    let registration: ServiceWorkerRegistration
    try {
      registration = await navigator.serviceWorker.register('/sw.js')
    } catch (e) {
      console.error('Falha ao registrar o service worker:', e)
      return false
    }

    // Espera o service worker ficar pronto, com limite de tempo pra nunca travar
    registration = await comTimeout(navigator.serviceWorker.ready, 8000, 'Timeout esperando o service worker ficar pronto')

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      console.error('Chave pública VAPID não configurada.')
      return false
    }

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        profile_id: profileId,
        subscription: subscription.toJSON()
      }, {
        onConflict: 'profile_id'
      })

    if (error) {
      console.error('Erro ao salvar no Supabase:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Erro ao registrar push:', err)
    return false
  }
}
