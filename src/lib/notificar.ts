import { supabase } from './supabase'

interface NotificarParams {
  salaoId?: string | null
  remetenteId: string | null | undefined
  destinatarioId: string | null | undefined
  titulo: string
  mensagem: string
  tipo: string
  url?: string
}

export async function notificar({
  salaoId, remetenteId, destinatarioId, titulo, mensagem, tipo, url,
}: NotificarParams): Promise<void> {
  if (!destinatarioId || !salaoId || !remetenteId) return
  try {
    await supabase.from('notificacoes').insert({
      salao_id: salaoId,
      remetente_id: remetenteId,
      destinatario_id: destinatarioId,
      titulo,
      mensagem,
      tipo,
      lida: false,
      url: url || null,
    })
  } catch {
    // silencioso
  }
}
