O codigo como estava funcionando: 
'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Edit2, Trash2, Clock, X, Check, Calendar } from 'lucide-react'

type Agendamento = {
  id: string
  cliente_id: string
  servico_id: string
  servicos_ids?: string[]
  profissional_id?: string
  data_hora: string
  duracao_minutos: number
  status: string
  observacoes?: string
  valor?: number
  clientes?: { nome: string }
  servicos?: { nome: string; preco: number }
  profiles?: { nome: string }
  servicos_detalhes?: { id: string; nome: string; preco: number; duracao_minutos: number }[]
}

function formatarDuracao(min: number) {
  if (!min) return ''
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60), m = min % 60
  return m === 0 ? `${h}h` : `${h}h${m}min`
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_COMPLETOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function AgendaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [todosServicos, setTodosServicos] = useState<any[]>([])
  const [view, setView] = useState<'semana' | 'mes'>('semana')
  const [dataBase, setDataBase] = useState(new Date())
  const [carregando, setCarregando] = useState(true)
  const [modalEditar, setModalEditar] = useState<Agendamento | null>(null)
  const [formEditar, setFormEditar] = useState({ status: '', observacoes: '', valor: '' })
  const [salvando, setSalvando] = useState(false)
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: srvs } = await supabase.from('servicos').select('id, nome, preco, duracao_minutos')
      .eq('salao_id', profile!.salao_id!).eq('ativo', true)
    setTodosServicos(srvs || [])

    await carregarAgendamentos()
    setCarregando(false)
  }

  async function carregarAgendamentos() {
    const inicio = getInicioSemana(dataBase)
    const fim = new Date(inicio); fim.setDate(fim.getDate() + 60)

    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(nome), servicos(nome, preco), profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('salao_id', profile!.salao_id!)
      .gte('data_hora', inicio.toISOString())
      .lte('data_hora', fim.toISOString())
      .order('data_hora')

    setAgendamentos(ags || [])
  }

  useEffect(() => {
    if (profile?.salao_id) carregarAgendamentos()
  }, [dataBase])

  function getInicioSemana(d: Date) {
    const dia = new Date(d)
    const dow = dia.getDay()
    dia.setDate(dia.getDate() - dow)
    dia.setHours(0, 0, 0, 0)
    return dia
  }

  function getDiasSemana() {
    const inicio = getInicioSemana(dataBase)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio); d.setDate(d.getDate() + i); return d
    })
  }

  function getDiasMes() {
    const ano = dataBase.getFullYear(), mes = dataBase.getMonth()
    const primeiro = new Date(ano, mes, 1)
    const ultimo = new Date(ano, mes + 1, 0)
    const dias: Date[] = []
    for (let d = new Date(primeiro); d <= ultimo; d.setDate(d.getDate() + 1)) dias.push(new Date(d))
    return dias
  }

  function agendamentosDoDia(dia: Date) {
    return agendamentos.filter(ag => {
      const d = new Date(ag.data_hora)
      return d.getFullYear() === dia.getFullYear() && d.getMonth() === dia.getMonth() && d.getDate() === dia.getDate()
    })
  }

  function getServicosDetalhados(ag: Agendamento) {
    if (ag.servicos_ids && ag.servicos_ids.length > 1) {
      return todosServicos.filter(s => ag.servicos_ids!.includes(s.id))
    }
    return ag.servicos ? [ag.servicos] : []
  }

  async function excluirAgendamento(id: string) {
    await supabase.from('agendamentos').delete().eq('id', id)
    carregarAgendamentos()
  }

  async function salvarEdicao() {
    if (!modalEditar) return
    setSalvando(true)
    await supabase.from('agendamentos').update({
      status: formEditar.status,
      observacoes: formEditar.observacoes || null,
      valor: formEditar.valor ? parseFloat(formEditar.valor) : null
    }).eq('id', modalEditar.id)
    setModalEditar(null); setSalvando(false); carregarAgendamentos()
  }

  const statusConfig: Record<string, { label: string; cor: string; bg: string }> = {
    confirmado: { label: 'Confirmado', cor: '#16a34a', bg: '#f0fdf4' },
    pendente: { label: 'Pendente', cor: '#d97706', bg: '#fffbeb' },
    concluido: { label: 'Concluído', cor: '#6b7280', bg: '#f9fafb' },
    cancelado: { label: 'Cancelado', cor: '#dc2626', bg: '#fef2f2' },
    aguardando_confirmacao: { label: 'Aguardando', cor: '#2563eb', bg: '#eff6ff' },
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const hoje = new Date()
  const diasSemana = getDiasSemana()
  const diasMes = getDiasMes()
  const diaVer = diaSelecionado || (view === 'semana' ? diasSemana[0] : hoje)

  function CardAgendamento({ ag }: { ag: Agendamento }) {
    const st = statusConfig[ag.status] || statusConfig.pendente
    const inicio = new Date(ag.data_hora)
    const fim = new Date(inicio.getTime() + (ag.duracao_minutos || 60) * 60000)
    const horaInicio = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const horaFim = fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const servicosDetalhados = getServicosDetalhados(ag)
    const temMultiplos = servicosDetalhados.length > 1
    const precoTotal = ag.valor || servicosDetalhados.reduce((acc, s) => acc + (s.preco || 0), 0)

    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 leading-tight">{ag.clientes?.nome}</p>

            {/* Serviços — lista se múltiplos */}
            {temMultiplos ? (
              <div className="mt-1 flex flex-col gap-0.5">
                {servicosDetalhados.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                    <p className="text-sm text-gray-500">{s.nome}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-0.5">{ag.servicos?.nome}</p>
            )}

            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1 text-gray-400">
                <Clock size={12} />
                <p className="text-xs">{horaInicio} – {horaFim}</p>
              </div>
              {ag.profiles?.nome && (
                <p className="text-xs text-gray-400">Prof: {ag.profiles.nome}</p>
              )}
            </div>

            {precoTotal > 0 && (
              <p className="text-sm font-bold mt-1" style={{ color: cor }}>
                R$ {precoTotal.toFixed(2).replace('.', ',')}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ color: st.cor, backgroundColor: st.bg }}>
              {st.label.toUpperCase()}
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => {
                setModalEditar(ag)
                setFormEditar({ status: ag.status, observacoes: ag.observacoes || '', valor: ag.valor?.toString() || '' })
              }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Edit2 size={13} className="text-gray-500" />
              </button>
              <button onClick={() => excluirAgendamento(ag.id)}
                className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={13} className="text-red-400" />
              </button>
            </div>
          </div>
        </div>

        {ag.observacoes && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">{ag.observacoes}</p>
        )}
      </div>
    )
  }

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Agenda</h1>
        <button onClick={() => router.push('/salao/agenda/novo')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      {/* Toggle semana/mês */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex bg-gray-100 rounded-2xl p-1">
          {(['semana', 'mes'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
              style={view === v ? { backgroundColor: cor, color: 'white' } : { color: '#6b7280' }}>
              {v === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* Navegação de semana */}
      {view === 'semana' && (
        <>
          <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
            <button onClick={() => { const d = new Date(dataBase); d.setDate(d.getDate() - 7); setDataBase(d) }}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <p className="text-sm font-semibold text-gray-700">
              {diasSemana[0].getDate()} {MESES[diasSemana[0].getMonth()]} – {diasSemana[6].getDate()} {MESES[diasSemana[6].getMonth()]}
            </p>
            <button onClick={() => { const d = new Date(dataBase); d.setDate(d.getDate() + 7); setDataBase(d) }}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>

          <div className="flex bg-white border-b border-gray-100 overflow-x-auto">
            {diasSemana.map((dia, i) => {
              const ehHoje = dia.toDateString() === hoje.toDateString()
              const selecionado = diaSelecionado?.toDateString() === dia.toDateString()
              const count = agendamentosDoDia(dia).length
              return (
                <button key={i} onClick={() => setDiaSelecionado(selecionado ? null : dia)}
                  className="flex-1 flex flex-col items-center py-2 gap-0.5 relative">
                  <p className="text-xs text-gray-400">{DIAS[dia.getDay()]}</p>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={ehHoje || selecionado
                      ? { backgroundColor: cor, color: 'white' }
                      : { color: '#111827' }}>
                    {dia.getDate()}
                  </div>
                  {count > 0 && (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cor }} />
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Navegação de mês */}
      {view === 'mes' && (
        <>
          <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
            <button onClick={() => { const d = new Date(dataBase); d.setMonth(d.getMonth() - 1); setDataBase(d) }}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <p className="text-sm font-semibold text-gray-700">
              {MESES[dataBase.getMonth()]} {dataBase.getFullYear()}
            </p>
            <button onClick={() => { const d = new Date(dataBase); d.setMonth(d.getMonth() + 1); setDataBase(d) }}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>

          <div className="bg-white border-b border-gray-100 px-2 pb-2">
            <div className="grid grid-cols-7 mb-1">
              {DIAS.map(d => <p key={d} className="text-center text-xs text-gray-400 py-1">{d}</p>)}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: new Date(dataBase.getFullYear(), dataBase.getMonth(), 1).getDay() }).map((_, i) => (
                <div key={i} />
              ))}
              {diasMes.map((dia, i) => {
                const ehHoje = dia.toDateString() === hoje.toDateString()
                const selecionado = diaSelecionado?.toDateString() === dia.toDateString()
                const count = agendamentosDoDia(dia).length
                return (
                  <button key={i} onClick={() => setDiaSelecionado(selecionado ? null : dia)}
                    className="flex flex-col items-center py-1 gap-0.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={ehHoje || selecionado
                        ? { backgroundColor: cor, color: 'white' }
                        : { color: '#111827' }}>
                      {dia.getDate()}
                    </div>
                    {count > 0 && (
                      <div className="w-1 h-1 rounded-full" style={{ backgroundColor: cor }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Lista de agendamentos */}
      <div className="px-4 py-4 flex flex-col gap-3">

    {/* Botão liberar horário */}
<button onClick={() => router.push('/salao/horarios-vagos')}
  className="w-full py-3 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-semibold"
  style={{ borderColor: cor, color: cor }}>
  <Plus size={16} />Liberar horário para clientes
</button>

        {(() => {
          const diasParaMostrar = diaSelecionado
            ? [diaSelecionado]
            : view === 'semana'
              ? diasSemana
              : diasMes.filter(d => agendamentosDoDia(d).length > 0)

          const temAlgum = diasParaMostrar.some(d => agendamentosDoDia(d).length > 0)

          if (!temAlgum) return (
            <div className="card text-center py-10 flex flex-col items-center gap-3">
              <Calendar size={36} className="text-gray-300" />
              <p className="text-gray-400">Nenhum agendamento</p>
              <button onClick={() => router.push('/salao/agenda/novo')}
                className="px-4 py-2 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: cor }}>
                + Novo agendamento
              </button>
            </div>
          )

          return diasParaMostrar.map(dia => {
            const ags = agendamentosDoDia(dia)
            if (ags.length === 0) return null
            return (
              <div key={dia.toISOString()}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: dia.toDateString() === hoje.toDateString() ? cor : '#9ca3af' }}>
                    {dia.getDate()}
                  </div>
                  <p className="text-sm font-semibold text-gray-700">
                    {DIAS_COMPLETOS[dia.getDay()]}, {dia.getDate()} de {MESES[dia.getMonth()]}
                    {dia.toDateString() === hoje.toDateString() && (
                      <span className="ml-2 text-xs font-normal" style={{ color: cor }}>(hoje)</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-col gap-2 ml-10">
                  {ags.map(ag => <CardAgendamento key={ag.id} ag={ag} />)}
                </div>
              </div>
            )
          })
        })()}
      </div>

      {/* Modal editar */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Editar agendamento</h3>
              <button onClick={() => setModalEditar(null)}><X size={20} className="text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-500">{modalEditar.clientes?.nome}</p>

            {getServicosDetalhados(modalEditar).length > 1 && (
              <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1">
                <p className="text-xs font-medium text-gray-500 mb-1">Serviços:</p>
                {getServicosDetalhados(modalEditar).map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cor }} />
                    <p className="text-sm text-gray-700">{s.nome}</p>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <select className="input-field" value={formEditar.status}
                onChange={e => setFormEditar(p => ({ ...p, status: e.target.value }))}>
                <option value="confirmado">Confirmado</option>
                <option value="pendente">Pendente</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Valor cobrado (R$)</label>
              <input className="input-field" type="number" placeholder="0,00"
                value={formEditar.valor}
                onChange={e => setFormEditar(p => ({ ...p, valor: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Observações</label>
              <textarea className="input-field resize-none" rows={2}
                value={formEditar.observacoes}
                onChange={e => setFormEditar(p => ({ ...p, observacoes: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalEditar(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={salvando}
                className="flex-1 py-3 rounded-2xl text-white font-medium"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}