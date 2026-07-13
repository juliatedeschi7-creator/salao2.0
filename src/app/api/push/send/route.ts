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
    const { userId, title, body, url } = await req.json()
    if (!userId || !title) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const { data: subs } = await supabase.from('push_subscriptions')
      .select('*').eq('user_id', userId)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0 })
    }

    const payload = JSON.stringify({ title, body, url: url || '/' })
    const resultados = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async err => {
          // Remove subscriptions inválidas/expiradas
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
          throw err
        })
      )
    )

    const enviados = resultados.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, enviados })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
