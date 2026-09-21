import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const inicio = new Date()

  console.log('================================================')
  console.log('[lembretes-automatico] PROCESSO INICIADO')
  console.log('[lembretes-automatico] horário:', inicio.toISOString())
  console.log('================================================')

  try {
    /*
     * ============================================================
     * 1. VERIFICA O CRON_SECRET
     * ============================================================
     *
     * A Vercel envia:
     *
     * Authorization: Bearer <CRON_SECRET>
     *
     * para o Cron.
     */

    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error(
        '[lembretes-automatico] CRON_SECRET não configurado.'
      )

      return NextResponse.json(
        {
          ok: false,
          erro: 'CRON_SECRET não configurado no ambiente.',
        },
        { status: 500 }
      )
    }

    const authorization =
      req.headers.get('authorization') || ''

    const esperado = `Bearer ${cronSecret}`

    if (authorization !== esperado) {
      console.warn(
        '[lembretes-automatico] acesso não autorizado.'
      )

      return NextResponse.json(
        {
          ok: false,
          erro: 'Não autorizado.',
        },
        { status: 401 }
      )
    }

    /*
     * ============================================================
     * 2. DESCOBRE A URL DA PRÓPRIA APLICAÇÃO
     * ============================================================
     */

    const origem = new URL(req.url).origin

    console.log(
      '[lembretes-automatico] origem:',
      origem
    )

    /*
     * ============================================================
     * 3. SINCRONIZA OS LEMBRETES
     * ============================================================
     *
     * Isso cria na fila os lembretes que ainda não existem.
     */

    console.log(
      '[lembretes-automatico] iniciando sincronização...'
    )

    const respostaSincronizacao = await fetch(
      `${origem}/api/lembretes-agendamento/sincronizar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        cache: 'no-store',
      }
    )

    let resultadoSincronizacao: any = null

    try {
      resultadoSincronizacao =
        await respostaSincronizacao.json()
    } catch {
      resultadoSincronizacao = null
    }

    console.log(
      '[lembretes-automatico] resultado da sincronização:',
      {
        status: respostaSincronizacao.status,
        resultado: resultadoSincronizacao,
      }
    )

    if (!respostaSincronizacao.ok) {
      throw new Error(
        resultadoSincronizacao?.erro ||
          `Erro na sincronização. HTTP ${respostaSincronizacao.status}.`
      )
    }

    /*
     * ============================================================
     * 4. PROCESSA OS LEMBRETES QUE JÁ ESTÃO NO HORÁRIO
     * ============================================================
     */

    console.log(
      '[lembretes-automatico] iniciando processamento...'
    )

    const respostaProcessamento = await fetch(
      `${origem}/api/lembretes-agendamento/processar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        cache: 'no-store',
      }
    )

    let resultadoProcessamento: any = null

    try {
      resultadoProcessamento =
        await respostaProcessamento.json()
    } catch {
      resultadoProcessamento = null
    }

    console.log(
      '[lembretes-automatico] resultado do processamento:',
      {
        status: respostaProcessamento.status,
        resultado: resultadoProcessamento,
      }
    )

    if (!respostaProcessamento.ok) {
      throw new Error(
        resultadoProcessamento?.erro ||
          `Erro no processamento. HTTP ${respostaProcessamento.status}.`
      )
    }

    /*
     * ============================================================
     * 5. RESULTADO FINAL
     * ============================================================
     */

    const fim = new Date()

    console.log('================================================')
    console.log(
      '[lembretes-automatico] PROCESSO FINALIZADO'
    )
    console.log(
      '[lembretes-automatico] duração:',
      fim.getTime() - inicio.getTime(),
      'ms'
    )
    console.log('================================================')

    return NextResponse.json({
      ok: true,

      sincronizacao: {
        httpStatus: respostaSincronizacao.status,
        resultado: resultadoSincronizacao,
      },

      processamento: {
        httpStatus: respostaProcessamento.status,
        resultado: resultadoProcessamento,
      },

      executado_em: inicio.toISOString(),
      finalizado_em: fim.toISOString(),
    })
  } catch (error: any) {
    console.error(
      '[lembretes-automatico] ERRO:',
      error
    )

    return NextResponse.json(
      {
        ok: false,
        erro:
          error?.message ||
          'Erro interno no processo automático de lembretes.',
      },
      { status: 500 }
    )
  }
}