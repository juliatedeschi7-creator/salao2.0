import { NextRequest, NextResponse } from 'next/server'
const PROFILE_ID_TAISA =
  '06691268-33f6-4a25-9e5e-5e01af3bf15c'
export async function GET() {
  try {
    console.log('[teste-push] iniciando teste para Taisa')
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://organiza-salao.xyz'
    const resposta = await fetch(
      `${baseUrl}/api/notificar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinatarioId: PROFILE_ID_TAISA,
          titulo: '🔔 Teste de Push',
          mensagem:
            'Olá, Taisa! Este é um teste do sistema de notificações do Organiza Salão.',
          tipo: 'teste_push',
          url: '/cliente',
        }),
      }
    )
    const resultado = await resposta.json()
    console.log(
      '[teste-push] resposta da API /api/notificar:',
      resultado
    )
    return NextResponse.json({
      ok: resposta.ok,
      teste: true,
      destinatarioId: PROFILE_ID_TAISA,
      resposta: resultado,
    })
  } catch (error: any) {
    console.error(
      '[teste-push] erro:',
      error
    )
    return NextResponse.json(
      {
        ok: false,
        teste: true,
        erro:
          error?.message ||
          'Erro ao executar teste de Push.',
      },
      { status: 500 }
    )
  }
}