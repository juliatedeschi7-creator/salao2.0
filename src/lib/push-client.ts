import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat(
    (4 - (base64String.length % 4)) % 4
  )

  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)

  return Uint8Array.from(
    [...rawData].map(c => c.charCodeAt(0))
  )
}

export async function registrarPush(
  userId: string
): Promise<boolean> {
  if (typeof window === 'undefined') {
    console.log('[PUSH] Executando no servidor. Abortando.')
    return false
  }

  if (!userId) {
    console.log('[PUSH] userId não informado.')
    return false
  }

  if (!('Notification' in window)) {
    console.log('[PUSH] Notification API não disponível.')
    return false
  }

  if (!('serviceWorker' in navigator)) {
    console.log('[PUSH] Service Worker não disponível.')
    return false
  }

  if (!('PushManager' in window)) {
    console.log('[PUSH] PushManager não disponível.')
    return false
  }

  try {
    // ============================================================
    // 1. PERMISSÃO
    // ============================================================

    console.log('[PUSH] Solicitando permissão...')

    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()

    console.log(
      '[PUSH] Permissão:',
      permission
    )

    if (permission !== 'granted') {
      console.log(
        '[PUSH] Permissão não concedida.'
      )

      return false
    }

    // ============================================================
    // 2. REGISTRAR SERVICE WORKER
    // ============================================================

    console.log(
      '[PUSH] Registrando /sw.js...'
    )

    const registration =
      await navigator.serviceWorker.register(
        '/sw.js',
        {
          scope: '/',
          updateViaCache: 'none'
        }
      )

    console.log(
      '[PUSH] Service Worker registrado:',
      registration.scope
    )

    // ============================================================
    // 3. FORÇAR ATUALIZAÇÃO DO SERVICE WORKER
    // ============================================================

    try {
      await registration.update()

      console.log(
        '[PUSH] Service Worker atualizado/verificado.'
      )
    } catch (updateError) {
      console.log(
        '[PUSH] Não foi possível forçar update do SW:',
        updateError
      )
    }

    // ============================================================
    // 4. ESPERAR O SERVICE WORKER FICAR PRONTO
    // ============================================================

    const readyRegistration =
      await navigator.serviceWorker.ready

    console.log(
      '[PUSH] Service Worker pronto.'
    )

    console.log(
      '[PUSH] Scope:',
      readyRegistration.scope
    )

    // ============================================================
    // 5. VERIFICAR VAPID
    // ============================================================

    const vapidKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    if (!vapidKey) {
      console.error(
        '[PUSH] NEXT_PUBLIC_VAPID_PUBLIC_KEY não encontrada.'
      )

      return false
    }

    console.log(
      '[PUSH] VAPID public key encontrada.'
    )

    // ============================================================
    // 6. VERIFICAR SE JÁ EXISTE SUBSCRIPTION
    // ============================================================

    let sub =
      await readyRegistration.pushManager.getSubscription()

    if (sub) {
      console.log(
        '[PUSH] Subscription existente encontrada.'
      )

      console.log(
        '[PUSH] Endpoint:',
        sub.endpoint
      )
    }

    // ============================================================
    // 7. CRIAR SUBSCRIPTION SE NÃO EXISTIR
    // ============================================================

    if (!sub) {
      console.log(
        '[PUSH] Nenhuma subscription local encontrada.'
      )

      console.log(
        '[PUSH] Criando nova subscription...'
      )

      sub =
        await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(vapidKey)
        })

      console.log(
        '[PUSH] Nova subscription criada.'
      )

      console.log(
        '[PUSH] Endpoint:',
        sub.endpoint
      )
    }

    // ============================================================
    // 8. CONVERTER PARA JSON
    // ============================================================

    const subJson = sub.toJSON()

    console.log(
      '[PUSH] Subscription JSON:',
      {
        endpoint: subJson.endpoint,
        possuiKeys: !!subJson.keys,
        possuiP256dh: !!subJson.keys?.p256dh,
        possuiAuth: !!subJson.keys?.auth
      }
    )

    if (
      !subJson.endpoint ||
      !subJson.keys?.p256dh ||
      !subJson.keys?.auth
    ) {
      console.error(
        '[PUSH] Subscription inválida. Endpoint ou keys ausentes.'
      )

      return false
    }

    // ============================================================
    // 9. SALVAR NO SUPABASE
    // ============================================================

    console.log(
      '[PUSH] Salvando subscription no Supabase...'
    )

    const subscriptionData = {
      endpoint: subJson.endpoint,
      expirationTime:
        subJson.expirationTime ?? null,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
      }
    }

    const { error } =
      await supabase
        .from('push_subscriptions')
        .upsert(
          {
            profile_id: userId,

            user_id: userId,

            subscription: subscriptionData,

            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'profile_id'
          }
        )

    if (error) {
      console.error(
        '[PUSH] ERRO ao salvar subscription:',
        error
      )

      return false
    }

    console.log(
      '[PUSH] Subscription salva com sucesso no Supabase.'
    )

    // ============================================================
    // 10. CONFIRMAÇÃO FINAL NO BANCO
    // ============================================================

    const { data: confirmacao, error: confirmacaoError } =
      await supabase
        .from('push_subscriptions')
        .select(
          'id, profile_id, subscription, updated_at'
        )
        .eq('profile_id', userId)
        .maybeSingle()

    if (confirmacaoError) {
      console.error(
        '[PUSH] Erro ao confirmar subscription:',
        confirmacaoError
      )

      return false
    }

    if (!confirmacao?.subscription?.endpoint) {
      console.error(
        '[PUSH] Subscription não foi encontrada corretamente após salvar.'
      )

      return false
    }

    console.log(
      '[PUSH] ========================================'
    )

    console.log(
      '[PUSH] PUSH REGISTRADO COM SUCESSO'
    )

    console.log(
      '[PUSH] Subscription ID:',
      confirmacao.id
    )

    console.log(
      '[PUSH] Endpoint:',
      confirmacao.subscription.endpoint
    )

    console.log(
      '[PUSH] ========================================'
    )

    return true

  } catch (error) {
    console.error(
      '[PUSH] ERRO AO REGISTRAR PUSH:',
      error
    )

    return false
  }
}


