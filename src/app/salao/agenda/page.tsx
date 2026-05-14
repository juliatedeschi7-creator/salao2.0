'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Search, ChevronLeft, ChevronRight, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { Home, Calendar, Users, BarChart2, Settings } from 'lucide-react'

interface Agendamento {
  id: string
  data_hora: string
  duracao_minutos: number
  status: string
  valor: number
  clientes: { nome: string }
  servicos: { nome: string; categoria: string }
  profiles: { nome: string }
}

interface HorarioDisponivel {
  id: string
  data_hora: string
  duracao_minutos: number
  ocupado: boolean
}

export default function AgendaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([])
  const [visualizacao, setVisualizacao] = useState<'semana' | 'mes'>('semana')
  const [modalDisponivel, setModalDisponivel] = useState(false)
  const [novoHorario, setNovoHorario] = useState('')
  const [novaDuracao, setNovaDuracao] = useState(60)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading, dataSelecionada])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*')
      .eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const inicio = new Date(dataSelecionada)
    inicio.setHours(0, 0, 0, 0)
    const fim = new Date(dataSelecionada)
    fim.setHours(23, 59, 59, 999)

    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, clientes(nome), servicos(nome, categoria), profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('salao_id', profile!.salao_id!)
      .gte('data_hora', inicio.toISOString())
      .lte('data_hora', fim.toISOString())
      .order('data_hora')

    const { data: hors } = await supabase
      .from('horarios_disponiveis')
      .select('*')
      .eq('salao_id', profile!.salao_id!)
      .gte('data_hora', inicio.toISOString())
      .lte('data_hora', fim.toISOString())
      .order('data_hora')

    setAgendamentos(ags || [])
    setHorarios(hors || [])
  }

  async function adicionarHorarioDisponivel() {
    if (!novoHorario) return
    const dataHora = new Date(dataSelecionada)
    const [h, m] = novoHorario.split(':')
    dataHora.setHours(parseInt(h), parseInt(m), 0, 0)

    await supabase.from('horarios_disponiveis').insert({
      salao_id: profile!.salao_id,
      profissional_id: profile!.id,
      data_hora: dataHora.toISOString(),
      duracao_minutos: novaDuracao,
      ocupado: false,
    })

    setModalDisponivel(false)
    setNovoHorario('')
    carregarDados()
  }

  async function alterarStatus(id: string, status: string) {
    await supabase.from('agendamentos').update({ status, confirmado_por: profile?.id }).eq('id', id)
    carregarDados()
  }

  function diasDaSemana() {
    const dias = []
    const inicio = new Date(dataSelecionada)
    const diaSemana = inicio.getDay()
    inicio.setDate(inicio.getDate() - diaSemana + 1)
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      dias.push(d)
    }
    return dias
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const navItems = [
    { icon: Home, label: 'Início', href: '/salao' },
    { icon: Calendar, label: 'Agenda', href: '/salao/agenda' },
    { icon: Users, label: 'Clientes', href: '/salao/clientes' },
    { icon: BarChart2, label: 'Finanças', href: '/salao/financeiro' },
    { icon: Settings, label: 'Ajustes', href: '/salao/configuracoes' },
  ]

  const statusConfig: Record<string, { cor: string; label: string }> = {
    confirmado: { cor: 'text-green-600 bg-green-50', label: 'CONFIRMADO' },
    pendente: { cor: 'text-yellow-600 bg-yellow-50', label: 'PENDENTE' },
    concluido: { cor: 'text-gray-500 bg-gray-50', label: 'CONCLUÍDO' },
    cancelado: { cor: 'text-red-500 bg-red-50', label: 'CANCELADO' },
    aguardando_confirmacao: { cor: 'text-blue-600 bg-blue-50', label: 'AGUARDANDO' },
  }

  return (
    <div className="min-h-screen bg-[#f8f4f6] pb-20">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Agenda</h1>
        <button onClick={() => router.push('/salao/agenda/novo')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      {/* Semana/Mês toggle */}
      <div className="bg-white px-4 pb-3">
        <div className="flex bg-pink-50 rounded-full p-1 gap-1">
          {(['semana', 'mes'] as const).map(v => (
            <button key={v} onClick={() => setVisualizacao(v)}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${visualizacao === v ? 'bg-white shadow-sm' : 'text-gray-400'}`}
              style={visualizacao === v ? { color: cor } : {}}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Dias da semana */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {diasDaSemana().map((dia, i) => {
            const isSelecionado = dia.toDateString() === dataSelecionada.toDateString()
            const isHoje = dia.toDateString() === new Date().toDateString()
            const diasSemana = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
            return (
              <button key={i} onClick={() => setDataSelecionada(dia)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl min-w-[52px] transition-all`}
                style={isSelecionado ? { backgroundColor: cor } : {}}>
                <span className={`text-xs font-medium ${isSelecionado ? 'text-white' : 'text-gray-400'}`}>
                  {diasSemana[i]}
                </span>
                <span className={`text-lg font-bold ${isSelecionado ? 'text-white' : 'text-gray-900'}`}>
                  {dia.getDate()}
                </span>
                {isHoje && !isSelecionado && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cor }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Botão horário disponível */}
        <button onClick={() => setModalDisponivel(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed text-sm font-medium"
          style={{ borderColor: cor, color: cor }}>
          <Plus size={16} />
          Liberar horário para clientes
        </button>

        {/* Horários disponíveis */}
        {horarios.filter(h => !h.ocupado).map(h => (
          <div key={h.id} className="card border-2 border-dashed border-gray-200 flex items-center gap-3">
            <Clock size={16} className="text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Disponível</p>
              <p className="font-medium text-gray-700">
                {new Date(h.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {' '}• {h.duracao_minutos} min
              </p>
            </div>
          </div>
        ))}

        {/* Agendamentos */}
        {agendamentos.length === 0 && horarios.filter(h => !h.ocupado).length === 0 ? (
          <div className="card text-center py-10">
            <Calendar size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum agendamento neste dia</p>
          </div>
        ) : (
          agendamentos.map(ag => {
            const st = statusConfig[ag.status] || statusConfig.pendente
            const hora = new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            const horaFim = new Date(new Date(ag.data_hora).getTime() + ag.duracao_minutos * 60000)
              .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

            return (
              <div key={ag.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">{ag.clientes?.nome}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${st.cor}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{ag.servicos?.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <Clock size={10} className="inline mr-1" />
                      {hora} - {horaFim} • Prof: {ag.profiles?.nome}
                    </p>
                    {ag.valor && (
                      <p className="text-sm font-medium mt-1" style={{ color: cor }}>
                        R$ {ag.valor.toFixed(2).replace('.', ',')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações */}
                {ag.status === 'aguardando_confirmacao' && (
                  <div className="flex gap-2">
                    <button onClick={() => alterarStatus(ag.id, 'cancelado')}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-50 text-red-500 text-sm font-medium">
                      <XCircle size={14} />Recusar
                    </button>
                    <button onClick={() => alterarStatus(ag.id, 'confirmado')}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-green-50 text-green-600 text-sm font-medium">
                      <CheckCircle size={14} />Confirmar
                    </button>
                  </div>
                )}
                {ag.status === 'confirmado' && (
                  <button onClick={() => alterarStatus(ag.id, 'concluido')}
                    className="w-full py-2 rounded-xl text-sm font-medium text-white"
                    style={{ backgroundColor: cor }}>
                    ✓ Marcar como Concluído
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal horário disponível */}
      {modalDisponivel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Liberar Horário</h3>
            <p className="text-gray-500 text-sm">
              Clientes poderão solicitar este horário em {dataSelecionada.toLocaleDateString('pt-BR')}
            </p>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Horário</label>
              <input type="time" className="input-field"
                value={novoHorario} onChange={e => setNovoHorario(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Duração (minutos)</label>
              <select className="input-field" value={novaDuracao}
                onChange={e => setNovaDuracao(Number(e.target.value))}>
                {[30, 45, 60, 90, 120].map(d => (
                  <option key={d} value={d}>{d} minutos</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalDisponivel(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={adicionarHorarioDisponivel}
                className="flex-1 py-3 rounded-2xl text-white font-medium"
                style={{ backgroundColor: cor }}>
                Liberar
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}
