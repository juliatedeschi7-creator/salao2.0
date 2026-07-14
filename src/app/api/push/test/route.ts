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

    const { data: subs, error: dbErr } = await supabase
      .from('push_subscriptions')
      .select('id, subscription, updated_at')
      .eq('profile_id', profileId)
      .order('updated_at', { ascending: false })

    if (dbErr) return NextResponse.json({ ok: false, erro: 'DB: ' + dbErr.message }, { status: 500 })
    if (!subs || subs.length === 0) return NextResponse.json({ ok: false, erro: 'Nenhuma subscription encontrada.' }, { status: 404 })

    const detalhes: any[] = []

    for (const sub of subs) {
      const s = sub.subscription
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.keys?.p256dh, auth: s.keys?.auth } },
          JSON.stringify({
            title: '🔔 Organiza Salão',
            body: 'Push funcionando!',
            icon: '/logo.png',
            url: '/salao'
          })
        )
        detalhes.push({ id: sub.id, status: 'enviado', endpoint: s.endpoint?.substring(0, 50) })
      } catch (err: any) {
        detalhes.push({
          id: sub.id,
          status: 'erro',
          statusCode: err.statusCode,
          mensagem: err.message,
          endpoint: s.endpoint?.substring(0, 50)
        })
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    const enviados = detalhes.filter(d => d.status === 'enviado').length
    return NextResponse.json({ ok: enviados > 0, enviados, total: subs.length, detalhes })
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
