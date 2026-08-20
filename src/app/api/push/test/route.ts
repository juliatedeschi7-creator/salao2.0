// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let vapidConfigurado = false

function garantirVapidConfigurado() {
  if (vapidConfigurado) return

  const email = process.env.VAPID_EMAIL
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  console.log('[PUSH TEST] Verificando VAPID:', {
    emailPresente: !!email,
    publicPresente: !!publicKey,
    privatePresente: !!privateKey,
    publicLength: publicKey?.length || 0,
    privateLength: privateKey?.length || 0,
  })

  if (!email || !publicKey || !privateKey) {
    throw new Error(
      'Variáveis VAPID incompletas. Verifique VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.'
    )
  }

  webpush.setVapidDetails(
    email,
    publicKey,
    privateKey
  )

  vapidConfigurado = true

  console.log('[PUSH TEST] VAPID configurado com sucesso')
}

export async function POST(req: NextRequest) {
  console.log('==========================================')
  console.log('[PUSH TEST] 1 - Entrou na rota')
  console.log('==========================================')

  try {
    // ============================================================
    // 1. RECEBER PROFILE ID
    // ============================================================

    const body = await req.json()

    const profileId = body?.profileId

    console.log('[PUSH TEST] 2 - profileId recebido:', profileId)

    if (!profileId) {
      console.log(
        '[PUSH TEST] ERRO - profileId não foi enviado'
      )

      return NextResponse.json(
        {
          ok: false,
          erro: 'profileId não informado.'
        },
        { status: 400 }
      )
    }

    // ============================================================
    // 2. BUSCAR SUBSCRIPTIONS
    // ============================================================

    const {
      data: subs,
      error: dbErr
    } = await supabase
      .from('push_subscriptions')
      .select(
        'id, profile_id, user_id, salao_id, subscription, created_at, updated_at'
      )
      .eq('profile_id', profileId)
      .order('updated_at', {
        ascending: false
      })

    console.log(
      '[PUSH TEST] 3 - Consulta ao banco finalizada'
    )

    if (dbErr) {
      console.error(
        '[PUSH TEST] ERRO no banco:',
        dbErr
      )

      return NextResponse.json(
        {
          ok: false,
          erro: 'Erro ao consultar subscriptions: ' + dbErr.message
        },
        { status: 500 }
      )
    }

    console.log(
      '[PUSH TEST] 4 - Subscriptions encontradas:',
      subs?.length || 0
    )

    if (!subs || subs.length === 0) {
      console.log(
        '[PUSH TEST] Nenhuma subscription encontrada para profile:',
        profileId
      )

      return NextResponse.json(
        {
          ok: false,
          enviados: 0,
          total: 0,
          erro: 'Nenhuma subscription encontrada para este perfil.'
        },
        { status: 404 }
      )
    }

    // ============================================================
    // 3. CONFIGURAR VAPID
    // ============================================================

    try {
      garantirVapidConfigurado()
    } catch (e: any) {
      console.error(
        '[PUSH TEST] ERRO ao configurar VAPID:',
        e?.message
      )

      return NextResponse.json(
        {
          ok: false,
          enviados: 0,
          total: subs.length,
          erro:
            'Chave VAPID mal configurada: ' +
            (e?.message || 'erro desconhecido')
        },
        { status: 500 }
      )
    }

    // ============================================================
    // 4. ENVIAR PARA CADA SUBSCRIPTION
    // ============================================================

    const detalhes: any[] = []

    for (const sub of subs) {
      console.log('------------------------------------------')
      console.log(
        '[PUSH TEST] 5 - Processando subscription:',
        sub.id
      )

      const s = sub.subscription

      // ----------------------------------------------------------
      // Validar estrutura
      // ----------------------------------------------------------

      if (!s) {
        console.error(
          '[PUSH TEST] Subscription vazia:',
          sub.id
        )

        detalhes.push({
          id: sub.id,
          status: 'erro',
          etapa: 'validacao',
          mensagem: 'Campo subscription está vazio.'
        })

        continue
      }

      if (!s.endpoint) {
        console.error(
          '[PUSH TEST] Endpoint ausente:',
          sub.id
        )

        detalhes.push({
          id: sub.id,
          status: 'erro',
          etapa: 'validacao',
          mensagem: 'Endpoint da subscription está ausente.'
        })

        continue
      }

      if (!s.keys?.p256dh || !s.keys?.auth) {
        console.error(
          '[PUSH TEST] Chaves da subscription ausentes:',
          sub.id
        )

        detalhes.push({
          id: sub.id,
          status: 'erro',
          etapa: 'validacao',
          mensagem:
            'A subscription não possui p256dh e/ou auth.'
        })

        continue
      }

      // ----------------------------------------------------------
      // Mostrar informações do endpoint
      // ----------------------------------------------------------

      let endpointHost = ''

      try {
        endpointHost = new URL(
          s.endpoint
        ).host
      } catch {
        endpointHost = 'endpoint inválido'
      }

      console.log(
        '[PUSH TEST] 5.1 - Endpoint:',
        s.endpoint
      )

      console.log(
        '[PUSH TEST] 5.2 - Host do Push Service:',
        endpointHost
      )

      console.log(
        '[PUSH TEST] 5.3 - p256dh presente:',
        !!s.keys?.p256dh
      )

      console.log(
        '[PUSH TEST] 5.4 - auth presente:',
        !!s.keys?.auth
      )

      console.log(
        '[PUSH TEST] 5.5 - expirationTime:',
        s.expirationTime ?? null
      )

      // ----------------------------------------------------------
      // Montar payload
      // ----------------------------------------------------------

      const payload = {
        title: '🔔 Organiza Salão',
        body: 'Push funcionando!',
        icon: '/logo.png',
        badge: '/logo.png',
        url: '/salao',
        data: {
          url: '/salao',
          tipo: 'teste_push'
        }
      }

      console.log(
        '[PUSH TEST] 5.6 - Payload:',
        payload
      )

      // ----------------------------------------------------------
      // ENVIO REAL
      // ----------------------------------------------------------

      try {
        console.log(
          '[PUSH TEST] 5.7 - INICIANDO webpush.sendNotification...'
        )

        const inicioEnvio = Date.now()

        const respostaPush =
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: {
                p256dh: s.keys.p256dh,
                auth: s.keys.auth
              }
            },
            JSON.stringify(payload),
            {
              TTL: 60 * 60 * 24,
              urgency: 'high'
            }
          )

        const duracaoEnvio =
          Date.now() - inicioEnvio

        console.log(
          '[PUSH TEST] 6 - PUSH ACEITO PELO PUSH SERVICE'
        )

        console.log(
          '[PUSH TEST] 6.1 - Status:',
          respostaPush?.statusCode
        )

        console.log(
          '[PUSH TEST] 6.2 - Headers:',
          respostaPush?.headers
        )

        console.log(
          '[PUSH TEST] 6.3 - Tempo de envio:',
          duracaoEnvio,
          'ms'
        )

        detalhes.push({
          id: sub.id,
          status: 'enviado',
          pushServiceStatus:
            respostaPush?.statusCode || null,
          endpointHost,
          duracaoMs: duracaoEnvio
        })

      } catch (err: any) {
        console.error(
          '[PUSH TEST] 7 - ERRO REAL NO ENVIO'
        )

        console.error(
          '[PUSH TEST] statusCode:',
          err?.statusCode
        )

        console.error(
          '[PUSH TEST] message:',
          err?.message
        )

        console.error(
          '[PUSH TEST] body:',
          err?.body
        )

        console.error(
          '[PUSH TEST] headers:',
          err?.headers
        )

        detalhes.push({
          id: sub.id,
          status: 'erro',
          endpointHost,
          statusCode:
            err?.statusCode || null,
          mensagem:
            err?.message ||
            'Erro desconhecido',
          body:
            err?.body || null
        })

        // --------------------------------------------------------
        // Subscription expirada/inválida
        // --------------------------------------------------------

        if (
          err?.statusCode === 404 ||
          err?.statusCode === 410
        ) {
          console.log(
            '[PUSH TEST] Subscription expirada/inválida.'
          )

          console.log(
            '[PUSH TEST] Removendo subscription:',
            sub.id
          )

          const {
            error: deleteError
          } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)

          if (deleteError) {
            console.error(
              '[PUSH TEST] Erro ao remover subscription:',
              deleteError
            )
          } else {
            console.log(
              '[PUSH TEST] Subscription removida com sucesso.'
            )
          }
        }
      }
    }

    // ============================================================
    // 5. RESULTADO FINAL
    // ============================================================

    const enviados =
      detalhes.filter(
        d => d.status === 'enviado'
      ).length

    const erros =
      detalhes.filter(
        d => d.status === 'erro'
      ).length

    console.log('==========================================')
    console.log(
      '[PUSH TEST] 8 - RESULTADO FINAL'
    )
    console.log('==========================================')

    console.log({
      profileId,
      total: subs.length,
      enviados,
      erros,
      detalhes
    })

    /*
      IMPORTANTE:

      "enviado" aqui significa que o Push Service
      aceitou a requisição.

      Isso NÃO significa necessariamente que o
      iPhone já exibiu a notificação.

      A exibição depende do Service Worker.
    */

    return NextResponse.json({
      ok: enviados > 0,
      pushEnviado: enviados > 0,
      enviados,
      erros,
      total: subs.length,
      detalhes
    })

  } catch (err: any) {
    console.error(
      '[PUSH TEST] ERRO GERAL:',
      err
    )

    return NextResponse.json(
      {
        ok: false,
        erro:
          err?.message ||
          'Erro desconhecido no teste de Push.'
      },
      { status: 500 }
    )
  }
}