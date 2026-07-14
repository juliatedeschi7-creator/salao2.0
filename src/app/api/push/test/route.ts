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
  console.log('1 - Entrou na rota')

  try {
    const { profileId } = await req.json()
    console.log('2 - profileId:', profileId)

    const { data: subs, error: dbErr } = await supabase
      .from('push_subscriptions')
      .select('id, subscription, updated_at')
      .eq('profile_id', profileId)
      .order('updated_at', { ascending: false })

    console.log('3 - Consulta ao banco finalizada')

    if (dbErr) {
      console.log('Erro banco:', dbErr)
      return NextResponse.json({ ok: false, erro: 'DB: ' + dbErr.message }, { status: 500 })
    }

    if (!subs || subs.length === 0) {
      console.log('Nenhuma subscription')
      return NextResponse.json({ ok: false, erro: 'Nenhuma subscription encontrada.' }, { status: 404 })
    }

    console.log('4 - Subscriptions:', subs.length)

    const detalhes: any[] = []

    for (const sub of subs) {
      console.log('5 - Enviando para:', sub.id)

      const s = sub.subscription

      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: {
              p256dh: s.keys?.p256dh,
              auth: s.keys?.auth
            }
          },
          JSON.stringify({
            title: '🔔 Organiza Salão',
            body: 'Push funcionando!',
            icon: '/logo.png',
            url: '/salao'
          })
        )

        console.log('6 - Push enviado')

        detalhes.push({
          id: sub.id,
          status: 'enviado'
        })

      } catch (err: any) {

        console.log('7 - Erro envio', err)

        detalhes.push({
          id: sub.id,
          status: 'erro',
          statusCode: err.statusCode,
          mensagem: err.message
        })

        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }
      }
    }

    console.log('8 - Finalizando')

    const enviados = detalhes.filter(d => d.status === 'enviado').length

    return NextResponse.json({
      ok: enviados > 0,
      enviados,
      total: subs.length,
      detalhes
    })

  } catch (err: any) {
    console.log('ERRO GERAL:', err)

    return NextResponse.json({
      ok: false,
      erro: err.message
    }, { status: 500 })
  }
}