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
    const { salaoId, remetenteId, destinatarioId, titulo, mensagem, tipo, url } = await req.json()

    console.log('[notificar] chamada recebida', { salaoId, remetenteId, destinatarioId, titulo })

    if (!destinatarioId || !titulo || !mensagem) {
      return NextResponse.json({ ok: false, erro: 'Campos obrigatórios faltando (destinatarioId, titulo, mensagem).' }, { status: 400 })
    }

    console.log('[notificar] vapid presentes?', {
      email: !!process.env.VAPID_EMAIL,
      public: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      private: !!process.env.VAPID_PRIVATE_KEY
    })

    const { error: insertErr } = await supabase.from('notificacoes').insert({
      salao_id: salaoId || null,
      remetente_id: remetenteId || null,
      destinatario_id: destinatarioId,
      titulo,
      mensagem,
      tipo: tipo || 'sistema'
    })

    if (insertErr) {
      console.log('[notificar] erro ao inserir no sininho', insertErr.message)
      return NextResponse.json({ ok: false, erro: 'DB: ' + insertErr.message }, { status: 500 })
    }

    console.log('[notificar] notificação gravada no sininho com sucesso')

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('profile_id', destinatarioId)

    if (subsErr) {
      console.log('[notificar] erro ao buscar subscriptions', subsErr.message)
    }

    console.log('[notificar] subscriptions encontradas para', destinatarioId, '=>', subs?.length || 0)

    if (!subs || subs.length === 0) {
      console.log('[notificar] nenhuma subscription ativa — push não será enviado')
      return NextResponse.json({ ok: true, pushEnviado: false, motivo: 'Sem subscription ativa.' })
    }

    let enviados = 0
    const detalhes: any[] = []

    for (const sub of subs) {
      const s = sub.subscription
      console.log('[notificar] tentando enviar push para subscription id', sub.id, 'endpoint existe?', !!s?.endpoint, 'keys existem?', !!s?.keys?.p256dh, !!s?.keys?.auth)
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.keys?.p256dh, auth: s.keys?.auth } },
          JSON.stringify({ title: titulo, body: mensagem, icon: '/logo.png', url: url || '/' })
        )
        enviados++
        console.log('[notificar] push enviado com sucesso para id', sub.id)
        detalhes.push({ id: sub.id, status: 'enviado' })
      } catch (err: any) {
        console.log('[notificar] ERRO ao enviar push para id', sub.id, 'statusCode:', err.statusCode, 'mensagem:', err.message, 'body:', err.body)
        detalhes.push({ id: sub.id, status: 'erro', statusCode: err.statusCode, mensagem: err.message })
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log('[notificar] removendo subscription expirada id', sub.id)
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    console.log('[notificar] resultado final', { enviados, total: subs.length })

    return NextResponse.json({ ok: true, pushEnviado: enviados > 0, enviados, total: subs.length, detalhes })
  } catch (err: any) {
    console.log('[notificar] ERRO GERAL', err.message)
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