// ============================================================
// VERIFICAR SE O PUSH ESTÁ REALMENTE ATIVO
// ============================================================

export async function verificarPushAtivo(
  userId: string
): Promise<boolean> {

  if (typeof window === 'undefined') {
    return false
  }

  if (!userId) {
    return false
  }

  if (!('Notification' in window)) {
    return false
  }

  if (!('serviceWorker' in navigator)) {
    return false
  }

  if (!('PushManager' in window)) {
    return false
  }

  try {
    // ==========================================================
    // 1. VERIFICAR PERMISSÃO
    // ==========================================================

    if (
      Notification.permission !== 'granted'
    ) {
      console.log(
        '[PUSH CHECK] Permissão não concedida.'
      )

      return false
    }

    // ==========================================================
    // 2. PEGAR SERVICE WORKER
    // ==========================================================

    const registration =
      await navigator.serviceWorker.ready

    // ==========================================================
    // 3. VERIFICAR SUBSCRIPTION LOCAL
    // ==========================================================

    const localSubscription =
      await registration.pushManager.getSubscription()

    if (!localSubscription) {
      console.log(
        '[PUSH CHECK] Não existe subscription local.'
      )

      return false
    }

    console.log(
      '[PUSH CHECK] Subscription local encontrada.'
    )

    // ==========================================================
    // 4. VERIFICAR BANCO
    // ==========================================================

    const {
      data,
      error
    } = await supabase
      .from('push_subscriptions')
      .select(
        'id, subscription, updated_at'
      )
      .eq('profile_id', userId)
      .maybeSingle()

    if (error) {
      console.error(
        '[PUSH CHECK] Erro ao consultar banco:',
        error
      )

      return false
    }

    if (!data?.subscription) {
      console.log(
        '[PUSH CHECK] Não existe subscription no banco.'
      )

      return false
    }

    // ==========================================================
    // 5. COMPARAR ENDPOINT LOCAL X BANCO
    // ==========================================================

    const endpointLocal =
      localSubscription.endpoint

    const endpointBanco =
      data.subscription.endpoint

    if (
      !endpointBanco ||
      endpointLocal !== endpointBanco
    ) {
      console.log(
        '[PUSH CHECK] Subscription local e banco são diferentes.'
      )

      console.log(
        '[PUSH CHECK] Endpoint local:',
        endpointLocal
      )

      console.log(
        '[PUSH CHECK] Endpoint banco:',
        endpointBanco
      )

      return false
    }

    console.log(
      '[PUSH CHECK] ========================================'
    )

    console.log(
      '[PUSH CHECK] PUSH ATIVO E SINCRONIZADO'
    )

    console.log(
      '[PUSH CHECK] ========================================'
    )

    return true

  } catch (error) {
    console.error(
      '[PUSH CHECK] ERRO:',
      error
    )

    return false
  }
}