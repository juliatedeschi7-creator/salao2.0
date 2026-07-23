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
  const [precoEditavel, setPrecoEditavel] = useState('')
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
    setPrecoEditavel('')
    setObservacoes('')
    setErro('')
    setModalNovo(true)
  }

  function handleServicoChange(idServico: string) {
    setServicoId(idServico)
    const serv = servicos.find(s => s.id === idServico)
    if (serv) {
      setPrecoEditavel(serv.preco ? serv.preco.toString() : '')
    } else {
      setPrecoEditavel('')
    }
  }

  async function criarAgendamento() {
    if (!clienteId || !servicoId || !profissionalId || !horario) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }

    setSalvando(true)
    setErro('')

    const dadosInsercao: any = {
      salao_id: profile!.salao_id,
      cliente_id: clienteId,
      servico_id: servicoId,
      profissional_id: profissionalId,
      data: dataSelecionada,
      horario,
      status: 'pendente',
      observacoes
    }

    if (precoEditavel !== '') {
      dadosInsercao.preco_personalizado = Number(precoEditavel)
    }

    const { error } = await supabase.from('agendamentos').insert(dadosInsercao)

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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/salao')} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">Agenda</h1>
            <p className="text-[11px] text-gray-400">Gerencie os horários e compromissos do salão.</p>
          </div>
        </div>
        <button 
          onClick={abrirModalNovo}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold shadow-xs transition active:scale-95"
          style={{ backgroundColor: cor }}
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-4">
        {/* FILTROS */}
        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Data</label>
            <input 
              type="date" 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20" 
              value={dataSelecionada} 
              onChange={e => setDataSelecionada(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Profissional</label>
            <select 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20" 
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
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-xs">
              <CalendarIcon size={36} className="mx-auto text-gray-300 mb-2 stroke-[1.5]" />
              <p className="font-semibold text-gray-700 text-xs">Nenhum agendamento encontrado para este salão.</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Toque em "Novo" para adicionar um horário.</p>
            </div>
          ) : (
            agendamentos.map(ag => {
              const statusBadge = 
                ag.status === 'concluido' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                ag.status === 'cancelado' ? 'bg-rose-50 text-rose-700 border-rose-100' : 
                'bg-amber-50 text-amber-700 border-amber-100'

              const precoFinal = ag.preco_personalizado !== null && ag.preco_personalizado !== undefined 
                ? Number(ag.preco_personalizado) 
                : Number(ag.servicos?.preco || 0)

              return (
                <div key={ag.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-xs bg-gray-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Clock size={13} className="text-gray-500" /> {ag.horario?.slice(0, 5)}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                        {ag.status}
                      </span>
                    </div>
                    <button 
                      onClick={() => excluirAgendamento(ag.id)}
                      className="text-gray-400 hover:text-rose-600 p-1 transition"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <User size={14} className="text-gray-400" /> {ag.clientes?.nome || 'Cliente'}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Scissors size={13} className="text-gray-400" /> {ag.servicos?.nome || 'Serviço'} • <span className="font-bold text-gray-800">R$ {precoFinal.toFixed(2)}</span>
                      {ag.preco_personalizado !== null && ag.preco_personalizado !== undefined && (
                        <span className="text-[10px] text-pink-600 bg-pink-50 px-1.5 py-0.2 rounded font-medium">personalizado</span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Profissional: <span className="font-medium text-gray-700">{ag.profiles?.nome || 'Não atribuído'}</span>
                    </p>
                    {ag.observacoes && (
                      <p className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded-xl mt-1">
                        Obs: {ag.observacoes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button 
                      onClick={() => atualizarStatus(ag.id, 'concluido')}
                      className="flex-1 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition flex items-center justify-center gap-1"
                    >
                      <Check size={13} /> Concluir
                    </button>
                    <button 
                      onClick={() => atualizarStatus(ag.id, 'cancelado')}
                      className="flex-1 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition flex items-center justify-center gap-1"
                    >
                      <X size={13} /> Cancelar
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
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h3 className="font-bold text-gray-900 text-sm">Novo Agendamento</h3>
              <button onClick={() => setModalNovo(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 mb-1 block">Cliente</label>
              <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Selecione a cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 mb-1 block">Serviço</label>
              <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20" value={servicoId} onChange={e => handleServicoChange(e.target.value)}>
                <option value="">Selecione o serviço...</option>
                {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} - R$ {Number(s.preco).toFixed(2)}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 mb-1 block">Preço do Atendimento (R$)</label>
              <input 
                type="number" 
                step="0.01" 
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20" 
                value={precoEditavel} 
                onChange={e => setPrecoEditavel(e.target.value)} 
                placeholder="Ex: 50.00" 
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 mb-1 block">Profissional Responsável</label>
              <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20" value={profissionalId} onChange={e => setProfissionalId(e.target.value)}>
                <option value="">Selecione o profissional...</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-gray-700 mb-1 block">Data</label>
                <input type="date" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20" value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-700 mb-1 block">Horário</label>
                <input type="time" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20" value={horario} onChange={e => setHorario(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 mb-1 block">Observações (opcional)</label>
              <textarea className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 resize-none" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex: Cliente prefere atendimento com secador morno..." />
            </div>

            {erro && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                <p className="text-rose-600 text-xs font-bold">{erro}</p>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button onClick={() => setModalNovo(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold transition hover:bg-gray-50">Cancelar</button>
              <button onClick={criarAgendamento} disabled={salvando} className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm transition active:scale-95" style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
