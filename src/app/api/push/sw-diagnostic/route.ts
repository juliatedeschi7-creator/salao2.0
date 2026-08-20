// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  console.log('')
  console.log('==========================================')
  console.log('[SW-DIAGNOSTIC] PUSH CHEGOU AO SERVICE WORKER')
  console.log('==========================================')

  try {
    const body = await req.json()

    console.log('[SW-DIAGNOSTIC] Dados recebidos:')
    console.log(JSON.stringify(body, null, 2))

    console.log('[SW-DIAGNOSTIC] Timestamp:', body?.timestamp)
    console.log('[SW-DIAGNOSTIC] Título:', body?.title)
    console.log('[SW-DIAGNOSTIC] Mensagem:', body?.body)
    console.log('[SW-DIAGNOSTIC] URL:', body?.url)

    console.log('==========================================')
    console.log('[SW-DIAGNOSTIC] SERVICE WORKER CONFIRMADO')
    console.log('==========================================')
    console.log('')

    return NextResponse.json({
      ok: true,
      recebido: true,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error(
      '[SW-DIAGNOSTIC] ERRO:',
      error?.message || error
    )

    return NextResponse.json(
      {
        ok: false,
        erro: error?.message || 'Erro desconhecido'
      },
      {
        status: 500
      }
    )
  }
}