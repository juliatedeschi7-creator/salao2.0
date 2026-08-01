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

// IMPORTANTE: nunca usar alert() aqui dentro. alert() trava a thread
// inteira do JavaScript até a pessoa tocar em "Fechar" — incluindo
// qualquer redirecionamento (window.location.href) que já estivesse
// em andamento em paralelo. Isso fazia parecer que o LOGIN travava,
// quando na real era o registro de push (que roda em segundo plano,
// sem await, logo depois do login) que ficava preso num alert().
// Erros aqui devem só ir pro console — essa função nunca deve poder
// travar a tela de quem está logando.
export async function registrarPush(profileId: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') {
      return false
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return false
    }

    let registration: ServiceWorkerRegistration
    try {
      registration = await navigator.serviceWorker.register('/sw.js')
    } catch (e: any) {
      console.error('[push] erro ao registrar service worker:', e)
      return false
    }

    try {
      registration = await comTimeout(
        navigator.serviceWorker.ready,
        8000,
        'Timeout esperando o service worker ficar pronto'
      )
    } catch (e: any) {
      console.error('[push] timeout no service worker:', e)
      return false
    }

    if (!vapidPublicKey) {
      console.error('[push] VAPID public key está vazia — verifique NEXT_PUBLIC_VAPID_PUBLIC_KEY na Vercel.')
      return false
    }

    let subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      try {
        await subscription.unsubscribe()
      } catch (e) {
        // Ignora — segue tentando criar uma nova subscription
      }
    }

    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
      })
    } catch (e: any) {
      console.error('[push] erro no subscribe:', e?.name, e?.message || e)
      return false
    }

    const subJson = subscription.toJSON()

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        profile_id: profileId,
        subscription: subJson,
      }, {
        onConflict: 'profile_id'
      })

    if (error) {
      console.error('[push] erro ao salvar subscription no Supabase:', error)
      return false
    }

    return true
  } catch (err: any) {
    console.error('[push] erro geral em registrarPush:', err)
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