'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export interface Notificacao {
  id: string
  titulo: string
  mensagem: string
  tipo: string
  lida: boolean
  created_at: string
  remetente_id: string
}

export function useNotificacoes(profileId?: string) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [naoLidas, setNaoLidas] = useState(0)

  useEffect(() => {
    if (!profileId) return
    buscarNotificacoes()

    const canal = supabase
      .channel('notificacoes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificacoes',
        filter: `destinatario_id=eq.${profileId}`
      }, (payload) => {
        setNotificacoes(prev => [payload.new as Notificacao, ...prev])
        setNaoLidas(prev => prev + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [profileId])

  async function buscarNotificacoes() {
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('destinatario_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50)

    setNotificacoes(data || [])
    setNaoLidas(data?.filter(n => !n.lida).length || 0)
  }

  async function marcarComoLida(id: string) {
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', id)

    setNotificacoes(prev =>
      prev.map(n => n.id === id ? { ...n, lida: true } : n)
    )
    setNaoLidas(prev => Math.max(0, prev - 1))
  }

  async function marcarTodasComoLidas() {
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('destinatario_id', profileId)
      .eq('lida', false)

    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
    setNaoLidas(0)
  }

  return { notificacoes, naoLidas, marcarComoLida, marcarTodasComoLidas }
}
