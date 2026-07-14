import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { profileId } = await req.json()

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('profile_id', profileId)
      .order('updated_at', { ascending: false })

    if (!subs || subs.length === 0) {
      return NextResponse.json({
        ok: false,
        erro: 'Nenhuma subscription encontrada para este usuário.'
      }, { status: 404 })
    }

    // Tenta enviar para todas as subscriptions do usuário
    const resultados = await Promise.allSettled(
      subs.map(async sub => {
        try {
          await webpush.sendNotification(
            sub.subscription,
            JSON.stringify({
              title: '🔔 Organiza Salão',
              body: 'Push funcionando! Suas notificações estão ativas.',
              icon: '/logo.png',
              url: '/salao'
            })
          )
          return { ok: true, id: sub.id }
        } catch (err: any) {
          // Remove subscriptions expiradas/inválidas
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
          throw err
        }
      })
    )

    const enviados = resultados.filter(r => r.status === 'fulfilled').length
    const erros = resultados.filter(r => r.status === 'rejected')

    if (enviados > 0) {
      return NextResponse.json({ ok: true, enviados })
    }

    const primeiroErro = erros[0] as PromiseRejectedResult
    return NextResponse.json({
      ok: false,
      erro: primeiroErro?.reason?.message || 'Falha ao enviar'
    }, { status: 500 })

  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
