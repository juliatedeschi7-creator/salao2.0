'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Check, X, Trash2 } from 'lucide-react'

export default function NotificacoesSalao() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [aba, setAba] = useState<'pedidos' | 'confirmacoes' | 'avisos'>('pedidos')
  
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [confirmacoes, setConfirmacoes] = useState<any[]>([])
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  
  const [modalConfirmar, setModalConfirmar] = useState<any>(null)
  const [servicoRealizado, setServicoRealizado] = useState('')
  const [salvando, setSalvando] = useState(false)

  const p = profile as any
  const isDono = p?.tipo === 'dono' || p?.nivel === 'admin' || p?.cargo === 'dono' || !p?.tipo

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    
    if (!isDono && !p?.permite_notificacoes && !p?.permite_gerenciar_agenda) {
      router.push('/funcionario/dashboard')
      return
    }

    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: sols } = await supabase.from('solicitacoes_agendamento')
      .select('*, clientes(nome, email), servicos(nome)')
      .eq('salao_id', profile!.salao_id!)
      .in('status', ['pendente', 'horario_sugerido'])
      .order('created_at', { ascending: false })
    setSolicitacoes(sols || [])

    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1)
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(nome), servicos(nome), confirmacoes_atendimento(*)')
      .eq('salao_id', profile!.salao_id!)
      .eq('status', 'confirmado')
      .gte('data_hora', ontem.toISOString())
      .lte('data_hora', new Date().toISOString())
      .order('data_hora')
    setConfirmacoes((ags || []).filter((a: any) => !a.confirmacoes_atendimento?.length))

    const { data: notifs } = await supabase.from('avisos_salao')
      .select('*')
      .eq('salao_id', profile!.salao_id!)
      .order('created_at', { ascending: false })
    setNotificacoes(notifs || [])
  }

  async function confirmarAtendimento() {
    if (!servicoRealizado || !modalConfirmar) return
    setSalvando(true)

    await supabase.from('confirmacoes_atendimento').insert({
      agendamento_id: modalConfirmar.id,
      salao_id: profile!.salao_id,
      confirmado_por: profile!.id,
      servico_realizado: servicoRealizado
    })

    await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', modalConfirmar.id)
    
    setModalConfirmar(null)
    setServicoRealizado('')
    setSalvando(false)
    carregarDados()
  }

  async function recusarSolicitacao(s: any) {
    await supabase.from('solicitacoes_agendamento').update({ status: 'recusado' }).eq('id', s.id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Avisos e Notificações</h1>
      </div>

      <div className="flex bg-white border-b border-gray-100">
        {[
          { key: 'pedidos', label: `Pedidos (${solicitacoes.length})` },
          { key: 'confirmacoes', label: `Confirmar (${confirmacoes.length})` },
          { key: 'avisos', label: `Mural (${notificacoes.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setAba(t.key as any)}
            className={'flex-1 py-3 text-xs font-medium transition-all ' + (aba === t.key ? 'border-b-2' : 'text-gray-400')}
            style={aba === t.key ? { color: cor, borderColor: cor } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3 max-w-2xl mx-auto">
        {aba === 'pedidos' && (
          solicitacoes.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">Nenhum pedido pendente.</p> :
          solicitacoes.map(s => (
            <div key={s.id} className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
              <p className="font-bold text-gray-900 text-sm">{s.clientes?.nome} <span className="text-xs text-gray-400 font-normal">({s.servicos?.nome})</span></p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => recusarSolicitacao(s)} className="flex-1 py-2 rounded-xl bg-red-50 text-red-500 text-xs font-semibold">Recusar</button>
              </div>
            </div>
          ))
        )}

        {aba === 'confirmacoes' && (
          confirmacoes.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">Nenhum atendimento para confirmar.</p> :
          confirmacoes.map(ag => (
            <div key={ag.id} className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
              <p className="font-bold text-gray-900 text-sm">{ag.clientes?.nome} — {ag.servicos?.nome}</p>
              <button onClick={() => { setModalConfirmar(ag); setServicoRealizado(ag.servicos?.nome || ''); }} className="w-full py-2.5 rounded-xl text-white text-xs font-semibold mt-1" style={{ backgroundColor: cor }}>
                Confirmar Atendimento
              </button>
            </div>
          ))
        )}

        {aba === 'avisos' && (
          notificacoes.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">Nenhum aviso no mural.</p> :
          notificacoes.map(n => (
            <div key={n.id} className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-1">
              <h3 className="font-bold text-gray-900 text-sm">{n.titulo}</h3>
              <p className="text-xs text-gray-600">{n.mensagem}</p>
            </div>
          ))
        )}
      </div>

      {modalConfirmar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base">Confirmar Atendimento</h3>
              <button onClick={() => setModalConfirmar(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">O que foi realizado?</label>
              <input type="text" className="input-field text-sm" value={servicoRealizado} onChange={e => setServicoRealizado(e.target.value)} />
            </div>
            <button onClick={confirmarAtendimento} disabled={salvando} className="w-full py-3 rounded-2xl text-white text-sm font-semibold" style={{ backgroundColor: cor }}>
              {salvando ? 'Salvando...' : 'Concluir Confirmação'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
