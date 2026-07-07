import { supabase } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String: string) {
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

export async function verificarPushAtivo(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  if (!('serviceWorker' in navigator)) return false

  const registration = await navigator.serviceWorker.getRegistration()

  if (!registration) return false

  const subscription = await registration.pushManager.getSubscription()

  return subscription !== null
}

export async function registrarPush(
  profileId: string,
  salaoId?: string
): Promise<boolean> {

  try {

    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker não suportado.')
      return false
    }

    if (!('PushManager' in window)) {
      console.warn('Push não suportado.')
      return false
    }

    const permission = await Notification.requestPermission()

    if (permission !== 'granted') {
      return false
    }

    const registration = await navigator.serviceWorker.register('/sw.js')

    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        )
      })

    }

const { data, error } = await supabase
  .from('push_subscriptions')
  .upsert({
    profile_id: profileId,
    salao_id: salaoId ?? null,
    subscription
  })
  .select()

console.log('Subscription salva:', data)

if (error) {
  console.error('Erro ao salvar subscription:', error)
  return false
}

    return true

  } catch (e) {
    console.error(e)
    return false
  }
}