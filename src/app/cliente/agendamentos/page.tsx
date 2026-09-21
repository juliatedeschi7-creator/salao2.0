// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  Minus,
  X,
  CheckCircle,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`

  const h = Math.floor(minutos / 60)
  const m = minutos % 60

  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`

  return `${h}h${m > 0 ? ` e ${m}min` : ''}`
}

type ItemCarrinho = {
  id: string
  nome: string
  preco: number
  duracao_minutos: number
  quantidade: number
}

type PreferenciaRemarcacao = {
  data: string
  horarios: string[]
}

export default function ClienteAgendamentosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('todos')
  const [filtro, setFiltro] = useState<'proximos' | 'historico'>('proximos')

  // Estados para o fluxo de agendamento / carrinho
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [modalAgendar, setModalAgendar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [dataPreferida, setDataPreferida] = useState('')
  const [periodoPreferido, setPeriodoPreferido] = useState('qualquer')

  // Estados para resposta dos agendamentos
  const [respondendoAgendamento, setRespondendoAgendamento] = useState<string | null>(null)

  // Estados para remarcação
  const [modalRemarcar, setModalRemarcar] = useState(false)
  const [agendamentoRemarcando, setAgendamentoRemarcando] = useState<any>(null)
  const [preferenciasRemarcacao, setPreferenciasRemarcacao] = useState<PreferenciaRemarcacao[]>([
    {
      data: '',
      horarios: [''],
    },
  ])
  const [periodoRemarcacao, setPeriodoRemarcacao] = useState('qualquer')
  const [observacaoRemarcacao, setObservacaoRemarcacao] = useState('')
  const [enviandoRemarcacao, setEnviandoRemarcacao] = useState(false)
  const [remarcacaoEnviada, setRemarcacaoEnviada] = useState(false)

  // Controla detalhes das preferências de cada agendamento
  const [agendamentoExpandido, setAgendamentoExpandido] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase
      .from('clientes')
      .select('*, saloes(*)')
      .eq('profile_id', profile!.id)
      .single()

    if (!cli) return

    setCliente(cli)
    setSalao(cli?.saloes)

    const salaoId = cli?.saloes?.id

    // Busca serviços disponíveis do salão
    if (salaoId) {
      const { data: srvs } = await supabase
        .from('servicos')
        .select('*')
        .eq('salao_id', salaoId)
        .eq('ativo', true)
        .order('categoria')

      if (srvs) {
        setServicos(srvs)

        const cats = Array.from(
          new Set(srvs.map(s => s.categoria).filter(Boolean))
        ) as string[]

        setCategorias(cats)
      }
    }

    // Busca os agendamentos do cliente
    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('cliente_id', cli?.id)
      .order('data_hora', { ascending: false })

    if (!ags) {
      setAgendamentos([])
      return
    }

    // Extrai todos os IDs de serviços únicos
    const todosServicosIds = Array.from(
      new Set(
        ags.flatMap(ag => {
          if (!ag.servicos_ids) return []

          return Array.isArray(ag.servicos_ids)
            ? ag.servicos_ids
            : [ag.servicos_ids]
        })
      )
    )

    // Busca os detalhes dos serviços
    let servicosMap = {}

    if (todosServicosIds.length > 0) {
      const { data: servicosData } = await supabase
        .from('servicos')
        .select('id, nome, preco')
        .in('id', todosServicosIds)

      if (servicosData) {
        servicosMap = Object.fromEntries(
          servicosData.map(s => [s.id, s])
        )
      }
    }

    // Associa os serviços a cada agendamento
    const agsComServicos = ags.map(ag => {
      const ids = Array.isArray(ag.servicos_ids)
        ? ag.servicos_ids
        : ag.servicos_ids
          ? [ag.servicos_ids]
          : []

      const listaServicos = ids
        .map(id => servicosMap[id])
        .filter(Boolean)

      if (
        listaServicos.length === 0 &&
        ag.servico_id &&
        servicosMap[ag.servico_id]
      ) {
        listaServicos.push(servicosMap[ag.servico_id])
      }

      return {
        ...ag,
        servicosLista: listaServicos,
      }
    })

    setAgendamentos(agsComServicos)
  }

  function adicionarAoCarrinho(s: any) {
    setCarrinho(prev => {
      const existe = prev.find(i => i.id === s.id)

      if (existe) {
        return prev.map(i =>
          i.id === s.id
            ? { ...i, quantidade: i.quantidade + 1 }
            : i
        )
      }

      return [
        ...prev,
        {
          id: s.id,
          nome: s.nome,
          preco: s.preco,
          duracao_minutos: s.duracao_minutos,
          quantidade: 1,
        },
      ]
    })
  }

  function removerDoCarrinho(id: string) {
    setCarrinho(prev => {
      const item = prev.find(i => i.id === id)

      if (!item) return prev

      if (item.quantidade === 1) {
        return prev.filter(i => i.id !== id)
      }

      return prev.map(i =>
        i.id === id
          ? { ...i, quantidade: i.quantidade - 1 }
          : i
      )
    })
  }

  function qtdCarrinho(id: string) {
    return carrinho.find(i => i.id === id)?.quantidade || 0
  }

  const totalCarrinho = carrinho.reduce(
    (acc, i) => acc + i.preco * i.quantidade,
    0
  )

  const totalItens = carrinho.reduce(
    (acc, i) => acc + i.quantidade,
    0
  )

  const duracaoTotal = carrinho.reduce(
    (acc, i) => acc + i.duracao_minutos * i.quantidade,
    0
  )

  const servicosFiltrados =
    categoriaSelecionada === 'todos'
      ? servicos
      : servicos.filter(s => s.categoria === categoriaSelecionada)

  async function enviarCarrinho() {
    if (carrinho.length === 0 || !cliente || !salao) return

    setEnviando(true)

    const grupoId = crypto.randomUUID()

    for (const item of carrinho) {
      await supabase.from('solicitacoes_agendamento').insert({
        salao_id: salao.id,
        cliente_id: cliente.id,
        servico_id: item.id,
        status: 'pendente',
        grupo_id: grupoId,
        data_preferida: dataPreferida || null,
        periodo_preferido:
          periodoPreferido !== 'qualquer'
            ? periodoPreferido
            : null,
      })
    }

    const resumo = carrinho
      .map(i => `${i.quantidade}x ${i.nome}`)
      .join(', ')

    await notificar({
      salaoId: salao.id,
      remetenteId: profile!.id,
      destinatarioId: salao.dono_id,
      titulo: 'Nova solicitação de agendamento',
      mensagem: `${cliente.nome} quer agendar: ${resumo}`,
      tipo: 'solicitacao',
      url: '/salao/notificacoes',
    })

    setEnviando(false)
    setEnviado(true)
    setCarrinho([])
    setDataPreferida('')
    setPeriodoPreferido('qualquer')

    setTimeout(() => {
      setEnviado(false)
      setModalAgendar(false)
      carregarDados()
    }, 3000)
  }

  // =========================================================
  // RESPOSTA DIRETA AO AGENDAMENTO
  // =========================================================

  async function responderAgendamento(
    agendamento: any,
    resposta: 'vou_comparecer' | 'nao_vou_comparecer'
  ) {
    if (!cliente || !salao) return

    setRespondendoAgendamento(agendamento.id)

    const { error } = await supabase
      .from('agendamentos')
      .update({
        resposta_cliente: resposta,
        resposta_cliente_em: new Date().toISOString(),
      })
      .eq('id', agendamento.id)
      .eq('cliente_id', cliente.id)

    if (error) {
      console.error('Erro ao registrar resposta:', error)
      setRespondendoAgendamento(null)
      return
    }

    const nomeCliente = cliente.nome || 'O cliente'

    if (resposta === 'vou_comparecer') {
      await notificar({
        salaoId: salao.id,
        remetenteId: profile!.id,
        destinatarioId: salao.dono_id,
        titulo: 'Cliente confirmou presença',
        mensagem: `${nomeCliente} confirmou presença no agendamento de ${formatarDataHora(agendamento.data_hora)}.`,
        tipo: 'resposta_agendamento',
        url: '/salao/agenda',
      })
    } else {
      await notificar({
        salaoId: salao.id,
        remetenteId: profile!.id,
        destinatarioId: salao.dono_id,
        titulo: 'Cliente não poderá comparecer',
        mensagem: `${nomeCliente} informou que não poderá comparecer ao agendamento de ${formatarDataHora(agendamento.data_hora)}.`,
        tipo: 'resposta_agendamento',
        url: '/salao/agenda',
      })
    }

    await carregarDados()
    setRespondendoAgendamento(null)
  }

  // =========================================================
  // REMARCAÇÃO
  // =========================================================

  function abrirModalRemarcar(agendamento: any) {
    setAgendamentoRemarcando(agendamento)

    setPreferenciasRemarcacao([
      {
        data: '',
        horarios: [''],
      },
    ])

    setPeriodoRemarcacao('qualquer')
    setObservacaoRemarcacao('')
    setRemarcacaoEnviada(false)
    setModalRemarcar(true)
  }

  function fecharModalRemarcar() {
    if (enviandoRemarcacao) return

    setModalRemarcar(false)
    setAgendamentoRemarcando(null)
    setPreferenciasRemarcacao([
      {
        data: '',
        horarios: [''],
      },
    ])
    setPeriodoRemarcacao('qualquer')
    setObservacaoRemarcacao('')
    setRemarcacaoEnviada(false)
  }

  function alterarDataRemarcacao(index: number, data: string) {
    setPreferenciasRemarcacao(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, data }
          : item
      )
    )
  }

  function alterarHorarioRemarcacao(
    dataIndex: number,
    horarioIndex: number,
    horario: string
  ) {
    setPreferenciasRemarcacao(prev =>
      prev.map((item, i) => {
        if (i !== dataIndex) return item

        return {
          ...item,
          horarios: item.horarios.map((h, hi) =>
            hi === horarioIndex ? horario : h
          ),
        }
      })
    )
  }

  function adicionarHorario(dataIndex: number) {
    setPreferenciasRemarcacao(prev =>
      prev.map((item, i) =>
        i === dataIndex
          ? {
              ...item,
              horarios: [...item.horarios, ''],
            }
          : item
      )
    )
  }

  function removerHorario(
    dataIndex: number,
    horarioIndex: number
  ) {
    setPreferenciasRemarcacao(prev =>
      prev.map((item, i) => {
        if (i !== dataIndex) return item

        const horarios = item.horarios.filter(
          (_, hi) => hi !== horarioIndex
        )

        return {
          ...item,
          horarios: horarios.length > 0 ? horarios : [''],
        }
      })
    )
  }

  function adicionarDataRemarcacao() {
    setPreferenciasRemarcacao(prev => [
      ...prev,
      {
        data: '',
        horarios: [''],
      },
    ])
  }

  function removerDataRemarcacao(index: number) {
    if (preferenciasRemarcacao.length === 1) return

    setPreferenciasRemarcacao(prev =>
      prev.filter((_, i) => i !== index)
    )
  }

  async function enviarRemarcacao() {
    if (
      !agendamentoRemarcando ||
      !cliente ||
      !salao ||
      enviandoRemarcacao
    ) {
      return
    }

    const preferenciasValidas = preferenciasRemarcacao
      .map(item => ({
        data: item.data,
        horarios: item.horarios.filter(Boolean),
      }))
      .filter(item => item.data && item.horarios.length > 0)

    if (preferenciasValidas.length === 0) {
      alert('Escolha pelo menos uma data e um horário.')
      return
    }

    setEnviandoRemarcacao(true)

    const primeiroDia = preferenciasValidas[0].data

    const horariosParaSalvar = preferenciasValidas.map(item => ({
      data: item.data,
      horarios: item.horarios,
    }))

    // Mantemos o campo observacoes para compatibilidade
    // com o fluxo atual de solicitações.
    const observacaoCompleta = [
      observacaoRemarcacao?.trim()
        ? observacaoRemarcacao.trim()
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    const { error: erroSolicitacao } = await supabase
      .from('solicitacoes_agendamento')
      .insert({
        salao_id: salao.id,
        cliente_id: cliente.id,
        servico_id:
          agendamentoRemarcando.servico_id ||
          agendamentoRemarcando.servicos_ids?.[0] ||
          null,
        profissional_id:
          agendamentoRemarcando.profissional_id || null,
        status: 'pendente',
        tipo: 'remarcacao',
        agendamento_id: agendamentoRemarcando.id,
        data_preferida: primeiroDia || null,
        periodo_preferido:
          periodoRemarcacao !== 'qualquer'
            ? periodoRemarcacao
            : null,
        horarios_sugeridos: horariosParaSalvar,
        observacoes: observacaoCompleta || null,
      })

    if (erroSolicitacao) {
      console.error(
        'Erro ao criar solicitação de remarcação:',
        erroSolicitacao
      )

      setEnviandoRemarcacao(false)
      alert('Não foi possível enviar a solicitação. Tente novamente.')
      return
    }

    // Registra que o cliente pediu remarcação,
    // sem alterar o status original do agendamento.
    const { error: erroResposta } = await supabase
      .from('agendamentos')
      .update({
        resposta_cliente: 'quero_remarcar',
        resposta_cliente_em: new Date().toISOString(),
      })
      .eq('id', agendamentoRemarcando.id)
      .eq('cliente_id', cliente.id)

    if (erroResposta) {
      console.error(
        'Solicitação criada, mas não foi possível registrar resposta:',
        erroResposta
      )
    }

    const nomeCliente = cliente.nome || 'O cliente'

    const resumoDatas = preferenciasValidas
      .map(item => {
        const dataFormatada = new Date(
          `${item.data}T12:00:00`
        ).toLocaleDateString('pt-BR')

        return `${dataFormatada}: ${item.horarios.join(', ')}`
      })
      .join(' | ')

    await notificar({
      salaoId: salao.id,
      remetenteId: profile!.id,
      destinatarioId: salao.dono_id,
      titulo: 'Cliente pediu para remarcar',
      mensagem: `${nomeCliente} pediu para remarcar o agendamento de ${formatarDataHora(agendamentoRemarcando.data_hora)}. Preferências: ${resumoDatas}`,
      tipo: 'remarcacao',
      url: '/salao/notificacoes',
    })

    setEnviandoRemarcacao(false)
    setRemarcacaoEnviada(true)

    await carregarDados()
  }

  function formatarDataHora(dataHora: string) {
    const data = new Date(dataHora)

    return `${data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} às ${data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }

  function obterStatusResposta(ag: any) {
    if (ag.resposta_cliente === 'vou_comparecer') {
      return {
        tipo: 'confirmado',
        titulo: 'Você confirmou presença',
        descricao: 'O salão foi avisado.',
      }
    }

    if (ag.resposta_cliente === 'nao_vou_comparecer') {
      return {
        tipo: 'nao_comparecera',
        titulo: 'Você informou que não poderá comparecer',
        descricao: 'O salão foi avisado.',
      }
    }

    if (ag.resposta_cliente === 'quero_remarcar') {
      return {
        tipo: 'remarcacao',
        titulo: 'Solicitação de remarcação enviada',
        descricao: 'O salão analisará suas preferências.',
      }
    }

    return null
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  const agora = new Date()

  const proximos = agendamentos.filter(
    a =>
      new Date(a.data_hora) >= agora &&
      a.status !== 'cancelado'
  )

  const historico = agendamentos.filter(
    a =>
      new Date(a.data_hora) < agora ||
      a.status === 'concluido' ||
      a.status === 'cancelado'
  )

  const lista =
    filtro === 'proximos'
      ? proximos
      : historico

  const statusCor: Record<string, string> = {
    confirmado: 'bg-green-50 text-green-600',
    pendente: 'bg-yellow-50 text-yellow-600',
    concluido: 'bg-gray-100 text-gray-500',
    cancelado: 'bg-red-50 text-red-400',
    aguardando_confirmacao: 'bg-blue-50 text-blue-600',
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: cor }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28 relative">

      {/* =====================================================
          CABEÇALHO
      ====================================================== */}

      <div
        className="px-4 pt-12 pb-6 flex items-center justify-between"
        style={{ backgroundColor: cor }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-white" />
          </button>

          <h1 className="font-bold text-white text-lg">
            Meus Agendamentos
          </h1>
        </div>
      </div>

      {/* =====================================================
          FILTROS
      ====================================================== */}

      <div className="flex bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        {(['proximos', 'historico'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={
              'flex-1 py-3 text-sm font-medium transition-all ' +
              (filtro === f
                ? 'border-b-2'
                : 'text-gray-400')
            }
            style={
              filtro === f
                ? {
                    color: cor,
                    borderColor: cor,
                  }
                : {}
            }
          >
            {f === 'proximos'
              ? 'Próximos'
              : 'Histórico'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {/* =====================================================
            NOVO AGENDAMENTO
        ====================================================== */}

        <div
          onClick={() => setModalAgendar(true)}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer transition-transform active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: `${cor}15`,
              }}
            >
              <Calendar
                size={20}
                style={{ color: cor }}
              />
            </div>

            <div>
              <p className="font-bold text-gray-900 text-sm">
                Agendar novo horário
              </p>

              <p className="text-xs text-gray-400">
                Escolha serviços, data e período preferido
              </p>
            </div>
          </div>

          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: cor }}
          >
            <Plus size={16} />
          </div>
        </div>

        {/* =====================================================
            LISTA DE AGENDAMENTOS
        ====================================================== */}

        {lista.length === 0 ? (
          <div className="card text-center py-10 mt-2">
            <Calendar
              size={36}
              className="text-gray-300 mx-auto mb-2"
            />

            <p className="text-gray-400">
              {filtro === 'proximos'
                ? 'Nenhum agendamento futuro'
                : 'Nenhum histórico'}
            </p>
          </div>
        ) : (
          lista.map(ag => {
            const resposta = obterStatusResposta(ag)

            const podeResponder =
              filtro === 'proximos' &&
              new Date(ag.data_hora) >= agora &&
              ag.status !== 'cancelado' &&
              ag.status !== 'concluido'

            const expandido =
              agendamentoExpandido === ag.id

            return (
              <div
                key={ag.id}
                className="card flex flex-col gap-3"
              >
                {/* =================================================
                    INFORMAÇÕES DO AGENDAMENTO
                ================================================== */}

                <div className="flex items-start justify-between">
                  <div className="min-w-0 pr-2">

                    <div className="flex flex-col gap-0.5">
                      {ag.servicosLista?.length > 0 ? (
                        ag.servicosLista.map(
                          (s: any, index: number) => (
                            <p
                              key={index}
                              className="font-bold text-gray-900"
                            >
                              • {s.nome}
                            </p>
                          )
                        )
                      ) : (
                        <p className="font-bold text-gray-900">
                          Serviço não especificado
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <Clock
                        size={13}
                        className="text-gray-400"
                      />

                      <p className="text-sm text-gray-500">
                        {new Date(
                          ag.data_hora
                        ).toLocaleDateString(
                          'pt-BR',
                          {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          }
                        )}{' '}
                        às{' '}
                        {new Date(
                          ag.data_hora
                        ).toLocaleTimeString(
                          'pt-BR',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </p>
                    </div>

                    {ag.profiles?.nome && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Prof: {ag.profiles.nome}
                      </p>
                    )}
                  </div>

                  <span
                    className={
                      'text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ' +
                      (statusCor[ag.status] ||
                        statusCor.pendente)
                    }
                  >
                    {ag.status?.toUpperCase()}
                  </span>
                </div>

                {ag.valor && (
                  <p
                    className="text-sm font-bold mt-1"
                    style={{ color: cor }}
                  >
                    R${' '}
                    {ag.valor
                      .toFixed(2)
                      .replace('.', ',')}
                  </p>
                )}

                {/* =================================================
                    RESPOSTA JÁ REGISTRADA
                ================================================== */}

                {resposta && (
                  <div
                    className="rounded-xl p-3 border"
                    style={{
                      backgroundColor:
                        resposta.tipo ===
                        'confirmado'
                          ? '#f0fdf4'
                          : resposta.tipo ===
                            'nao_comparecera'
                            ? '#fef2f2'
                            : '#eff6ff',
                      borderColor:
                        resposta.tipo ===
                        'confirmado'
                          ? '#bbf7d0'
                          : resposta.tipo ===
                            'nao_comparecera'
                            ? '#fecaca'
                            : '#bfdbfe',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {resposta.tipo ===
                      'confirmado' ? (
                        <CheckCircle
                          size={18}
                          className="text-green-600 mt-0.5 shrink-0"
                        />
                      ) : resposta.tipo ===
                        'nao_comparecera' ? (
                        <XCircle
                          size={18}
                          className="text-red-500 mt-0.5 shrink-0"
                        />
                      ) : (
                        <RefreshCw
                          size={18}
                          className="text-blue-600 mt-0.5 shrink-0"
                        />
                      )}

                      <div>
                        <p className="font-semibold text-sm text-gray-800">
                          {resposta.titulo}
                        </p>

                        <p className="text-xs text-gray-500 mt-0.5">
                          {resposta.descricao}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* =================================================
                    AÇÕES DO CLIENTE
                ================================================== */}

                {podeResponder && !resposta && (
                  <div className="border-t border-gray-100 pt-3">

                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      Você vai comparecer?
                    </p>

                    <div className="grid grid-cols-3 gap-2">

                      <button
                        onClick={() =>
                          responderAgendamento(
                            ag,
                            'vou_comparecer'
                          )
                        }
                        disabled={
                          respondendoAgendamento ===
                          ag.id
                        }
                        className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold border transition-all active:scale-95 disabled:opacity-50"
                        style={{
                          color: cor,
                          borderColor: `${cor}55`,
                          backgroundColor: `${cor}08`,
                        }}
                      >
                        {respondendoAgendamento ===
                        ag.id ? (
                          <div
                            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                            style={{
                              borderColor: cor,
                            }}
                          />
                        ) : (
                          <CheckCircle size={18} />
                        )}

                        <span>
                          Vou comparecer
                        </span>
                      </button>

                      <button
                        onClick={() =>
                          abrirModalRemarcar(ag)
                        }
                        disabled={
                          respondendoAgendamento ===
                          ag.id
                        }
                        className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold border border-blue-100 bg-blue-50 text-blue-600 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <RefreshCw size={18} />

                        <span>
                          Quero remarcar
                        </span>
                      </button>

                      <button
                        onClick={() =>
                          responderAgendamento(
                            ag,
                            'nao_vou_comparecer'
                          )
                        }
                        disabled={
                          respondendoAgendamento ===
                          ag.id
                        }
                        className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold border border-red-100 bg-red-50 text-red-500 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <XCircle size={18} />

                        <span>
                          Não vou
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* =================================================
                    DETALHES / OBSERVAÇÃO DE RESPOSTA
                ================================================== */}

                {ag.resposta_cliente_em && (
                  <button
                    onClick={() =>
                      setAgendamentoExpandido(
                        expandido ? null : ag.id
                      )
                    }
                    className="flex items-center justify-between text-xs text-gray-400 pt-1"
                  >
                    <span>
                      Resposta registrada em{' '}
                      {new Date(
                        ag.resposta_cliente_em
                      ).toLocaleDateString(
                        'pt-BR'
                      )}{' '}
                      às{' '}
                      {new Date(
                        ag.resposta_cliente_em
                      ).toLocaleTimeString(
                        'pt-BR',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </span>

                    {expandido ? (
                      <ChevronUp size={15} />
                    ) : (
                      <ChevronDown size={15} />
                    )}
                  </button>
                )}

                {expandido && (
                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
                    Sua resposta foi registrada e enviada ao salão.
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* =========================================================
          BOTÃO FLUTUANTE
      ========================================================== */}

      <div className="fixed bottom-6 right-6 z-20">
        <button
          onClick={() => setModalAgendar(true)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full text-white font-bold text-sm shadow-xl transition-transform active:scale-95"
          style={{ backgroundColor: cor }}
        >
          <Plus size={18} />
          Agendar Horário
        </button>
      </div>

      {/* =========================================================
          MODAL DE NOVO AGENDAMENTO
      ========================================================== */}

      {modalAgendar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg">
                Novo Agendamento
              </h3>

              <button
                onClick={() => setModalAgendar(false)}
              >
                <X
                  size={22}
                  className="text-gray-400"
                />
              </button>
            </div>

            {enviado ? (
              <div className="flex flex-col items-center gap-3 py-8">

                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: cor,
                  }}
                >
                  <CheckCircle
                    size={32}
                    className="text-white"
                  />
                </div>

                <p className="font-bold text-gray-900 text-lg text-center">
                  Pedido enviado!
                </p>

                <p className="text-gray-500 text-sm text-center">
                  Aguarde o salão entrar em contato
                  com os horários disponíveis.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">

                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase">
                      1. Selecione os serviços
                    </p>
                  </div>

                  {categorias.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">

                      <button
                        onClick={() =>
                          setCategoriaSelecionada(
                            'todos'
                          )
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                          categoriaSelecionada ===
                          'todos'
                            ? 'text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        style={
                          categoriaSelecionada ===
                          'todos'
                            ? {
                                backgroundColor: cor,
                              }
                            : {}
                        }
                      >
                        Todos
                      </button>

                      {categorias.map(cat => (
                        <button
                          key={cat}
                          onClick={() =>
                            setCategoriaSelecionada(
                              cat
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                            categoriaSelecionada ===
                            cat
                              ? 'text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                          style={
                            categoriaSelecionada ===
                            cat
                              ? {
                                  backgroundColor:
                                    cor,
                                }
                              : {}
                          }
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 mt-1">

                    {servicosFiltrados.length === 0 ? (
                      <p className="text-xs text-gray-400 py-3 text-center">
                        Nenhum serviço encontrado
                        nesta categoria.
                      </p>
                    ) : (
                      servicosFiltrados.map(s => {
                        const qtd =
                          qtdCarrinho(s.id)

                        return (
                          <div
                            key={s.id}
                            className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100"
                          >
                            <div className="flex-1 min-w-0 pr-2">

                              <p className="font-semibold text-gray-900 text-sm truncate">
                                {s.nome}
                              </p>

                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className="text-xs font-bold"
                                  style={{
                                    color: cor,
                                  }}
                                >
                                  R${' '}
                                  {Number(
                                    s.preco
                                  )
                                    .toFixed(2)
                                    .replace(
                                      '.',
                                      ','
                                    )}
                                </span>

                                <span className="text-xs text-gray-400">
                                  •{' '}
                                  {formatarDuracao(
                                    s.duracao_minutos
                                  )}
                                </span>
                              </div>
                            </div>

                            {qtd === 0 ? (
                              <button
                                onClick={() =>
                                  adicionarAoCarrinho(
                                    s
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold shrink-0"
                                style={{
                                  backgroundColor:
                                    cor,
                                }}
                              >
                                Adicionar
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">

                                <button
                                  onClick={() =>
                                    removerDoCarrinho(
                                      s.id
                                    )
                                  }
                                  className="w-6 h-6 rounded-full border flex items-center justify-center"
                                  style={{
                                    borderColor:
                                      cor,
                                  }}
                                >
                                  <Minus
                                    size={12}
                                    style={{
                                      color: cor,
                                    }}
                                  />
                                </button>

                                <span className="font-bold text-gray-900 text-sm w-4 text-center">
                                  {qtd}
                                </span>

                                <button
                                  onClick={() =>
                                    adicionarAoCarrinho(
                                      s
                                    )
                                  }
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                                  style={{
                                    backgroundColor:
                                      cor,
                                  }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {carrinho.length > 0 && (
                  <>
                    <div className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1.5 border border-gray-100">

                      <div className="flex justify-between text-xs text-gray-500">
                        <span>
                          Serviços selecionados:{' '}
                          {totalItens}
                        </span>

                        <span>
                          Tempo:{' '}
                          {formatarDuracao(
                            duracaoTotal
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-gray-200/50">

                        <span className="font-bold text-gray-900 text-sm">
                          Total estimado
                        </span>

                        <span
                          className="font-bold text-base"
                          style={{ color: cor }}
                        >
                          R${' '}
                          {totalCarrinho
                            .toFixed(2)
                            .replace('.', ',')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">

                      <p className="text-xs font-semibold text-gray-400 uppercase">
                        2. Dia preferido e Período
                      </p>

                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Data preferida (opcional)
                        </label>

                        <input
                          type="date"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none"
                          style={{
                            borderColor: `${cor}66`,
                          }}
                          value={dataPreferida}
                          onChange={e =>
                            setDataPreferida(
                              e.target.value
                            )
                          }
                          min={
                            new Date()
                              .toISOString()
                              .slice(0, 10)
                          }
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Período preferido
                        </label>

                        <div className="flex gap-2">

                          {[
                            {
                              valor: 'qualquer',
                              label: 'Indiferente',
                            },
                            {
                              valor: 'manha',
                              label: 'Manhã',
                            },
                            {
                              valor: 'tarde',
                              label: 'Tarde',
                            },
                            {
                              valor: 'noite',
                              label: 'Noite',
                            },
                          ].map(p => (
                            <button
                              key={p.valor}
                              type="button"
                              onClick={() =>
                                setPeriodoPreferido(
                                  p.valor
                                )
                              }
                              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all border"
                              style={
                                periodoPreferido ===
                                p.valor
                                  ? {
                                      backgroundColor:
                                        cor,
                                      color: 'white',
                                      borderColor:
                                        cor,
                                    }
                                  : {
                                      backgroundColor:
                                        '#f3f4f6',
                                      color:
                                        '#6b7280',
                                      borderColor:
                                        'transparent',
                                    }
                              }
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <button
                  onClick={enviarCarrinho}
                  disabled={
                    enviando ||
                    carrinho.length === 0
                  }
                  className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                  style={{
                    backgroundColor: cor,
                  }}
                >
                  {enviando ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Enviar pedido de agendamento'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL DE REMARCAÇÃO
      ========================================================== */}

      {modalRemarcar && agendamentoRemarcando && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">

          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b pb-3">

              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  Remarcar agendamento
                </h3>

                <p className="text-xs text-gray-400 mt-1">
                  Agendamento atual:{' '}
                  {formatarDataHora(
                    agendamentoRemarcando.data_hora
                  )}
                </p>
              </div>

              <button
                onClick={fecharModalRemarcar}
                disabled={enviandoRemarcacao}
              >
                <X
                  size={22}
                  className="text-gray-400"
                />
              </button>
            </div>

            {remarcacaoEnviada ? (
              <div className="flex flex-col items-center gap-3 py-10">

                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: cor,
                  }}
                >
                  <CheckCircle
                    size={32}
                    className="text-white"
                  />
                </div>

                <p className="font-bold text-gray-900 text-lg text-center">
                  Solicitação enviada!
                </p>

                <p className="text-gray-500 text-sm text-center">
                  O salão recebeu suas preferências
                  e poderá analisar um novo horário.
                </p>

                <button
                  onClick={fecharModalRemarcar}
                  className="w-full py-3 rounded-2xl text-white font-bold mt-3"
                  style={{
                    backgroundColor: cor,
                  }}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">
                    Quando você gostaria de remarcar?
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    Você pode indicar mais de uma data
                    e vários horários para cada uma.
                  </p>
                </div>

                {/* DATAS */}
                <div className="flex flex-col gap-3">

                  {preferenciasRemarcacao.map(
                    (item, dataIndex) => (
                      <div
                        key={dataIndex}
                        className="bg-gray-50 rounded-2xl p-4 border border-gray-100"
                      >

                        <div className="flex items-center justify-between mb-3">

                          <p className="text-sm font-bold text-gray-800">
                            Data{' '}
                            {dataIndex + 1}
                          </p>

                          {preferenciasRemarcacao.length >
                            1 && (
                            <button
                              type="button"
                              onClick={() =>
                                removerDataRemarcacao(
                                  dataIndex
                                )
                              }
                              className="text-xs text-red-500 font-medium"
                            >
                              Remover
                            </button>
                          )}
                        </div>

                        <label className="text-xs text-gray-500 block mb-1">
                          Data
                        </label>

                        <input
                          type="date"
                          value={item.data}
                          min={new Date()
                            .toISOString()
                            .slice(0, 10)}
                          onChange={e =>
                            alterarDataRemarcacao(
                              dataIndex,
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none"
                          style={{
                            borderColor: `${cor}55`,
                          }}
                        />

                        <div className="mt-3">

                          <label className="text-xs text-gray-500 block mb-1">
                            Horários de preferência
                          </label>

                          <div className="flex flex-col gap-2">

                            {item.horarios.map(
                              (
                                horario,
                                horarioIndex
                              ) => (
                                <div
                                  key={
                                    horarioIndex
                                  }
                                  className="flex items-center gap-2"
                                >

                                  <input
                                    type="time"
                                    value={
                                      horario
                                    }
                                    onChange={e =>
                                      alterarHorarioRemarcacao(
                                        dataIndex,
                                        horarioIndex,
                                        e.target
                                          .value
                                      )
                                    }
                                    className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none"
                                    style={{
                                      borderColor: `${cor}55`,
                                    }}
                                  />

                                  {item.horarios
                                    .length >
                                    1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removerHorario(
                                          dataIndex,
                                          horarioIndex
                                        )
                                      }
                                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-400"
                                    >
                                      <X
                                        size={
                                          15
                                        }
                                      />
                                    </button>
                                  )}
                                </div>
                              )
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              adicionarHorario(
                                dataIndex
                              )
                            }
                            className="mt-2 text-xs font-semibold"
                            style={{
                              color: cor,
                            }}
                          >
                            + Adicionar outro horário
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={adicionarDataRemarcacao}
                  className="w-full py-3 rounded-xl border text-sm font-semibold"
                  style={{
                    borderColor: `${cor}55`,
                    color: cor,
                  }}
                >
                  + Adicionar outra data
                </button>

                {/* PERÍODO */}
                <div className="flex flex-col gap-2">

                  <p className="text-xs font-semibold text-gray-400 uppercase">
                    Período de preferência
                  </p>

                  <div className="grid grid-cols-4 gap-1.5">

                    {[
                      {
                        valor: 'qualquer',
                        label: 'Qualquer',
                      },
                      {
                        valor: 'manha',
                        label: 'Manhã',
                      },
                      {
                        valor: 'tarde',
                        label: 'Tarde',
                      },
                      {
                        valor: 'noite',
                        label: 'Noite',
                      },
                    ].map(p => (
                      <button
                        key={p.valor}
                        type="button"
                        onClick={() =>
                          setPeriodoRemarcacao(
                            p.valor
                          )
                        }
                        className="py-2.5 rounded-xl text-xs font-medium border transition-all"
                        style={
                          periodoRemarcacao ===
                          p.valor
                            ? {
                                backgroundColor:
                                  cor,
                                color: 'white',
                                borderColor:
                                  cor,
                              }
                            : {
                                backgroundColor:
                                  '#f3f4f6',
                                color:
                                  '#6b7280',
                                borderColor:
                                  'transparent',
                              }
                        }
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* OBSERVAÇÃO */}
                <div>

                  <label className="text-xs text-gray-500 block mb-1">
                    Observação (opcional)
                  </label>

                  <textarea
                    value={observacaoRemarcacao}
                    onChange={e =>
                      setObservacaoRemarcacao(
                        e.target.value
                      )
                    }
                    placeholder="Alguma preferência ou informação para o salão?"
                    rows={3}
                    className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none"
                    style={{
                      borderColor: `${cor}55`,
                    }}
                  />
                </div>

                {/* ENVIAR */}
                <button
                  type="button"
                  onClick={enviarRemarcacao}
                  disabled={enviandoRemarcacao}
                  className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{
                    backgroundColor: cor,
                  }}
                >
                  {enviandoRemarcacao ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} />
                      Enviar pedido de remarcação
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}