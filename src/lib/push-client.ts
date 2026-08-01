import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function registrarPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const reg = await navigator.serviceWorker.register('/sw.js')
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return false

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    const subJson = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      profile_id: userId,
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    }, { onConflict: 'profile_id' })

    return true
  } catch {
    return false
  }
}

export async function verificarPushAtivo(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return true // SSR: não mostra modal
  if (!('Notification' in window)) return true   // browser sem suporte: não insiste
  if (Notification.permission === 'granted') return true // já tem permissão

  const { data } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()

  return !!data
}
