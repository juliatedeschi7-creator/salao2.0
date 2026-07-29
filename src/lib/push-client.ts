import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

// Função auxiliar de timeout para evitar travamentos
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

// Converte a chave VAPID para Uint8Array
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
  console.log('[PUSH DEBUG] Iniciando registrarPush para profileId:', profileId)

  try {
    if (typeof window === 'undefined') {
      return false
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PUSH DEBUG] Push não suportado neste navegador/dispositivo.')
      return false
    }

    const permission = await Notification.requestPermission()
    console.log('[PUSH DEBUG] Status da permissão:', permission)

    if (permission !== 'granted') {
      console.warn('[PUSH DEBUG] Permissão de notificação negada.')
      return false
    }

    let registration: ServiceWorkerRegistration
    try {
      registration = await navigator.serviceWorker.register('/sw.js')
    } catch (e) {
      console.error('[PUSH DEBUG] Falha ao registrar o service worker:', e)
      return false
    }

    registration = await comTimeout(
      navigator.serviceWorker.ready, 
      8000, 
      'Timeout esperando o service worker ficar pronto'
    )

    if (!vapidPublicKey) {
      console.error('[PUSH DEBUG] Chave pública VAPID não configurada.')
      return false
    }

    // Tenta buscar inscrição existente e limpa caso tenha expirado
    let subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      try {
        await subscription.unsubscribe()
        console.log('[PUSH DEBUG] Inscrição antiga removida para renovação de token.')
      } catch (e) {
        console.log('[PUSH DEBUG] Não foi possível remover inscrição antiga, prosseguindo...', e)
      }
    }

    // Cria uma nova subscription limpa e atualizada
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
    })
    console.log('[PUSH DEBUG] Nova subscription gerada com sucesso.')

    const subJson = subscription.toJSON()

    // Salvando no Supabase adaptado à estrutura da tabela
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        profile_id: profileId,
        user_id: profileId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        subscripition: subJson,               
        updataed_at: new Date().toISOString() 
      }, {
        onConflict: 'profile_id'
      })

    if (error) {
      console.error('[PUSH DEBUG] Erro ao salvar no Supabase:', error)
      return false
    }

    console.log('[PUSH DEBUG] Push registrado e salvo com sucesso!')
    return true
  } catch (err) {
    console.error('[PUSH DEBUG] Erro crítico capturado no catch:', err)
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
    console.error('Erro ao verificar push ativo:', err)
    return false
  }
}
