import { supabase } from './supabase'

interface NotificarParams {
  salaoId?: string | null
  remetenteId?: string | null
  destinatarioId: string | null | undefined
  titulo: string
  mensagem: string
  tipo: string
  url?: string
}

export async function notificar({
  salaoId,
  remetenteId,
  destinatarioId,
  titulo,
  mensagem,
  tipo,
  url,
}: NotificarParams): Promise<void> {
  console.log('[notificar] INÍCIO', {
    salaoId,
    remetenteId,
    destinatarioId,
    titulo,
    tipo,
    url,
  })

  // Cliente sem conta no aplicativo não possui destinatário para receber
  // notificação. Isso é uma situação normal e não deve interromper o fluxo.
  if (!destinatarioId) {
    console.log(
      '[notificar] SEM DESTINATÁRIO — cliente sem conta vinculada. Notificação ignorada.',
      {
        salaoId,
        remetenteId,
        titulo,
        tipo,
      }
    )
    return
  }

  // Salão ou remetente ausentes continuam sendo tratados como erro real,
  // pois indicam problema nos dados de quem está disparando a notificação.
  if (!salaoId || !remetenteId) {
    console.log('[notificar] DADOS INSUFICIENTES', {
      salaoId,
      remetenteId,
      destinatarioId,
    })

    if (typeof window !== 'undefined') {
      window.alert(
        `Erro ao criar notificação.

Dados insuficientes:
` +
        `salaoId: ${salaoId || 'ausente'}
` +
        `remetenteId: ${remetenteId || 'ausente'}
` +
        `destinatarioId: ${destinatarioId || 'ausente'}`
      )
    }

    return
  }

  try {
    console.log('[notificar] tentando salvar no sininho...')

    const { error: insertError } = await supabase
      .from('notificacoes')
      .insert({
        salao_id: salaoId,
        remetente_id: remetenteId,
        destinatario_id: destinatarioId,
        titulo,
        mensagem,
        tipo,
        lida: false,
      })

    if (insertError) {
      console.error('[notificar] ERRO AO SALVAR NO SININHO', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      })

      if (typeof window !== 'undefined') {
        window.alert(
          `ERRO AO SALVAR A NOTIFICAÇÃO

` +
          `Mensagem: ${insertError.message || 'não informado'}

` +
          `Código: ${insertError.code || 'não informado'}

` +
          `Detalhes: ${insertError.details || 'não informado'}

` +
          `Hint: ${insertError.hint || 'não informado'}`
        )
      }
    } else {
      console.log('[notificar] SINO SALVO COM SUCESSO')
    }

    console.log('[notificar] chamando API de Push...')

    try {
      const resposta = await fetch('/api/notificar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salaoId,
          remetenteId,
          destinatarioId,
          titulo,
          mensagem,
          tipo,
          url: url || '/',
        }),
      })

      let resultado: any = null

      try {
        resultado = await resposta.json()
      } catch {
        resultado = null
      }

      if (!resposta.ok) {
        console.error('[notificar] ERRO HTTP NO PUSH', {
          status: resposta.status,
          resultado,
        })
      } else {
        console.log('[notificar] PUSH PROCESSADO', resultado)
      }
    } catch (pushError) {
      console.error(
        '[notificar] ERRO AO CHAMAR API DE PUSH',
        pushError
      )
    }
  } catch (error: any) {
    console.error('[notificar] ERRO GERAL', error)

    if (typeof window !== 'undefined') {
      window.alert(
        `ERRO GERAL AO CRIAR NOTIFICAÇÃO

` +
        `${error?.message || 'Erro desconhecido'}`
      )
    }
  }

  console.log('[notificar] FIM')
}
