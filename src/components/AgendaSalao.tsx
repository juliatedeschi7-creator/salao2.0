'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, User, Scissors, Trash2 } from 'lucide-react'

export default function AgendaSalao() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0])
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalAberto, setModalAberto] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [hora, setHora] = useState('09:00')
  const [salvando, setSalvando] = useState(false)

  const p = profile as any
  const isDono = p?.tipo === 'dono' || p?.nivel === 'admin' || p?.cargo === 'dono' || !p?.tipo

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }

    if (!isDono && !p?.permite_gerenciar_agenda) {
      router.push('/funcionario/dashboard')
      return
    }

    if (profile.salao_id) {
      carregarDadosIniciais()
    }
  }, [loading, profile, dataSelecionada])

  async function carregarDadosIniciais() {
    setCarregando(true)
    const salaoId = profile!.salao_id!

    const { data: sal } = await supabase.from('saloes').select('*').eq('id', salaoId).single()
    setSalao(sal)

    const { data: profs } = await supabase.from('profiles').select('*').eq('salao_id', salaoId)
    setProfissionais(profs || [])

    const { data: srvs } = await supabase.from('servicos').select('*').eq('id_salao', salaoId)
    setServicos(srvs || [])

    const { data: clts } = await supabase.from('clientes').select('*').eq('salao_id', salaoId)
    setClientes(clts || [])

    let query = supabase.from('agendamentos')
      .select('*, clientes(nome, telefone), servicos(nome, duracao_minutos), profiles(nome)')
      .eq('salao_id', salaoId)
      .gte('data_hora', `${dataSelecionada}T00:00:00`)
      .lte('data_hora', `${dataSelecionada}T23:59:59`)
      .order('data_hora', { ascending: true })

    if (!isDono && !p?.ver_agenda_geral) {
      query = query.eq('profissional_id', profile!.id)
    }

    const { data: ags } = await query
    setAgendamentos(ags || [])
    setCarregando(false)
  }

  async function criarAgendamento(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteId || !servicoId || !profissionalId) return

    setSalvando(true)
    const dataHora = `${dataSelecionada}T${hora}:00`

    const { error } = await supabase.from('agendamentos').insert({
      salao_id: profile!.salao_id,
      cliente_id: clienteId,
      servico_id: servicoId,
      profissional_id: profissionalId,
      data_hora: dataHora,
      status: 'confirmado'
    })

    if (!error) {
      setModalAberto(false)
      setClienteId('')
      setServicoId('')
      setProfissionalId('')
      carregarDadosIniciais()
    } else {
      alert('Erro ao criar agendamento: ' + error.message)
    }
    setSalvando(false)
  }

  async function excluirAgendamento(id: string) {
    if (!confirm('Deseja realmente cancelar/excluir este agendamento?')) return
    const { error } = await supabase.from('agendamentos').delete().eq('id', id)
    if (!error) carregarDadosIniciais()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg">Agenda do Salão</h1>
        </div>
        <button 
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Novo Horário
        </button>
      </div>

      <div className="bg-white px-4 py-3 border-t border-gray-100 flex items-center justify-between shadow-sm">
        <button onClick={() => {
          const d = new Date(dataSelecionada); d.setDate(d.getDate() - 1); setDataSelecionada(d.toISOString().split('T')[0]);
        }} className="p-2 rounded-xl bg-gray-50 text-gray-600"><ChevronLeft size={18} /></button>
        
        <div className="flex items-center gap-2">
          <CalendarIcon size={16} style={{ color: cor }} />
          <input type="date" value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} className="font-bold text-sm text-gray-800 bg-transparent outline-none cursor-pointer" />
        </div>

        <button onClick={() => {
          const d = new Date(dataSelecionada); d.setDate(d.getDate() + 1); setDataSelecionada(d.toISOString().split('T')[0]);
        }} className="p-2 rounded-xl bg-gray-50 text-gray-600"><ChevronRight size={18} /></button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3 max-w-2xl mx-auto">
        {carregando ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
          </div>
        ) : agendamentos.length === 0 ? (
          <div className="card text-center py-12 bg-white rounded-2xl border border-gray-100 p-6">
            <Clock size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum agendamento para esta data.</p>
          </div>
        ) : (
          agendamentos.map(ag => {
            const horarioFormatado = new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={ag.id} className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-2 rounded-xl bg-gray-50 text-center font-bold text-sm" style={{ color: cor }}>
                    {horarioFormatado}
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-bold text-gray-900 text-sm">{ag.clientes?.nome || 'Cliente'}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Scissors size={12} /> {ag.servicos?.nome || 'Serviço'} • <User size={12} /> {ag.profiles?.nome || 'Profissional'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ag.status === 'concluido' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {ag.status === 'concluido' ? 'Concluído' : 'Confirmado'}
                  </span>
                  <button onClick={() => excluirAgendamento(ag.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Novo Agendamento</h3>
              <button onClick={() => setModalAberto(false)}><span className="text-gray-400 text-xl font-bold">×</span></button>
            </div>
            <form onSubmit={criarAgendamento} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Cliente *</label>
                <select required className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none bg-white" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                  <option value="">Selecione o cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Serviço *</label>
                <select required className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none bg-white" value={servicoId} onChange={e => setServicoId(e.target.value)}>
                  <option value="">Selecione o serviço...</option>
                  {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.duracao_minutos} min)</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Profissional *</label>
                <select required className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none bg-white" value={profissionalId} onChange={e => setProfissionalId(e.target.value)}>
                  <option value="">Selecione o profissional...</option>
                  {profissionais.map(pr => <option key={pr.id} value={pr.id}>{pr.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Horário *</label>
                <input type="time" required className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none" value={hora} onChange={e => setHora(e.target.value)} />
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setModalAberto(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm">Cancelar</button>
                <button type="submit" disabled={salvando} className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-50" style={{ backgroundColor: cor }}>{salvando ? 'Salvando...' : 'Salvar Agendamento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
