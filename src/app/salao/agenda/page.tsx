'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Clock, CheckCircle, AlertCircle, XCircle, Edit2, Trash2, Gift } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { Home, Calendar, Users, BarChart2, Settings } from 'lucide-react'

interface Agendamento {
  id: string
  data_hora: string
  duracao_minutos: number
  status: string
  valor: number
  cliente_id: string
  servico_id: string
  servicos_ids: string[] | null
  observacoes: string | null
  clientes: { nome: string; profile_id: string }
  servicos: { nome: string; categoria: string }
  profiles: { nome: string }
}

interface HorarioDisponivel {
  id: string
  data_hora: string
  duracao_minutos: number
  ocupado: boolean
}

// Uma "cobertura" = um serviço do atendimento + as opções de pacote que
// podem cobrir ele + a escolha atual do dono (id de um cliente_pacote, ou
// 'individual' se for cobrar à parte)
interface Cobertura {
  servico_id: string
  nome: string
  preco: number
  opcoes: { cliente_pacote_id: string; nome: string; restantes: number }[]
  escolha: string
}

export default function AgendaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([])
  const [todosServicos, setTodosServicos] = useState<any[]>([])
  const [visualizacao, setVisualizacao] = useState<'semana' | 'mes'>('semana')
  const [modalDisponivel, setModalDisponivel] = useState(false)
  const [novoHorario, setNovoHorario] = useState('')
  const [novaDuracao, setNovaDuracao] = useState(60)
  const [modalCancelamento, setModalCancelamento] = useState(false)
  const [agendamentoParaCancelar, setAgendamentoParaCancelar] = useState<Agendamento | null>(null)
  const [cancelando, setCancelando] = useState(false)

  // Conclusão de atendimento com checagem de pacote por serviço
  const [modalPacote, setModalPacote] = useState(false)
  const [agendamentoConcluindo, setAgendamentoConcluindo] = useState<Agendamento | null>(null)
  const [coberturas, setCoberturas] = useState<Cobertura[]>([])
  const [obsAtendimento, setObsAtendimento] = useState('')
  const [salvandoConclusao, setSalvandoConclusao] = useState(false)
  const [erroConclusao, setErroConclusao] = useState('')

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading, dataSelecionada])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*')
      .eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: srv } = await supabase.from('servicos').select('*')
      .eq('salao_id', profile!.salao_id!).eq('ativo', true)
    setTodosServicos(srv || [])

    const inicio = new Date(dataSelecionada)
    inicio.setHours(0, 0, 0, 0)
    const fim = new Date(dataSelecionada)
    fim.setHours(23, 59, 59, 999)

    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, clientes(nome, profile_id), servicos(nome, categoria), profiles!agendamentos_profissional_id_fkey(nome)')
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

  function nomesServicosDoAgendamento(ag: Agendamento) {
    const ids = ag.servicos_ids?.length ? ag.servicos_ids : [ag.servico_id]
    return ids
      .map(id => todosServicos.find(s => s.id === id)?.nome || ag.servicos?.nome)
      .filter(Boolean)
      .join(', ')
  }

  // Pra cada serviço do atendimento, descobre quais pacotes ativos da
  // cliente cobrem ele. Pacotes "modelo" (pacote_id preenchido) só cobrem
  // se o serviço estiver em pacote_itens; pacotes de cadastro manual
  // (pacote_id nulo, ex: "Pacote Antigo") não têm essa granularidade e
  // são tratados como cobrindo qualquer serviço.
  async function verificarCoberturas(agendamento: Agendamento): Promise<Cobertura[]> {
    const idsServicos = agendamento.servicos_ids?.length ? agendamento.servicos_ids : [agendamento.servico_id]

    const { data: pacotesAtivos } = await supabase
      .from('cliente_pacotes')
      .select('*, pacotes(nome)')
      .eq('cliente_id', agendamento.cliente_id)
      .eq('status', 'ativo')

    const elegiveis = (pacotesAtivos || []).filter((p: any) => p.sessoes_usadas < p.sessoes_total)

    const pacoteIdsModelados = elegiveis.filter((p: any) => p.pacote_id).map((p: any) => p.pacote_id)
    let itensPorPacote: Record<string, string[]> = {}
    if (pacoteIdsModelados.length > 0) {
      const { data: itens } = await supabase
        .from('pacote_itens')
        .select('pacote_id, servico_id')
        .in('pacote_id', pacoteIdsModelados)
      ;(itens || []).forEach((i: any) => {
        if (!itensPorPacote[i.pacote_id]) itensPorPacote[i.pacote_id] = []
        itensPorPacote[i.pacote_id].push(i.servico_id)
      })
    }

    return idsServicos.map((servicoId: string) => {
      const servico = todosServicos.find(s => s.id === servicoId)
      const opcoes = elegiveis
        .filter((p: any) => !p.pacote_id || (itensPorPacote[p.pacote_id] || []).includes(servicoId))
        .map((p: any) => ({
          cliente_pacote_id: p.id,
          nome: p.pacotes?.nome || p.observacoes || 'Pacote',
          restantes: p.sessoes_total - p.sessoes_usadas
        }))
      return {
        servico_id: servicoId,
        nome: servico?.nome || agendamento.servicos?.nome || 'Serviço',
        preco: servico?.preco || 0,
        opcoes,
        escolha: opcoes.length > 0 ? opcoes[0].cliente_pacote_id : 'individual'
      }
    })
  }

  async function marcarComoConcluido(agendamento: Agendamento) {
    setAgendamentoConcluindo(agendamento)
    setErroConclusao('')
    setObsAtendimento(agendamento.observacoes || '')
    const cob = await verificarCoberturas(agendamento)
    const temCobertura = cob.some(c => c.opcoes.length > 0)
    setCoberturas(cob)

    if (temCobertura) {
      setModalPacote(true)
    } else {
      await finalizarAtendimento(agendamento, cob, agendamento.observacoes || '')
    }
  }

  function atualizarEscolha(servicoId: string, valor: string) {
    setCoberturas(prev => prev.map(c => c.servico_id === servicoId ? { ...c, escolha: valor } : c))
  }

  async function finalizarAtendimento(agendamento: Agendamento, coberturasFinal: Cobertura[], observacoesFinal: string) {
    setSalvandoConclusao(true)
    setErroConclusao('')

    try {
      let valorCobrado = 0
      const pacotesUsados = new Set<string>()

      for (const cob of coberturasFinal) {
        if (cob.escolha === 'individual') {
          valorCobrado += cob.preco
        } else {
          pacotesUsados.add(cob.escolha)
        }
      }

      // Uma sessão descontada por pacote usado (não por serviço) — o
      // sistema conta sessão como "visita", igual já funciona em todo
      // o resto do app.
      for (const pacoteId of Array.from(pacotesUsados)) {
        const { data: pac, error: errBusca } = await supabase
          .from('cliente_pacotes').select('*').eq('id', pacoteId).single()
        if (errBusca || !pac) throw errBusca || new Error('Pacote não encontrado')

        const servicosDessePacote = coberturasFinal
          .filter(c => c.escolha === pacoteId)
          .map(c => c.nome)
          .join(', ')

        const novasUsadas = pac.sessoes_usadas + 1
        const novoStatus = novasUsadas >= pac.sessoes_total ? 'concluido' : 'ativo'

        const { error: errUp } = await supabase.from('cliente_pacotes')
          .update({ sessoes_usadas: novasUsadas, status: novoStatus })
          .eq('id', pacoteId)
        if (errUp) throw errUp

        const { error: errSess } = await supabase.from('sessoes_pacote').insert({
          cliente_pacote_id: pacoteId,
          data_sessao: new Date().toISOString().slice(0, 10),
          servico_realizado: servicosDessePacote,
          profissional_id: profile!.id
        })
        if (errSess) throw errSess
      }

      const pacoteIdUnico = pacotesUsados.size === 1 ? Array.from(pacotesUsados)[0] : null
      const tipoCobranca = pacotesUsados.size === 0 ? 'avulso' : valorCobrado > 0 ? 'misto' : 'pacote'

      const { error: errAg } = await supabase.from('agendamentos').update({
        status: 'concluido',
        confirmado_por: profile!.id,
        valor: valorCobrado,
        tipo_cobranca: tipoCobranca,
        cliente_pacote_id: pacoteIdUnico,
        observacoes: observacoesFinal || null
      }).eq('id', agendamento.id)
      if (errAg) throw errAg

      setSalvandoConclusao(false)
      setModalPacote(false)
      setAgendamentoConcluindo(null)
      setCoberturas([])
      carregarDados()
    } catch (e: any) {
      setErroConclusao('Erro ao concluir: ' + (e.message || 'tente novamente'))
      setSalvandoConclusao(false)
    }
  }

  async function alterarStatus(id: string, status: string) {
    await supabase.from('agendamentos').update({ status, confirmado_por: profile?.id }).eq('id', id)
    carregarDados()
  }

  async function cancelarAgendamento(agendamento: Agendamento) {
    setCancelando(true)

    await supabase.from('agendamentos').delete().eq('id', agendamento.id)

    if (agendamento?.clientes?.profile_id) {
      await supabase.from('notificacoes').insert({
        salao_id: profile!.salao_id,
        remetente_id: profile!.id,
        destinatario_id: agendamento.clientes.profile_id,
        titulo: '❌ Agendamento cancelado',
        mensagem: `Seu agendamento foi cancelado.`,
        tipo: 'lembrete'
      })
    }

    setCancelando(false)
    setModalCancelamento(false)
    setAgendamentoParaCancelar(null)
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

  const valorTotalPreview = coberturas
    .filter(c => c.escolha === 'individual')
    .reduce((acc, c) => acc + c.preco, 0)

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
            const nomesServicos = nomesServicosDoAgendamento(ag)

            return (
              <div key={ag.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">{ag.clientes?.nome}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${st.cor}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{nomesServicos}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <Clock size={10} className="inline mr-1" />
                      {hora} - {horaFim} • Prof: {ag.profiles?.nome}
                    </p>
                    {ag.valor != null && (
                      <p className="text-sm font-medium mt-1" style={{ color: cor }}>
                        R$ {Number(ag.valor).toFixed(2).replace('.', ',')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/salao/agenda/editar/${ag.id}`)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setAgendamentoParaCancelar(ag)
                        setModalCancelamento(true)
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
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
                  <button onClick={() => marcarComoConcluido(ag)}
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

      {/* Modal de Cancelamento */}
      {modalCancelamento && agendamentoParaCancelar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Cancelar agendamento?</h3>
                <p className="text-sm text-gray-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => cancelarAgendamento(agendamentoParaCancelar)}
                disabled={cancelando}
                className="w-full py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
                {cancelando ? 'Cancelando...' : 'Sim, cancelar agendamento'}
              </button>
              <button
                onClick={() => {
                  setModalCancelamento(false)
                  setAgendamentoParaCancelar(null)
                }}
                className="w-full py-3 bg-gray-100 text-gray-900 font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                Não, voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de conclusão com checagem de pacote por serviço */}
      {modalPacote && agendamentoConcluindo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${cor}20` }}>
                <Gift size={24} style={{ color: cor }} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Concluir atendimento</h3>
                <p className="text-sm text-gray-500">{agendamentoConcluindo.clientes?.nome}</p>
              </div>
            </div>

            <p className="text-gray-500 text-sm">
              Escolha, pra cada serviço, se vai descontar de um pacote ativo ou cobrar à parte:
            </p>

            <div className="flex flex-col gap-4">
              {coberturas.map(cob => (
                <div key={cob.servico_id} className="flex flex-col gap-2">
                  <p className="font-semibold text-gray-900 text-sm">{cob.nome}</p>
                  <div className="flex flex-col gap-2">
                    {cob.opcoes.map(op => (
                      <button key={op.cliente_pacote_id}
                        onClick={() => atualizarEscolha(cob.servico_id, op.cliente_pacote_id)}
                        className="w-full p-3 rounded-xl border-2 transition-all text-left"
                        style={cob.escolha === op.cliente_pacote_id
                          ? { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }
                          : { borderColor: '#e5e7eb', backgroundColor: 'white' }}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 text-sm">{op.nome}</p>
                          <Gift size={16} className="text-green-600 shrink-0" />
                        </div>
                        <p className="text-xs text-gray-500">{op.restantes} sessão(ns) restante(s)</p>
                      </button>
                    ))}
                    <button
                      onClick={() => atualizarEscolha(cob.servico_id, 'individual')}
                      className="w-full p-3 rounded-xl border-2 transition-all text-left"
                      style={cob.escolha === 'individual'
                        ? { borderColor: cor, backgroundColor: `${cor}10` }
                        : { borderColor: '#e5e7eb', backgroundColor: 'white' }}>
                      <p className="font-medium text-gray-900 text-sm">Cobrar à parte</p>
                      <p className="text-xs text-gray-500">R$ {cob.preco.toFixed(2).replace('.', ',')}</p>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Observações (opcional)</label>
              <textarea className="input-field resize-none" rows={2}
                value={obsAtendimento} onChange={e => setObsAtendimento(e.target.value)} />
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">Total cobrado agora</span>
              <span className="font-bold text-lg" style={{ color: cor }}>
                R$ {valorTotalPreview.toFixed(2).replace('.', ',')}
              </span>
            </div>

            {erroConclusao && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{erroConclusao}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalPacote(false)
                  setAgendamentoConcluindo(null)
                  setCoberturas([])
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-900 font-semibold rounded-xl">
                Cancelar
              </button>
              <button
                onClick={() => finalizarAtendimento(agendamentoConcluindo, coberturas, obsAtendimento)}
                disabled={salvandoConclusao}
                className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-50"
                style={{ backgroundColor: cor }}>
                {salvandoConclusao ? 'Salvando...' : 'Concluir atendimento'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}