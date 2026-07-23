'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Calendar as CalendarIcon, Plus, Clock, User, Scissors, Trash2, Check, X, ArrowLeft } from 'lucide-react'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function AgendaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [dataSelecionada, setDataSelecionada] = useState(hojeISO())
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [profissionalFiltro, setProfissionalFiltro] = useState('todos')
  
  const [modalNovo, setModalNovo] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [horario, setHorario] = useState('09:00')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (loading) return
    if (!profile) {
      router.push('/login')
      return
    }
    if (profile.salao_id) {
      carregarDadosSalao()
    }
  }, [loading, profile])

  useEffect(() => {
    if (profile?.salao_id) {
      carregarAgenda()
    }
  }, [dataSelecionada, profissionalFiltro, profile])

  async function carregarDadosSalao() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: profs } = await supabase.from('profiles').select('*').eq('salao_id', profile!.salao_id!)
    setProfissionais(profs || [])

    const { data: serv } = await supabase.from('servicos').select('*').eq('salao_id', profile!.salao_id!)
    setServicos(serv || [])

    const { data: clis } = await supabase.from('clientes').select('*').eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(clis || [])
  }

  async function carregarAgenda() {
    let query = supabase
      .from('agendamentos')
      .select('*, clientes(nome, telefone), servicos(nome, preco, duracao_minutos), profiles(nome)')
      .eq('salao_id', profile!.salao_id!)
      .eq('data', dataSelecionada)
      .order('horario')

    if (profissionalFiltro !== 'todos') {
      query = query.eq('profissional_id', profissionalFiltro)
    }

    const { data, error } = await query
    if (error) {
      console.error('Erro ao carregar agenda:', error)
    } else {
      setAgendamentos(data || [])
    }
  }

  function abrirModalNovo() {
    setClienteId('')
    setServicoId('')
    setProfissionalId(profile?.id || '')
    setHorario('09:00')
    setObservacoes('')
    setErro('')
    setModalNovo(true)
  }

  async function criarAgendamento() {
    if (!clienteId || !servicoId || !profissionalId || !horario) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }

    setSalvando(true)
    setErro('')

    const { error } = await supabase.from('agendamentos').insert({
      salao_id: profile!.salao_id,
      cliente_id: clienteId,
      servico_id: servicoId,
      profissional_id: profissionalId,
      data: dataSelecionada,
      horario,
      status: 'pendente',
      observacoes
    })

    if (error) {
      setErro('Erro ao criar agendamento: ' + error.message)
      setSalvando(false)
      return
    }

    setModalNovo(false)
    setSalvando(false)
    carregarAgenda()
  }

  async function atualizarStatus(id: string, novoStatus: string) {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: novoStatus })
      .eq('id', id)

    if (error) {
      alert('Erro ao atualizar status: ' + error.message)
    } else {
      carregarAgenda()
    }
  }

  async function excluirAgendamento(id: string) {
    if (!confirm('Deseja realmente excluir este agendamento?')) return

    const { error } = await supabase
      .from('agendamentos')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
    } else {
      carregarAgenda()
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* HEADER */}
      <div className="bg-white px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/salao')}><ArrowLeft size={22} className="text-gray-700" /></button>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Agenda de Horários</h1>
            <p className="text-xs text-gray-400">Acompanhe e organize os atendimentos</p>
          </div>
        </div>
        <button onClick={abrirModalNovo}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-xs font-bold shadow-md transition-all active:scale-95"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Novo Agendamento
        </button>
      </div>

      <div className="px-6 py-6 max-w-5xl mx-auto flex flex-col gap-6">
        {/* BARRA DE FILTROS */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="w-full sm:w-auto flex-1">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Selecionar Data</label>
            <input 
              type="date" 
              className="input-field bg-gray-50/50" 
              value={dataSelecionada} 
              onChange={e => setDataSelecionada(e.target.value)} 
            />
          </div>
          <div className="w-full sm:w-auto flex-1">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Filtrar por Profissional</label>
            <select 
              className="input-field bg-gray-50/50" 
              value={profissionalFiltro} 
              onChange={e => setProfissionalFiltro(e.target.value)}
            >
              <option value="todos">Todos os profissionais</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* LISTA DE COMPROMISSOS */}
        <div className="flex flex-col gap-3">
          {agendamentos.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-xs">
              <CalendarIcon size={48} className="mx-auto text-gray-300 mb-3 stroke-[1.5]" />
              <p className="font-bold text-gray-800 text-sm">Nenhum agendamento para esta data</p>
              <p className="text-xs text-gray-400 mt-1">Os horários marcados aparecerão listados aqui.</p>
            </div>
          ) : (
            agendamentos.map(ag => {
              const statusBadge = 
                ag.status === 'concluido' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                ag.status === 'cancelado' ? 'bg-rose-50 text-rose-700 border-rose-100' : 
                'bg-amber-50 text-amber-700 border-amber-100'

              return (
                <div key={ag.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center shrink-0">
                      <Clock size={16} className="text-gray-400 mb-0.5" />
                      <span className="font-black text-gray-900 text-xs">{ag.horario?.slice(0, 5)}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 text-base">{ag.clientes?.nome || 'Cliente'}</h3>
                        <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${statusBadge}`}>
                          {ag.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 font-medium">
                        <Scissors size={14} className="text-gray-400" /> {ag.servicos?.nome || 'Serviço'} • <span className="text-gray-900 font-bold">R$ {Number(ag.servicos?.preco || 0).toFixed(2)}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        Profissional: <span className="font-semibold text-gray-700">{ag.profiles?.nome || 'Não atribuído'}</span>
                      </p>
                      {ag.observacoes && (
                        <p className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl mt-1">
                          Obs: {ag.observacoes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 justify-end">
                    <button 
                      onClick={() => atualizarStatus(ag.id, 'concluido')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1"
                    >
                      <Check size={14} /> Concluir
                    </button>
                    <button 
                      onClick={() => atualizarStatus(ag.id, 'cancelado')}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-all flex items-center gap-1"
                    >
                      <X size={14} /> Cancelar
                    </button>
                    <button 
                      onClick={() => excluirAgendamento(ag.id)}
                      className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* MODAL DE NOVO AGENDAMENTO */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Novo Agendamento</h3>
              <button onClick={() => setModalNovo(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">Cliente</label>
              <select className="input-field bg-white" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Selecione a cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">Serviço</label>
              <select className="input-field bg-white" value={servicoId} onChange={e => setServicoId(e.target.value)}>
                <option value="">Selecione o serviço...</option>
                {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} - R$ {Number(s.preco).toFixed(2)}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">Profissional Responsável</label>
              <select className="input-field bg-white" value={profissionalId} onChange={e => setProfissionalId(e.target.value)}>
                <option value="">Selecione o profissional...</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">Data</label>
                <input type="date" className="input-field bg-white" value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">Horário</label>
                <input type="time" className="input-field bg-white" value={horario} onChange={e => setHorario(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">Observações (opcional)</label>
              <textarea className="input-field bg-white resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex: Cliente prefere atendimento com secador morno..." />
            </div>

            {erro && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <p className="text-rose-600 text-xs font-bold">{erro}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalNovo(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-xs font-bold">Cancelar</button>
              <button onClick={criarAgendamento} disabled={salvando} className="flex-1 py-3 rounded-2xl text-white text-xs font-bold shadow-md" style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar Agendamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
