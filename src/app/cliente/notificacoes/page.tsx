'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Calendar, CheckCircle } from 'lucide-react'

export default function ClienteNotificacoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [confirmando, setConfirmando] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setCliente(cli); setSalao(cli?.saloes)

    const { data: notifs } = await supabase.from('notificacoes').select('*')
      .eq('destinatario_id', profile!.id).order('created_at', { ascending: false })
    setNotificacoes(notifs || [])

    const { data: sols } = await supabase.from('solicitacoes_agendamento')
      .select('*, servicos(nome, duracao_minutos)')
      .eq('cliente_id', cli?.id)
      .eq('status', 'horario_sugerido')
    setSolicitacoes(sols || [])

    await supabase.from('notificacoes').update({ lida: true }).eq('destinatario_id', profile!.id).eq('lida', false)
  }

  async function confirmarHorario(solicitacao: any, horario: string) {
    setConfirmando(solicitacao.id)

    await supabase.from('agendamentos').insert({
      salao_id: solicitacao.salao_id,
      cliente_id: solicitacao.cliente_id,
      servico_id: solicitacao.servico_id,
      profissional_id: solicitacao.profissional_id,
      data_hora: horario,
      duracao_minutos: solicitacao.servicos?.duracao_minutos || 60,
      status: 'confirmado'
    })

    await supabase.from('solicitacoes_agendamento').update({
      status: 'confirmado',
      horario_escolhido: horario
    }).eq('id', solicitacao.id)

    const { data: sal } = await supabase.from('saloes').select('dono_id').eq('id', solicitacao.salao_id).single()
    if (sal?.dono_id) {
      await supabase.from('notificacoes').insert({
        salao_id: solicitacao.salao_id,
        remetente_id: profile!.id,
        destinatario_id: sal.dono_id,
        titulo: 'Horario confirmado',
        mensagem: cliente?.nome + ' confirmou o horario para ' + solicitacao.servicos?.nome,
        tipo: 'agendamento'
      })
    }

    setConfirmando(null)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Notificacoes</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {solicitacoes.map(sol => (
          <div key={sol.id} className="card flex flex-col gap-3 border-2" style={{ borderColor: cor }}>
            <div className="flex items-center gap-2">
              <Calendar size={18} style={{ color: cor }} />
              <p className="font-bold text-gray-900">Escolha seu horario</p>
            </div>
            <p className="text-sm text-gray-500">{sol.servicos?.nome}</p>
            <div className="flex flex-col gap-2">
              {(sol.horarios_sugeridos || []).map((h: string, i: number) => (
                <button key={i} onClick={() => confirmarHorario(sol, h)}
                  disabled={confirmando === sol.id}
                  className="w-full py-3 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ borderColor: cor, color: cor }}>
                  <CheckCircle size={16} />
                  {new Date(h).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} as {new Date(h).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          </div>
        ))}

        {notificacoes.length === 0 && solicitacoes.length === 0 ? (
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
