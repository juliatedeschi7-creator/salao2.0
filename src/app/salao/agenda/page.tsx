'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Calendar as CalendarIcon, Clock, Scissors, User, Check, X, Trash2 } from 'lucide-react'

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
  
  // Modais
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
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/salao')}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg">Agenda</h1>
        </div>
        <button onClick={abrirModalNovo}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Novo Agendamento
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 max-w-4xl mx-auto">
        {/* FILTROS DE DATA E PROFISSIONAL */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Data</label>
            <input 
              type="date" 
              className="input-field bg-white" 
              value={dataSelecionada} 
              onChange={e => setDataSelecionada(e.target.value)} 
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Profissional</label>
            <select 
              className="input-field bg-white" 
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

        {/* LISTA DE AGENDAMENTOS */}
        <div className="flex flex-col gap-3">
          {agendamentos.length === 0 ? (
            <div className="card text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-xs">
              <CalendarIcon size={40} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 font-medium">Nenhum agendamento para esta data</p>
              <p className="text-xs text-gray-400 mt-1">Clique em "Novo Agendamento" para adicionar um horário.</p>
            </div>
          ) : (
            agendamentos.map(ag => {
              const statusCor = 
                ag.status === 'concluido' ? 'bg-green-50 text-green-700 border-green-100' :
                ag.status === 'cancelado' ? 'bg-red-50 text-red-700 border-red-100' : 
                'bg-yellow-50 text-yellow-700 border-yellow-100'

              return (
                <div key={ag.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-900 text-sm bg-gray-100 px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <Clock size={14} className="text-gray-500" /> {ag.horario?.slice(0, 5)}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusCor}`}>
                        {ag.status}
                      </span>
                    </div>
                    <button onClick={() => excluirAgendamento(ag.id)} className="text-gray-400 hover:text-red-500 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <User size={16} className="text-gray-400" /> {ag.clientes?.nome || 'Cliente'}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Scissors size={14} className="text-gray-400" /> {ag.servicos?.nome || 'Serviço'} • R$ {Number(ag.servicos?.preco || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Profissional: <span className="font-medium text-gray-700">{ag.profiles?.nome || 'Não atribuído'}</span>
                    </p>
                    {ag.observacoes && (
                      <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-xl mt-1">
                        Obs: {ag.observacoes}
                      </p>
                    )}
                  </div>

                  {/* BOTÕES DE AÇÃO RÁPIDA DE STATUS */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button 
                      onClick={() => atualizarStatus(ag.id, 'concluido')}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-all"
                    >
                      <Check size={14} /> Concluir
                    </button>
                    <button 
                      onClick={() => atualizarStatus(ag.id, 'cancelado')}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-all"
                    >
                      <X size={14} /> Cancelar
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* MODAL NOVO AGENDAMENTO */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Novo Agendamento</h3>
              <button onClick={() => setModalNovo(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Cliente</label>
              <select className="input-field bg-white" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Selecione a cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Serviço</label>
              <select className="input-field bg-white" value={servicoId} onChange={e => setServicoId(e.target.value)}>
                <option value="">Selecione o serviço...</option>
                {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} - R$ {Number(s.preco).toFixed(2)}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Profissional Responsável</label>
              <select className="input-field bg-white" value={profissionalId} onChange={e => setProfissionalId(e.target.value)}>
                <option value="">Selecione o profissional...</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Data</label>
                <input type="date" className="input-field bg-white" value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Horário</label>
                <input type="time" className="input-field bg-white" value={horario} onChange={e => setHorario(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Observações (opcional)</label>
              <textarea className="input-field bg-white resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex: Cliente pediu preferência por secador morno..." />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-xs font-medium">{erro}</p>
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
