'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell } from 'lucide-react'

export default function ClienteNotificacoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [notificacoes, setNotificacoes] = useState<any[]>([])

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setSalao(cli?.saloes)
    const { data: notifs } = await supabase.from('notificacoes').select('*')
      .eq('destinatario_id', profile!.id).order('created_at', { ascending: false })
    setNotificacoes(notifs || [])
    await supabase.from('notificacoes').update({ lida: true }).eq('destinatario_id', profile!.id).eq('lida', false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Notificacoes</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {notificacoes.length === 0 ? (
          <div className="card text-center py-10">
            <Bell size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhuma notificacao</p>
          </div>
        ) : notificacoes.map(n => (
          <div key={n.id} className={'card flex flex-col gap-1 ' + (!n.lida ? 'border-l-4' : '')}
            style={!n.lida ? { borderColor: cor } : {}}>
            <div className="flex justify-between items-start">
              <p className="font-semibold text-gray-900 text-sm">{n.titulo}</p>
              <p className="text-xs text-gray-400 ml-2">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <p className="text-sm text-gray-500">{n.mensagem}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
