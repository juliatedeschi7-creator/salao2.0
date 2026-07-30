import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function comTimeout<T>(promise: Promise<T>, ms: number, mensagemErro: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(mensagemErro)), ms)
    promise
      .then(value => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch(reason => {
        clearTimeout(timer)
        reject(reason)
      })
  })
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registrarPush(profileId: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') {
      return false
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('DIAG: Push não suportado')
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      alert('DIAG: Permissão negada')
      return false
    }

    let registration: ServiceWorkerRegistration
    try {
      registration = await navigator.serviceWorker.register('/sw.js')
      alert('DIAG: Service Worker registrado com sucesso!')
    } catch (e: any) {
      alert('DIAG Erro SW.register: ' + (e?.message || e))
      return false
    }

    try {
      registration = await comTimeout(
        navigator.serviceWorker.ready, 
        8000, 
        'Timeout esperando o service worker ficar pronto'
      )
      alert('DIAG: Service Worker ready!')
    } catch (e: any) {
      alert('DIAG Erro SW.ready: ' + (e?.message || e))
      return false
    }

    if (!vapidPublicKey) {
      alert('DIAG: VAPID Key vazia')
      return false
    }

    let subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      try {
        await subscription.unsubscribe()
      } catch (e) {
        // Ignora
      }
    }

    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
      })
      alert('DIAG: Subscription gerada com sucesso!')
    } catch (e: any) {
      alert('DIAG Erro PushManager.subscribe: ' + (e?.message || e))
      return false
    }

    const subJson = subscription.toJSON()

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        profile_id: profileId,
        user_id: profileId,
        subscription: subJson,              
        updated_at: new Date().toISOString() 
      }, {
        onConflict: 'profile_id'
      })

    if (error) {
      alert('DIAG Erro Supabase: ' + JSON.stringify(error))
      return false
    }

    alert('DIAG: Tudo 100% concluído com sucesso!')
    return true
  } catch (err: any) {
    alert('DIAG Erro Geral Catch: ' + (err?.message || JSON.stringify(err)))
    return false
  }
}

export async function verificarPushAtivo(profileId: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (!subscription) return false

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('profile_id', profileId)
      .maybeSingle()

    if (error || !data) return false

    return true
  } catch (err) {
    return false
  }
}
