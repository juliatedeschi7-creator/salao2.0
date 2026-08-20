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
  if (!destinatarioId || !salaoId || !remetenteId) {
    console.log('[notificar] dados insuficientes', {
      salaoId,
      remetenteId,
      destinatarioId,
    })
    return
  }

  try {
    // ============================================================
    // 1. SALVA A NOTIFICAÇÃO NO SININHO
    // ============================================================

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
        url: url || null,
      })

    if (insertError) {
      console.error(
        '[notificar] erro ao salvar no sininho:',
        insertError
      )
    } else {
      console.log(
        '[notificar] notificação salva no sininho com sucesso'
      )
    }

    // ============================================================
    // 2. ENVIA O PUSH
    // ============================================================

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
        console.error(
          '[notificar] erro HTTP ao enviar Push:',
          resposta.status,
          resultado
        )
      } else {
        console.log(
          '[notificar] resultado do Push:',
          resultado
        )
      }
    } catch (pushError) {
      console.error(
        '[notificar] erro ao chamar API de Push:',
        pushError
      )
    }
  } catch (error) {
    console.error(
      '[notificar] erro geral:',
      error
    )
  }
}