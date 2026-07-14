import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId, salaoId } = await req.json()
    if (!subscription || !userId) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Verifica se já existe pelo profile_id
    const { data: existente } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle()

    if (existente) {
      await supabase.from('push_subscriptions').update({
        subscription,
        user_id: userId,
        salao_id: salaoId || null,
        updated_at: new Date().toISOString()
      }).eq('profile_id', userId)
    } else {
      await supabase.from('push_subscriptions').insert({
        profile_id: userId,
        user_id: userId,
        salao_id: salaoId || null,
        subscription,
        updated_at: new Date().toISOString()
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Push subscribe error:', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json()
    await supabase.from('push_subscriptions').delete().eq('profile_id', userId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
