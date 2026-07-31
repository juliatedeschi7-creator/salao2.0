import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mesma correção do /api/notificar: setVapidDetails não pode rodar no
// topo do arquivo, senão quebra o build quando a chave estiver ausente
// ou mal formatada (o Next.js executa esse código durante "Collecting
// page data", mesmo sem ninguém ter chamado a rota).
let vapidConfigurado = false
function garantirVapidConfigurado() {
  if (vapidConfigurado) return
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  vapidConfigurado = true
}

export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, url } = await req.json()
    if (!userId || !title) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Corrigido: a tabela real usa "profile_id" (não "user_id") e guarda
    // tudo dentro de um campo "subscription" jsonb (não colunas separadas
    // endpoint/p256dh/auth).
    const { data: subs } = await supabase.from('push_subscriptions')
      .select('id, subscription').eq('profile_id', userId)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0 })
    }

    try {
      garantirVapidConfigurado()
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: 'Chave VAPID mal configurada: ' + e.message }, { status: 500 })
    }

    const payload = JSON.stringify({ title, body, url: url || '/' })
    const resultados = await Promise.allSettled(
      subs.map(sub => {
        const s: any = sub.subscription
        return webpush.sendNotification(
          { endpoint: s?.endpoint, keys: { p256dh: s?.keys?.p256dh, auth: s?.keys?.auth } },
          payload
        ).catch(async err => {
          // Remove subscriptions inválidas/expiradas
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
          throw err
        })
      })
    )

    const enviados = resultados.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, enviados, total: subs.length })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}