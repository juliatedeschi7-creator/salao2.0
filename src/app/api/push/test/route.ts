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

    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('profile_id', profileId)
      .single()

    if (!sub) {
      return NextResponse.json({
        ok: false,
        erro: 'Nenhuma subscription encontrada para este usuário. O navegador ainda não registrou o push.'
      }, { status: 404 })
    }

    await webpush.sendNotification(
      sub.subscription,
      JSON.stringify({
        title: '🔔 Organiza Salão',
        body: 'Push funcionando! Suas notificações estão ativas.',
        icon: '/logo.png',
        url: '/salao'
      })
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}