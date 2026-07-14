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

export interface ResultadoPush {
  ok: boolean
  motivo?: string
}

// Agora devolve { ok, motivo } em vez de só true/false — assim a tela
// consegue mostrar exatamente o que falhou (chave VAPID ausente, service
// worker não registrou, permissão negada, erro do Supabase, etc) sem
// precisar abrir o console do navegador pra depurar.
export async function registrarPush(
  profileId: string,
  salaoId?: string
): Promise<ResultadoPush> {
  try {
    if (!('serviceWorker' in navigator)) {
      return { ok: false, motivo: 'Este navegador não suporta Service Worker.' }
    }

    if (!('PushManager' in window)) {
      return { ok: false, motivo: 'Este navegador não suporta notificações push. No iOS, precisa ser pelo app instalado na tela de início (não pelo Safari direto).' }
    }

    const chavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!chavePublica) {
      return { ok: false, motivo: 'Chave VAPID pública não configurada (NEXT_PUBLIC_VAPID_PUBLIC_KEY ausente no build).' }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return {
        ok: false,
        motivo: permission === 'denied'
          ? 'Permissão de notificação foi negada. Vá nas configurações do dispositivo/navegador e libere manualmente.'
          : 'Permissão de notificação não foi concedida.'
      }
    }

    let registration: ServiceWorkerRegistration
    try {
      registration = await navigator.serviceWorker.register('/sw.js')
    } catch (e: any) {
      return { ok: false, motivo: 'Falha ao registrar o Service Worker (/sw.js): ' + (e?.message || String(e)) }
    }

    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(chavePublica)
        })
      } catch (e: any) {
        return { ok: false, motivo: 'Falha ao criar inscrição push: ' + (e?.message || String(e)) }
      }
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        profile_id: profileId,
        salao_id: salaoId ?? null,
        subscription
      })
      .select()

    if (error) {
      return { ok: false, motivo: 'Erro ao salvar no banco: ' + error.message }
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, motivo: 'Erro inesperado: ' + (e?.message || String(e)) }
  }
}
