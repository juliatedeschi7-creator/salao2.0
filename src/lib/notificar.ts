type NotificarParams = {
  salaoId?: string | null
  remetenteId?: string | null
  destinatarioId: string
  titulo: string
  mensagem: string
  tipo?: string
  url?: string
}

// Chama a rota central: grava a notificação no sininho E dispara o push de verdade.
// Use esta função em vez de "supabase.from('notificacoes').insert(...)" direto.
export async function notificar(params: NotificarParams) {
  try {
    const res = await fetch('/api/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    return await res.json()
  } catch (err) {
    console.error('Erro ao notificar:', err)
    return { ok: false }
  }
}