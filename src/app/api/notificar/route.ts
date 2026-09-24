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

  if (!email || !publicKey || !privateKey) {
    throw new Error(
      'Variáveis VAPID não configuradas corretamente no servidor.'
    )
  }

  webpush.setVapidDetails(
    email,
    publicKey,
    privateKey
  )

  vapidConfigurado = true
}

export async function POST(req: NextRequest) {
  try {
    const {
      salaoId,
      remetenteId,
      destinatarioId,
      titulo,
      mensagem,
      tipo,
      url,
    } = await req.json()

    console.log(
      '[notificar] chamada recebida',
      {
        salaoId,
        remetenteId,
        destinatarioId,
        titulo,
        tipo,
      }
    )

    if (
      !destinatarioId ||
      !titulo ||
      !mensagem
    ) {
      return NextResponse.json(
        {
          ok: false,
          erro:
            'Campos obrigatórios faltando (destinatarioId, titulo, mensagem).',
        },
        { status: 400 }
      )
    }

    // ============================================================
    // 1. CONFERE AS CHAVES VAPID
    // ============================================================

    const vapidEmail =
      !!process.env.VAPID_EMAIL

    const vapidPublic =
      !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    const vapidPrivate =
      !!process.env.VAPID_PRIVATE_KEY

    console.log(
      '[notificar] VAPID presentes?',
      {
        email: vapidEmail,
        public: vapidPublic,
        private: vapidPrivate,
      }
    )

    if (
      !vapidEmail ||
      !vapidPublic ||
      !vapidPrivate
    ) {
      return NextResponse.json(
        {
          ok: false,
          pushEnviado: false,
          erro:
            'As variáveis VAPID não estão configuradas corretamente no servidor.',
        },
        { status: 500 }
      )
    }

    // ============================================================
    // 2. PROCURA AS SUBSCRIPTIONS
    //
    // A tabela possui tanto profile_id quanto user_id.
    // Procuramos pelos dois para evitar incompatibilidade.
    // ============================================================

    const { data: subs, error: subsErr } =
      await supabase
        .from('push_subscriptions')
        .select(
          'id, profile_id, user_id, subscription, created_at, updated_at'
        )
        .or(
          `profile_id.eq.${destinatarioId},user_id.eq.${destinatarioId}`
        )

    if (subsErr) {
      console.error(
        '[notificar] erro ao buscar subscriptions:',
        subsErr
      )

      return NextResponse.json(
        {
          ok: false,
          pushEnviado: false,
          erro:
            'Erro ao buscar subscription: ' +
            subsErr.message,
        },
        { status: 500 }
      )
    }

    console.log(
      '[notificar] subscriptions encontradas para',
      destinatarioId,
      '=>',
      subs?.length || 0
    )

    if (!subs || subs.length === 0) {
      console.log(
        '[notificar] nenhuma subscription ativa — push não será enviado'
      )

      return NextResponse.json({
        ok: true,
        pushEnviado: false,
        enviados: 0,
        total: 0,
        motivo:
          'Nenhuma subscription encontrada para este destinatário.',
      })
    }

    // ============================================================
    // 3. CONFIGURA VAPID
    // ============================================================

    try {
      garantirVapidConfigurado()
    } catch (error: any) {
      console.error(
        '[notificar] erro ao configurar VAPID:',
        error
      )

      return NextResponse.json(
        {
          ok: false,
          pushEnviado: false,
          erro:
            'Erro ao configurar VAPID: ' +
            (error?.message || 'erro desconhecido'),
        },
        { status: 500 }
      )
    }

    // ============================================================
    // 4. ENVIA O PUSH
    // ============================================================

    let enviados = 0

    const detalhes: any[] = []

    for (const sub of subs) {
      const subscription =
        sub.subscription

      console.log(
        '[notificar] verificando subscription',
        {
          id: sub.id,
          profile_id: sub.profile_id,
          user_id: sub.user_id,
          endpointExiste:
            !!subscription?.endpoint,
          p256dhExiste:
            !!subscription?.keys?.p256dh,
          authExiste:
            !!subscription?.keys?.auth,
        }
      )

      if (
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth
      ) {
        console.log(
          '[notificar] subscription inválida/incompleta:',
          sub.id
        )

        detalhes.push({
          id: sub.id,
          status: 'subscription_invalida',
        })

        continue
      }

      try {
        await webpush.sendNotification(
          {
            endpoint:
              subscription.endpoint,
            keys: {
              p256dh:
                subscription.keys.p256dh,
              auth:
                subscription.keys.auth,
            },
          },
          JSON.stringify({
            title: titulo,
            body: mensagem,
            icon: '/logo.png',
            badge: '/logo.png',
            url: url || '/',
            tipo: tipo || 'sistema',
          })
        )

        enviados++

        console.log(
          '[notificar] PUSH ENVIADO COM SUCESSO',
          {
            subscriptionId:
              sub.id,
            destinatarioId,
          }
        )

        detalhes.push({
          id: sub.id,
          status: 'enviado',
        })
      } catch (err: any) {
        console.error(
          '[notificar] ERRO AO ENVIAR PUSH',
          {
            subscriptionId:
              sub.id,
            statusCode:
              err?.statusCode,
            mensagem:
              err?.message,
            body:
              err?.body,
          }
        )

        detalhes.push({
          id: sub.id,
          status: 'erro',
          statusCode:
            err?.statusCode,
          mensagem:
            err?.message,
          body:
            err?.body,
        })

        // ========================================================
        // Subscription considerada inválida pelo Push Service
        // ========================================================

        if (
          err?.statusCode === 404 ||
          err?.statusCode === 410
        ) {
          console.log(
            '[notificar] removendo subscription expirada/inválida:',
            sub.id
          )

          const {
            error: deleteError,
          } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)

          if (deleteError) {
            console.error(
              '[notificar] erro ao remover subscription:',
              deleteError
            )
          } else {
            console.log(
              '[notificar] subscription removida:',
              sub.id
            )
          }
        }
      }
    }

    console.log(
      '[notificar] resultado final',
      {
        enviados,
        total:
          subs.length,
      }
    )

    return NextResponse.json({
      ok: true,
      pushEnviado:
        enviados > 0,
      enviados,
      total:
        subs.length,
      detalhes,
    })
  } catch (err: any) {
    console.error(
      '[notificar] ERRO GERAL:',
      err
    )

    return NextResponse.json(
      {
        ok: false,
        pushEnviado: false,
        erro:
          err?.message ||
          'Erro interno ao enviar Push.',
      },
      { status: 500 }
    )
  }
}