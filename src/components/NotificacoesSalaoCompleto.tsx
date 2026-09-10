// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import {
  ArrowLeft,
  Bell,
  Calendar,
  Check,
  X,
  Clock,
  Trash2,
  RotateCcw,
  MessageCircle
} from 'lucide-react'

type PacoteOpcao = {
  clientePacoteId: string
  nome: string
  sessoesRestantes: number
}

type CoberturaServico = {
  servicoId: string
  servicoNome: string
  sessoesEquivalentes: number
  clientePacoteIdSelecionado: string | null
  pacotesDisponiveis: PacoteOpcao[]
}

export default function NotificacoesDonoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)

  const [aba, setAba] = useState<
    'pedidos' | 'confirmacoes' | 'notificacoes' | 'excluidas'
  >('pedidos')

  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [confirmacoes, setConfirmacoes] = useState<any[]>([])
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [notificacoesExcluidas, setNotificacoesExcluidas] =
    useState<any[]>([])

  const [modalSugestao, setModalSugestao] = useState<any>(null)
  const [modalConfirmar, setModalConfirmar] = useState<any>(null)

  const [horariosLivres, setHorariosLivres] = useState([
    '',
    '',
    ''
  ])

  const [servicoRealizado, setServicoRealizado] =
    useState('')

  const [salvando, setSalvando] =
    useState(false)

  const [coberturas, setCoberturas] =
    useState<CoberturaServico[]>([])

  const [carregandoCoberturas, setCarregandoCoberturas] =
    useState(false)

  // ─── CONTROLE DO PACOTE NA CONFIRMAÇÃO ────────────────────────────────

  const [
    sessaoJaRegistradaNoPacote,
    setSessaoJaRegistradaNoPacote
  ] = useState(false)

  const [
    possuiPacoteDisponivel,
    setPossuiPacoteDisponivel
  ] = useState(false)

  const [
    opcaoConfirmacaoPacote,
    setOpcaoConfirmacaoPacote
  ] = useState<
    'perguntar' | 'dar_baixa' | 'apenas_confirmar'
  >('perguntar')

  const [
    verificandoPacoteConfirmacao,
    setVerificandoPacoteConfirmacao
  ] = useState(false)

  // ─── INICIALIZAÇÃO ────────────────────────────────────────────────────

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    if (profile.salao_id) {
      carregarDados()
      registrarPushNotification()
    }
  }, [loading, profile])

  // ─── PUSH ─────────────────────────────────────────────────────────────

  async function registrarPushNotification() {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (!('PushManager' in window)) return
    if (!profile?.id || !profile?.salao_id) return

    try {
      const registration =
        await navigator.serviceWorker.ready

      const vapidKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidKey) {
        console.error(
          'NEXT_PUBLIC_VAPID_PUBLIC_KEY não está definida.'
        )
        return
      }

      let subscription =
        await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey
          })
      }

      const subscriptionJson =
        subscription.toJSON()

      if (
        !subscriptionJson.endpoint ||
        !subscriptionJson.keys?.p256dh ||
        !subscriptionJson.keys?.auth
      ) {
        return
      }

      const dadosSubscription = {
        profile_id: profile.id,
        user_id: profile.id,
        salao_id: profile.salao_id,
        subscription: subscriptionJson,
        updated_at:
          new Date().toISOString()
      }

      const {
        error: upsertError
      } = await supabase
        .from('push_subscriptions')
        .upsert(
          dadosSubscription,
          {
            onConflict: 'user_id'
          }
        )

      if (!upsertError) return

      const {
        data: existente
      } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq(
          'profile_id',
          profile.id
        )
        .maybeSingle()

      if (existente?.id) {
        await supabase
          .from('push_subscriptions')
          .update(
            dadosSubscription
          )
          .eq(
            'id',
            existente.id
          )
      } else {
        await supabase
          .from('push_subscriptions')
          .insert(
            dadosSubscription
          )
      }
    } catch (err) {
      console.error(
        'Erro ao registrar push:',
        err
      )
    }
  }

  // ─── CARREGAR DADOS ──────────────────────────────────────────────────

  async function carregarDados() {
    if (!profile?.salao_id) return

    const {
      data: sal
    } = await supabase
      .from('saloes')
      .select('*')
      .eq(
        'id',
        profile.salao_id
      )
      .single()

    setSalao(sal)

    const {
      data: sols
    } = await supabase
      .from(
        'solicitacoes_agendamento'
      )
      .select(
        '*, clientes(id, nome, email, telefone), servicos(nome, duracao_minutos)'
      )
      .eq(
        'salao_id',
        profile.salao_id
      )
      .in(
        'status',
        [
          'pendente',
          'horario_sugerido'
        ]
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      )

    setSolicitacoes(
      sols || []
    )

    // IMPORTANTE:
    // NÃO existe filtro de data aqui.
    //
    // O atendimento permanece na aba Confirmar enquanto:
    // - pertence ao salão;
    // - está confirmado;
    // - não possui confirmação de atendimento.
    //
    // Assim, um atendimento de ontem, semana passada ou mês passado
    // continua aparecendo até ser tratado.

    const {
      data: ags
    } = await supabase
      .from('agendamentos')
      .select(
        '*, clientes(id, nome, telefone), servicos(nome, id), confirmacoes_atendimento(*)'
      )
      .eq(
        'salao_id',
        profile.salao_id
      )
      .eq(
        'status',
        'confirmado'
      )
      .order(
        'data_hora',
        {
          ascending: true
        }
      )

    setConfirmacoes(
      (ags || []).filter(
        (a: any) =>
          !a.confirmacoes_atendimento
            ?.length
      )
    )

    const {
      data: notifs
    } = await supabase
      .from('notificacoes')
      .select('*')
      .eq(
        'salao_id',
        profile.salao_id
      )
      .eq(
        'destinatario_id',
        profile.id
      )
      .eq(
        'excluida',
        false
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      )

    setNotificacoes(
      notifs || []
    )

    const {
      data: excluidas
    } = await supabase
      .from('notificacoes')
      .select('*')
      .eq(
        'salao_id',
        profile.salao_id
      )
      .eq(
        'destinatario_id',
        profile.id
      )
      .eq(
        'excluida',
        true
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      )
      .limit(30)

    setNotificacoesExcluidas(
      excluidas || []
    )
  }

  // ─── FORMATADORES DE SOLICITAÇÃO ─────────────────────────────────────

  function formatarDataPreferida(
    solicitacao: any
  ) {
    const data =
      solicitacao?.data_preferida ??
      solicitacao?.data_desejada ??
      solicitacao?.data_solicitada ??
      solicitacao?.data

    if (!data) return null

    const dataString =
      String(data)

    let dataFormatada: Date

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        dataString
      )
    ) {
      const [
        ano,
        mes,
        dia
      ] =
        dataString
          .split('-')
          .map(Number)

      dataFormatada =
        new Date(
          ano,
          mes - 1,
          dia
        )
    } else {
      dataFormatada =
        new Date(
          dataString
        )
    }

    if (
      Number.isNaN(
        dataFormatada.getTime()
      )
    ) {
      return null
    }

    return dataFormatada.toLocaleDateString(
      'pt-BR',
      {
        weekday:
          'long',
        day:
          '2-digit',
        month:
          'long',
        year:
          'numeric'
      }
    )
  }

  function formatarPeriodoPreferido(
    solicitacao: any
  ) {
    const periodo =
      solicitacao?.periodo_preferido ??
      solicitacao?.periodo_desejado ??
      solicitacao?.periodo ??
      solicitacao?.turno

    if (!periodo) return null

    const valor =
      String(periodo).trim()

    const mapa: Record<
      string,
      string
    > = {
      manha:
        'Manhã',
      manhã:
        'Manhã',
      tarde:
        'Tarde',
      noite:
        'Noite',
      qualquer:
        'Qualquer horário',
      qualquer_horario:
        'Qualquer horário',
      qualquer_horário:
        'Qualquer horário',
      indiferente:
        'Qualquer horário'
    }

    const normalizado =
      valor
        .toLowerCase()
        .replace(
          /\s+/g,
          '_'
        )

    return (
      mapa[
        normalizado
      ] ||
      valor.charAt(0).toUpperCase() +
        valor.slice(1)
    )
  }

  // ─── NOTIFICAÇÕES ────────────────────────────────────────────────────

  async function handleClicarNotificacao(
    n: any
  ) {
    if (!n.lida) {
      await supabase
        .from(
          'notificacoes'
        )
        .update({
          lida: true
        })
        .eq(
          'id',
          n.id
        )

      setNotificacoes(
        prev =>
          prev.map(
            item =>
              item.id === n.id
                ? {
                    ...item,
                    lida: true
                  }
                : item
          )
      )
    }

    if (n.url) {
      router.push(
        n.url
      )
    }
  }

  // ─── PACOTES ─────────────────────────────────────────────────────────

  async function buscarTodosPacotesCliente(
    clienteNome: string
  ) {
    if (!clienteNome)
      return []

    const {
      data,
      error
    } = await supabase
      .from(
        'pacotes_clientes_resumo'
      )
      .select(
        'id, cliente_nome, servico, sessoes_total, sessoes_restantes, data_sessao, created_at, status, historico_sessoes'
      )
      .eq(
        'cliente_nome',
        clienteNome
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      )

    if (error) {
      console.error(
        'Erro ao buscar todos os pacotes:',
        error
      )

      return []
    }

    return data || []
  }

  async function buscarPacotesCliente(
    clienteNome: string
  ) {
    if (!clienteNome)
      return []

    const {
      data,
      error
    } = await supabase
      .from(
        'pacotes_clientes_resumo'
      )
      .select(
        'id, cliente_nome, servico, sessoes_total, sessoes_restantes, data_sessao, created_at, status, historico_sessoes'
      )
      .eq(
        'cliente_nome',
        clienteNome
      )
      .eq(
        'status',
        'ativo'
      )
      .gt(
        'sessoes_restantes',
        0
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      )

    if (error) {
      console.error(
        'Erro ao buscar pacotes:',
        error
      )

      return []
    }

    return data || []
  }

  // Verifica se esta sessão já foi lançada anteriormente no pacote.
  //
  // Primeiro usa o identificador mais seguro:
  // historico_sessoes[].agendamento_id === agendamento.id
  //
  // Depois existe uma segunda proteção para o caso de uma sessão ter sido
  // lançada manualmente antes desta funcionalidade existir:
  // procura uma única sessão do mesmo serviço na mesma data.

  async function verificarSessaoJaRegistrada(
    agendamento: any
  ) {
    const clienteNome =
      agendamento.clientes?.nome ||
      agendamento.cliente_nome ||
      ''

    if (!clienteNome) {
      return {
        registrada: false,
        possuiPacote: false
      }
    }

    const pacotes =
      await buscarTodosPacotesCliente(
        clienteNome
      )

    const possuiPacote =
      pacotes.some(
        (pacote: any) =>
          pacote.status ===
            'ativo' &&
          Number(
            pacote.sessoes_restantes ||
              0
          ) > 0
      )

    // Primeiro usa o identificador mais seguro:
    // historico_sessoes[].agendamento_id === agendamento.id

    for (const pacote of pacotes) {
      const historico =
        Array.isArray(
          pacote.historico_sessoes
        )
          ? pacote.historico_sessoes
          : []

      const encontrada =
        historico.some(
          (registro: any) =>
            registro?.agendamento_id &&
            String(
              registro.agendamento_id
            ) ===
              String(
                agendamento.id
              ) &&
            registro?.tipo !==
              'nao_comparecimento' &&
            registro?.tipo !==
              'nao_compareceu'
        )

      if (encontrada) {
        return {
          registrada: true,
          possuiPacote
        }
      }
    }

    // Proteção adicional para sessões lançadas manualmente
    // sem agendamento_id. Só considera automaticamente registrada
    // quando existe UMA única correspondência em todo o histórico.

    const servicoNome =
      agendamento.servicos?.nome ||
      agendamento.servico_nome ||
      ''

    const dataAgendamento =
      agendamento.data_hora
        ? String(
            agendamento.data_hora
          ).slice(0, 10)
        : null

    const normalizarTexto =
      (valor: any) =>
        String(valor || '')
          .trim()
          .toLowerCase()
          .normalize(
            'NFD'
          )
          .replace(
            /[\u0300-\u036f]/g,
            ''
          )

    if (
      servicoNome &&
      dataAgendamento
    ) {
      const possiveis: any[] =
        []

      for (const pacote of pacotes) {
        const historico =
          Array.isArray(
            pacote.historico_sessoes
          )
            ? pacote.historico_sessoes
            : []

        for (
          const registro of historico
        ) {
          if (
            registro?.agendamento_id
          ) {
            continue
          }

          if (
            registro?.tipo ===
              'nao_comparecimento' ||
            registro?.tipo ===
              'nao_compareceu'
          ) {
            continue
          }

          const dataRegistro =
            registro?.data ||
            registro?.data_sessao ||
            registro?.data_registro ||
            null

          const dataRegistroChave =
            dataRegistro
              ? String(
                  dataRegistro
                ).slice(0, 10)
              : null

          const nomeRegistro =
            registro?.servico ||
            registro?.servico_nome ||
            ''

          if (
            dataRegistroChave ===
              dataAgendamento &&
            normalizarTexto(
              nomeRegistro
            ) ===
              normalizarTexto(
                servicoNome
              )
          ) {
            possiveis.push({
              pacote,
              registro
            })
          }
        }
      }

      if (
        possiveis.length === 1
      ) {
        return {
          registrada: true,
          possuiPacote
        }
      }
    }

    return {
      registrada: false,
      possuiPacote
    }
  }

  async function montarCoberturas(
    agendamento: any
  ): Promise<CoberturaServico[]> {
    const idsServicos: string[] =
      Array.isArray(
        agendamento.servicos_ids
      ) &&
      agendamento.servicos_ids
        .length > 0
        ? [
            ...agendamento.servicos_ids
          ]
        : agendamento.servico_id
          ? [
              agendamento.servico_id
            ]
          : []

    if (
      idsServicos.length ===
        0 &&
      agendamento.servicos?.id
    ) {
      idsServicos.push(
        agendamento.servicos.id
      )
    }

    const {
      data: servicosInfo
    } = await supabase
      .from('servicos')
      .select(
        'id, nome, sessoes_equivalentes'
      )
      .eq(
        'salao_id',
        profile!.salao_id!
      )

    const clienteNome =
      agendamento.clientes?.nome ||
      agendamento.cliente_nome ||
      ''

    if (!clienteNome)
      return []

    const pacotesData =
      await buscarPacotesCliente(
        clienteNome
      )

    const opcoesGerais:
      PacoteOpcao[] =
      pacotesData
        .map(
          (pacote: any) => ({
            clientePacoteId:
              pacote.id,
            nome:
              pacote.servico ||
              'Pacote',
            sessoesRestantes:
              Number(
                pacote.sessoes_restantes ||
                  0
              )
          })
        )
        .filter(
          pacote =>
            pacote.sessoesRestantes >
            0
        )

    if (
      idsServicos.length ===
      0
    ) {
      return [
        {
          servicoId:
            agendamento.servico_id ||
            'geral',

          servicoNome:
            agendamento.servicos
              ?.nome ||
            'Atendimento',

          sessoesEquivalentes: 1,

          clientePacoteIdSelecionado:
            opcoesGerais[0]
              ?.clientePacoteId ||
            null,

          pacotesDisponiveis:
            opcoesGerais
        }
      ]
    }

    return idsServicos.map(
      id => {
        const srv =
          (
            servicosInfo ||
            []
          ).find(
            (s: any) =>
              s.id === id
          )

        return {
          servicoId:
            id,

          servicoNome:
            srv?.nome ||
            'Serviço',

          sessoesEquivalentes:
            Number(
              srv?.sessoes_equivalentes ??
                1
            ),

          clientePacoteIdSelecionado:
            opcoesGerais[0]
              ?.clientePacoteId ||
            null,

          pacotesDisponiveis:
            opcoesGerais
        }
      }
    )
  }

  // ─── ABRIR CONFIRMAÇÃO ───────────────────────────────────────────────

  async function abrirModalConfirmar(
    agendamento: any
  ) {
    setVerificandoPacoteConfirmacao(
      true
    )

    setModalConfirmar(
      null
    )

    setSessaoJaRegistradaNoPacote(
      false
    )

    setPossuiPacoteDisponivel(
      false
    )

    setOpcaoConfirmacaoPacote(
      'perguntar'
    )

    setCoberturas([])

    setServicoRealizado(
      agendamento.servicos?.nome ||
        agendamento.servico_nome ||
        ''
    )

    try {
      const resultado =
        await verificarSessaoJaRegistrada(
          agendamento
        )

      setSessaoJaRegistradaNoPacote(
        resultado.registrada
      )

      setPossuiPacoteDisponivel(
        resultado.possuiPacote
      )

      if (
        resultado.registrada
      ) {
        setOpcaoConfirmacaoPacote(
          'apenas_confirmar'
        )
      } else if (
        resultado.possuiPacote
      ) {
        const dados =
          await montarCoberturas(
            agendamento
          )

        setCoberturas(
          dados
        )
      }
    } catch (error) {
      console.error(
        'Erro ao verificar pacote:',
        error
      )
    } finally {
      setVerificandoPacoteConfirmacao(
        false
      )

      setModalConfirmar(
        agendamento
      )
    }
  }

  // ─── VERIFICAÇÃO DUPLA DA CONFIRMAÇÃO ────────────────────────────────

  async function verificarConfirmacaoAtendimento(
    agendamentoId: string
  ) {
    if (!profile?.salao_id)
      return false

    const {
      data,
      error
    } = await supabase
      .from(
        'confirmacoes_atendimento'
      )
      .select('id')
      .eq(
        'agendamento_id',
        agendamentoId
      )
      .eq(
        'salao_id',
        profile.salao_id
      )
      .limit(1)

    if (error) {
      console.error(
        'Erro ao verificar confirmação:',
        error
      )

      return false
    }

    return !!data?.length
  }

  // ─── DAR BAIXA NO PACOTE ─────────────────────────────────────────────

  async function darBaixaPacoteAtendimento(
    agendamento: any
  ) {
    if (!profile?.salao_id)
      return

    const clienteNome =
      agendamento.clientes?.nome ||
      agendamento.cliente_nome ||
      ''

    if (!clienteNome) {
      throw new Error(
        'Não foi possível identificar a cliente.'
      )
    }

    const pacotes =
      await buscarPacotesCliente(
        clienteNome
      )

    if (!pacotes.length) {
      return
    }

    const historicos =
      pacotes.flatMap(
        (pacote: any) =>
          Array.isArray(
            pacote.historico_sessoes
          )
            ? pacote.historico_sessoes.map(
                (registro: any) => ({
                  ...registro,
                  pacote_id:
                    pacote.id
                })
              )
            : []
      )

    const jaRegistrado =
      historicos.some(
        (registro: any) =>
          registro?.agendamento_id &&
          String(
            registro.agendamento_id
          ) ===
            String(
              agendamento.id
            ) &&
          registro?.tipo !==
            'nao_comparecimento' &&
          registro?.tipo !==
            'nao_compareceu'
      )

    if (jaRegistrado) {
      return
    }

    const dadosCoberturas =
      coberturas.length
        ? coberturas
        : await montarCoberturas(
            agendamento
          )

    for (
      const cobertura of dadosCoberturas
    ) {
      let quantidade =
        Number(
          cobertura.sessoesEquivalentes ||
            1
        )

      if (
        quantidade <= 0
      ) {
        continue
      }

      let pacote =
        cobertura
          .clientePacoteIdSelecionado
          ? pacotes.find(
              (p: any) =>
                p.id ===
                cobertura.clientePacoteIdSelecionado
            )
          : null

      if (!pacote) {
        pacote =
          pacotes.find(
            (p: any) =>
              Number(
                p.sessoes_restantes ||
                  0
              ) >= quantidade
          ) ||
          pacotes.find(
            (p: any) =>
              Number(
                p.sessoes_restantes ||
                  0
              ) > 0
          )
      }

      if (!pacote)
        continue

      const restantes =
        Number(
          pacote.sessoes_restantes ||
            0
        )

      if (
        restantes <= 0
      ) {
        continue
      }

      const desconto =
        Math.min(
          quantidade,
          restantes
        )

      const historico =
        Array.isArray(
          pacote.historico_sessoes
        )
          ? [
              ...pacote.historico_sessoes
            ]
          : []

      historico.push({
        tipo:
          'sessao_realizada',
        data:
          new Date().toISOString(),
        quantidade:
          desconto,
        servico:
          cobertura.servicoNome,
        sessoes_equivalentes:
          cobertura.sessoesEquivalentes,
        agendamento_id:
          agendamento.id
      })

      const restantesDepois =
        restantes -
        desconto

      const {
        error
      } = await supabase
        .from(
          'pacotes_clientes_resumo'
        )
        .update({
          sessoes_restantes:
            restantesDepois,

          status:
            restantesDepois <= 0
              ? 'concluido'
              : 'ativo',

          historico_sessoes:
            historico
        })
        .eq(
          'id',
          pacote.id
        )

      if (error) {
        throw error
      }
    }
  }

  // ─── CONFIRMAR ATENDIMENTO ───────────────────────────────────────────

  async function confirmarAtendimento() {
    if (
      !profile?.salao_id ||
      !modalConfirmar
    ) {
      return
    }

    setSalvando(true)

    try {
      const agendamento =
        modalConfirmar

      // Primeiro verifica se já foi confirmado.

      const jaConfirmado =
        await verificarConfirmacaoAtendimento(
          agendamento.id
        )

      if (jaConfirmado) {
        alert(
          'Este atendimento já foi confirmado anteriormente. Nenhuma nova baixa foi realizada.'
        )

        setModalConfirmar(
          null
        )

        await carregarDados()

        return
      }

      // Se escolheu dar baixa, a função possui proteção própria
      // contra duplicidade.

      if (
        opcaoConfirmacaoPacote ===
          'dar_baixa' &&
        !sessaoJaRegistradaNoPacote
      ) {
        await darBaixaPacoteAtendimento(
          agendamento
        )
      }

      const {
        data:
          confirmacaoCriada,
        error:
          erroConfirmacao
      } = await supabase
        .from(
          'confirmacoes_atendimento'
        )
        .insert({
          agendamento_id:
            agendamento.id,

          salao_id:
            profile.salao_id,

          confirmado_por:
            profile.id
        })
        .select()
        .single()

      if (erroConfirmacao) {
        // 23505 = registro duplicado.

        if (
          erroConfirmacao.code ===
          '23505'
        ) {
          alert(
            'Este atendimento já havia sido confirmado. Nenhuma nova confirmação foi criada.'
          )

          setModalConfirmar(
            null
          )

          await carregarDados()

          return
        }

        throw erroConfirmacao
      }

      if (!confirmacaoCriada) {
        throw new Error(
          'Não foi possível registrar a confirmação.'
        )
      }

      const {
        error:
          erroAgendamento
      } = await supabase
        .from('agendamentos')
        .update({
          status:
            'concluido'
        })
        .eq(
          'id',
          agendamento.id
        )
        .eq(
          'salao_id',
          profile.salao_id
        )

      if (erroAgendamento) {
        throw erroAgendamento
      }

      await notificar({
        salao_id:
          profile.salao_id,

        tipo:
          'atendimento_confirmado',

        titulo:
          'Atendimento confirmado',

        mensagem: `O atendimento de ${
          agendamento.clientes
            ?.nome ||
          'cliente'
        } foi confirmado.`,

        destinatario_id:
          agendamento.cliente_id ||
          null,

        url:
          '/cliente'
      })

      setConfirmacoes(
        prev =>
          prev.filter(
            item =>
              item.id !==
              agendamento.id
          )
      )

      setModalConfirmar(
        null
      )

      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao confirmar atendimento:',
        error
      )

      alert(
        error?.message ||
          'Não foi possível confirmar o atendimento.'
      )
    } finally {
      setSalvando(false)
    }
  }
  // ─── NÃO COMPARECEU ──────────────────────────────────────────────────

  async function iniciarNaoComparecimento(
    agendamento: any
  ) {
    setModalConfirmar({
      tipo: 'nao_compareceu',
      agendamento
    })

    setCoberturas([])
    setCarregandoCoberturas(true)

    try {
      const dados = await montarCoberturas(
        agendamento
      )

      setCoberturas(dados)
    } catch (error) {
      console.error(
        'Erro ao montar coberturas:',
        error
      )
    } finally {
      setCarregandoCoberturas(false)
    }
  }

  async function registrarNaoComparecimento(
    agendamento: any,
    descontarPacote: boolean,
    justificativa: string
  ) {
    if (!profile?.salao_id) return

    setSalvando(true)

    try {
      if (descontarPacote) {
        await aplicarDescontosPacotes(
          agendamento,
          justificativa
        )
      }

      const {
        error: erroAgendamento
      } = await supabase
        .from('agendamentos')
        .update({
          status: 'nao_compareceu'
        })
        .eq(
          'id',
          agendamento.id
        )
        .eq(
          'salao_id',
          profile.salao_id
        )

      if (erroAgendamento) {
        throw erroAgendamento
      }

      await notificar({
        salao_id:
          profile.salao_id,
        tipo:
          'nao_compareceu',
        titulo:
          'Atendimento não realizado',
        mensagem: `O atendimento de ${
          agendamento.clientes?.nome ||
          'cliente'
        } foi marcado como não comparecimento.`,
        destinatario_id:
          agendamento.cliente_id ||
          null,
        url:
          '/cliente/pacotes'
      })

      setConfirmacoes(prev =>
        prev.filter(
          item =>
            item.id !==
            agendamento.id
        )
      )

      setModalConfirmar(null)

      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao registrar não comparecimento:',
        error
      )

      alert(
        error?.message ||
          'Não foi possível registrar o não comparecimento.'
      )
    } finally {
      setSalvando(false)
    }
  }

  // ─── DESCONTO POR NÃO COMPARECIMENTO ─────────────────────────────────

  async function aplicarDescontosPacotes(
    agendamento: any,
    justificativa: string
  ) {
    if (!profile?.salao_id) return

    const clienteNome =
      agendamento.clientes?.nome ||
      agendamento.cliente_nome ||
      ''

    if (!clienteNome) {
      throw new Error(
        'Não foi possível identificar a cliente.'
      )
    }

    const pacotes =
      await buscarPacotesCliente(
        clienteNome
      )

    if (!pacotes.length) return

    const coberturasAtuais =
      coberturas.length > 0
        ? coberturas
        : await montarCoberturas(
            agendamento
          )

    const dataRegistro =
      new Date().toISOString()

    for (
      const cobertura
      of coberturasAtuais
    ) {
      let quantidadeRestante =
        Number(
          cobertura.sessoesEquivalentes || 1
        )

      if (
        quantidadeRestante <= 0
      ) {
        continue
      }

      let pacoteSelecionado =
        cobertura.clientePacoteIdSelecionado
          ? pacotes.find(
              (p: any) =>
                p.id ===
                cobertura.clientePacoteIdSelecionado
            )
          : null

      if (!pacoteSelecionado) {
        pacoteSelecionado =
          pacotes.find(
            (p: any) =>
              Number(
                p.sessoes_restantes || 0
              ) >=
              quantidadeRestante
          ) ||
          pacotes.find(
            (p: any) =>
              Number(
                p.sessoes_restantes || 0
              ) > 0
          )
      }

      while (
        quantidadeRestante > 0 &&
        pacoteSelecionado
      ) {
        const restantesAntes =
          Number(
            pacoteSelecionado.sessoes_restantes ||
              0
          )

        if (
          restantesAntes <= 0
        ) {
          pacoteSelecionado =
            pacotes.find(
              (p: any) =>
                Number(
                  p.sessoes_restantes || 0
                ) > 0 &&
                p.id !==
                  pacoteSelecionado.id
            ) || null

          continue
        }

        const desconto =
          Math.min(
            quantidadeRestante,
            restantesAntes
          )

        const restantesDepois =
          restantesAntes -
          desconto

        const historico =
          Array.isArray(
            pacoteSelecionado.historico_sessoes
          )
            ? [
                ...pacoteSelecionado.historico_sessoes
              ]
            : []

        // Não lança duas vezes a mesma falta.
        const jaRegistrado =
          historico.some(
            (registro: any) =>
              String(
                registro?.agendamento_id ||
                  ''
              ) ===
              String(
                agendamento.id
              )
          )

        if (jaRegistrado) {
          quantidadeRestante = 0
          break
        }

        historico.push({
          tipo:
            'nao_comparecimento',

          data:
            dataRegistro,

          quantidade:
            desconto,

          servico:
            cobertura.servicoNome,

          sessoes_equivalentes:
            cobertura.sessoesEquivalentes,

          justificativa:
            justificativa ||
            'Não comparecimento sem aviso prévio.',

          agendamento_id:
            agendamento.id
        })

        const {
          error
        } = await supabase
          .from(
            'pacotes_clientes_resumo'
          )
          .update({
            sessoes_restantes:
              restantesDepois,

            status:
              restantesDepois <= 0
                ? 'concluido'
                : 'ativo',

            historico_sessoes:
              historico
          })
          .eq(
            'id',
            pacoteSelecionado.id
          )

        if (error) {
          throw error
        }

        pacoteSelecionado.sessoes_restantes =
          restantesDepois

        quantidadeRestante -=
          desconto

        if (
          quantidadeRestante > 0
        ) {
          pacoteSelecionado =
            pacotes.find(
              (p: any) =>
                Number(
                  p.sessoes_restantes ||
                    0
                ) > 0
            ) || null
        }
      }
    }
  }

  // ─── SOLICITAÇÕES ────────────────────────────────────────────────────

  async function aceitarSolicitacao(
    solicitacao: any
  ) {
    if (!profile?.salao_id) return

    setSalvando(true)

    try {
      const dataHora =
        solicitacao.data_hora ||
        solicitacao.data_agendada ||
        solicitacao.horario_sugerido

      const {
        error: erroAgendamento
      } = await supabase
        .from('agendamentos')
        .insert({
          salao_id:
            profile.salao_id,

          cliente_id:
            solicitacao.cliente_id,

          servico_id:
            solicitacao.servico_id,

          data_hora:
            dataHora,

          status:
            'confirmado',

          observacoes:
            solicitacao.observacoes ||
            null
        })

      if (erroAgendamento) {
        throw erroAgendamento
      }

      await supabase
        .from(
          'solicitacoes_agendamento'
        )
        .update({
          status: 'aceito'
        })
        .eq(
          'id',
          solicitacao.id
        )

      await notificar({
        salao_id:
          profile.salao_id,

        tipo:
          'solicitacao_aceita',

        titulo:
          'Agendamento confirmado',

        mensagem: `O agendamento de ${
          solicitacao.clientes?.nome ||
          'cliente'
        } foi confirmado.`,

        destinatario_id:
          solicitacao.cliente_id ||
          null,

        url:
          '/cliente'
      })

      setSolicitacoes(prev =>
        prev.filter(
          item =>
            item.id !==
            solicitacao.id
        )
      )

      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao aceitar solicitação:',
        error
      )

      alert(
        error?.message ||
          'Não foi possível aceitar a solicitação.'
      )
    } finally {
      setSalvando(false)
    }
  }

  async function recusarSolicitacao(
    solicitacao: any
  ) {
    if (!profile?.salao_id) return

    setSalvando(true)

    try {
      const {
        error
      } = await supabase
        .from(
          'solicitacoes_agendamento'
        )
        .update({
          status: 'recusado'
        })
        .eq(
          'id',
          solicitacao.id
        )

      if (error) {
        throw error
      }

      await notificar({
        salao_id:
          profile.salao_id,

        tipo:
          'solicitacao_recusada',

        titulo:
          'Solicitação de agendamento recusada',

        mensagem: `A solicitação de ${
          solicitacao.clientes?.nome ||
          'cliente'
        } não pôde ser aceita neste momento.`,

        destinatario_id:
          solicitacao.cliente_id ||
          null,

        url:
          '/cliente'
      })

      setSolicitacoes(prev =>
        prev.filter(
          item =>
            item.id !==
            solicitacao.id
        )
      )

      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao recusar solicitação:',
        error
      )

      alert(
        error?.message ||
          'Não foi possível recusar a solicitação.'
      )
    } finally {
      setSalvando(false)
    }
  }

  // ─── SUGESTÕES ───────────────────────────────────────────────────────

  async function aceitarSugestao(
    sugestao: any
  ) {
    if (!profile?.salao_id) return

    setSalvando(true)

    try {
      const clienteNovo =
        sugestao.cliente_novo_id

      const clientePendente =
        sugestao.cliente_pendente_id

      if (
        !clienteNovo ||
        !clientePendente
      ) {
        throw new Error(
          'Sugestão de cliente inválida.'
        )
      }

      await supabase
        .from(
          'sugestoes_mesclagem'
        )
        .delete()
        .eq(
          'id',
          sugestao.id
        )

      await supabase
        .from(
          'clientes'
        )
        .update({
          status:
            'mesclado'
        })
        .eq(
          'id',
          clientePendente
        )
        .eq(
          'salao_id',
          profile.salao_id
        )

      setModalSugestao(null)

      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao aceitar sugestão:',
        error
      )

      alert(
        error?.message ||
          'Não foi possível processar a sugestão.'
      )
    } finally {
      setSalvando(false)
    }
  }

  async function ignorarSugestao(
    sugestao: any
  ) {
    if (!profile?.salao_id) return

    setSalvando(true)

    try {
      const clienteId =
        sugestao.cliente_pendente_id

      if (clienteId) {
        await supabase
          .from(
            'clientes'
          )
          .update({
            ignorar_duplicado:
              true
          })
          .eq(
            'id',
            clienteId
          )
          .eq(
            'salao_id',
            profile.salao_id
          )
      }

      await supabase
        .from(
          'sugestoes_mesclagem'
        )
        .delete()
        .eq(
          'id',
          sugestao.id
        )

      setModalSugestao(null)

      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao ignorar sugestão:',
        error
      )

      alert(
        error?.message ||
          'Não foi possível ignorar a sugestão.'
      )
    } finally {
      setSalvando(false)
    }
  }

  // ─── NOTIFICAÇÕES ────────────────────────────────────────────────────

  async function excluirNotificacao(
    notificacao: any
  ) {
    if (!profile?.salao_id) return

    try {
      const {
        error
      } = await supabase
        .from(
          'notificacoes'
        )
        .update({
          excluida:
            true
        })
        .eq(
          'id',
          notificacao.id
        )
        .eq(
          'salao_id',
          profile.salao_id
        )

      if (error) {
        throw error
      }

      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao excluir notificação:',
        error
      )

      alert(
        error?.message ||
          'Não foi possível excluir a notificação.'
      )
    }
  }

  async function restaurarNotificacao(
    notificacao: any
  ) {
    if (!profile?.salao_id) return

    try {
      const {
        error
      } = await supabase
        .from(
          'notificacoes'
        )
        .update({
          excluida:
            false
        })
        .eq(
          'id',
          notificacao.id
        )
        .eq(
          'salao_id',
          profile.salao_id
        )

      if (error) {
        throw error
      }

      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao restaurar notificação:',
        error
      )

      alert(
        error?.message ||
          'Não foi possível restaurar a notificação.'
      )
    }
  }
  // ─── FORMATAÇÃO ──────────────────────────────────────────────────────

  function formatarDataHora(
    dataHora: string
  ) {
    if (!dataHora) return ''

    const data =
      new Date(dataHora)

    return data.toLocaleString(
      'pt-BR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    )
  }

  function formatarData(
    data: string
  ) {
    if (!data) return ''

    return new Date(
      data
    ).toLocaleDateString(
      'pt-BR'
    )
  }

  function formatarMoeda(
    valor: number
  ) {
    return Number(
      valor || 0
    ).toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL'
      }
    )
  }

  function normalizarTexto(
    texto: string
  ) {
    return String(
      texto || ''
    )
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLowerCase()
      .trim()
  }

  function obterNomeCliente(
    item: any
  ) {
    return (
      item?.clientes?.nome ||
      item?.cliente_nome ||
      'Cliente'
    )
  }

  function obterNomeServico(
    item: any
  ) {
    return (
      item?.servicos?.nome ||
      item?.servico_nome ||
      'Serviço'
    )
  }

  function obterTelefoneCliente(
    item: any
  ) {
    return (
      item?.clientes?.telefone ||
      item?.telefone ||
      ''
    )
  }

  // ─── RENDERIZAÇÃO DOS ITENS ──────────────────────────────────────────

  function renderCliente(
    item: any
  ) {
    return (
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white font-semibold"
          style={{
            backgroundColor:
              corSalao
          }}
        >
          {obterNomeCliente(
            item
          )
            .charAt(0)
            .toUpperCase()}
        </div>

        <div className="min-w-0">
          <p className="font-semibold text-gray-800 truncate">
            {obterNomeCliente(
              item
            )}
          </p>

          <p className="text-xs text-gray-500 truncate">
            {obterTelefoneCliente(
              item
            ) ||
              'Telefone não informado'}
          </p>
        </div>
      </div>
    )
  }

  function renderDataAgendamento(
    item: any
  ) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <CalendarDays
          size={15}
        />

        <span>
          {formatarDataHora(
            item.data_hora
          )}
        </span>
      </div>
    )
  }

  // ─── TABS ────────────────────────────────────────────────────────────

  function TabButton({
    id,
    label,
    icon: Icon,
    quantidade
  }: {
    id:
      | 'pedidos'
      | 'confirmacoes'
      | 'notificacoes'
      | 'excluidas'

    label: string

    icon: any

    quantidade?: number
  }) {
    const ativo =
      aba === id

    return (
      <button
        type="button"
        onClick={() =>
          setAba(id)
        }
        className={`
          flex items-center justify-center gap-2
          px-4 py-2.5
          rounded-xl
          text-sm font-medium
          transition-all
          whitespace-nowrap
          ${
            ativo
              ? 'text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }
        `}
        style={
          ativo
            ? {
                backgroundColor:
                  corSalao
              }
            : undefined
        }
      >
        <Icon size={17} />

        <span>
          {label}
        </span>

        {typeof quantidade ===
          'number' &&
          quantidade > 0 && (
            <span
              className={`
                min-w-[20px]
                h-5
                px-1.5
                rounded-full
                text-[11px]
                font-bold
                flex
                items-center
                justify-center
                ${
                  ativo
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
                }
              `}
            >
              {quantidade}
            </span>
          )}
      </button>
    )
  }

  // ─── CARD DE CONFIRMAÇÃO ─────────────────────────────────────────────

  function CardConfirmacao({
    agendamento
  }: {
    agendamento: any
  }) {
    const nome =
      obterNomeCliente(
        agendamento
      )

    const servico =
      obterNomeServico(
        agendamento
      )

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            {renderCliente(
              agendamento
            )}

            <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
              Aguardando
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Scissors
                size={15}
              />

              <span>
                {servico}
              </span>
            </div>

            {renderDataAgendamento(
              agendamento
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                iniciarConfirmacao(
                  agendamento
                )
              }
              className="h-11 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
              style={{
                backgroundColor:
                  corSalao
              }}
              disabled={
                salvando
              }
            >
              Confirmar
            </button>

            <button
              type="button"
              onClick={() =>
                iniciarNaoComparecimento(
                  agendamento
                )
              }
              className="h-11 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors"
              disabled={
                salvando
              }
            >
              Não veio
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── CARD DE PEDIDO ──────────────────────────────────────────────────

  function CardSolicitacao({
    solicitacao
  }: {
    solicitacao: any
  }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          {renderCliente(
            solicitacao
          )}

          <span className="shrink-0 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
            Novo pedido
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {solicitacao.data_hora && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarDays
                size={15}
              />

              <span>
                {formatarDataHora(
                  solicitacao.data_hora
                )}
              </span>
            </div>
          )}

          {(solicitacao.servicos?.nome ||
            solicitacao.servico_nome) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Scissors
                size={15}
              />

              <span>
                {solicitacao.servicos?.nome ||
                  solicitacao.servico_nome}
              </span>
            </div>
          )}
        </div>

        {solicitacao.observacoes && (
          <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
            {solicitacao.observacoes}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              aceitarSolicitacao(
                solicitacao
              )
            }
            className="h-11 rounded-xl text-white text-sm font-semibold"
            style={{
              backgroundColor:
                corSalao
            }}
            disabled={salvando}
          >
            Aceitar
          </button>

          <button
            type="button"
            onClick={() =>
              recusarSolicitacao(
                solicitacao
              )
            }
            className="h-11 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
            disabled={salvando}
          >
            Recusar
          </button>
        </div>
      </div>
    )
  }

  // ─── CARD DE NOTIFICAÇÃO ─────────────────────────────────────────────

  function CardNotificacao({
    notificacao,
    excluida = false
  }: {
    notificacao: any
    excluida?: boolean
  }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor:
                `${corSalao}18`,
              color:
                corSalao
            }}
          >
            <Bell
              size={18}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-800">
                {notificacao.titulo ||
                  'Notificação'}
              </p>

              <span className="text-[11px] text-gray-400 shrink-0">
                {notificacao.created_at
                  ? formatarData(
                      notificacao.created_at
                    )
                  : ''}
              </span>
            </div>

            <p className="mt-1 text-sm text-gray-600 leading-relaxed">
              {notificacao.mensagem ||
                ''}
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          {excluida ? (
            <button
              type="button"
              onClick={() =>
                restaurarNotificacao(
                  notificacao
                )
              }
              className="text-sm font-medium"
              style={{
                color:
                  corSalao
              }}
            >
              Restaurar
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                excluirNotificacao(
                  notificacao
                )
              }
              className="text-sm text-gray-500 hover:text-red-500"
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── CONTEÚDO DAS ABAS ───────────────────────────────────────────────

  function renderConteudo() {
    if (aba === 'confirmacoes') {
      if (!confirmacoes.length) {
        return (
          <EstadoVazio
            icon={
              <CheckCircle2
                size={30}
              />
            }
            titulo="Tudo em dia"
            descricao="Não há atendimentos aguardando confirmação."
          />
        )
      }

      return (
        <div className="grid gap-3">
          {confirmacoes.map(
            agendamento => (
              <CardConfirmacao
                key={
                  agendamento.id
                }
                agendamento={
                  agendamento
                }
              />
            )
          )}
        </div>
      )
    }

    if (aba === 'pedidos') {
      if (!solicitacoes.length) {
        return (
          <EstadoVazio
            icon={
              <Inbox
                size={30}
              />
            }
            titulo="Nenhum pedido"
            descricao="Novas solicitações de agendamento aparecerão aqui."
          />
        )
      }

      return (
        <div className="grid gap-3">
          {solicitacoes.map(
            solicitacao => (
              <CardSolicitacao
                key={
                  solicitacao.id
                }
                solicitacao={
                  solicitacao
                }
              />
            )
          )}
        </div>
      )
    }

    if (aba === 'notificacoes') {
      if (!notificacoes.length) {
        return (
          <EstadoVazio
            icon={
              <Bell
                size={30}
              />
            }
            titulo="Nenhuma notificação"
            descricao="Você está em dia."
          />
        )
      }

      return (
        <div className="grid gap-3">
          {notificacoes.map(
            notificacao => (
              <CardNotificacao
                key={
                  notificacao.id
                }
                notificacao={
                  notificacao
                }
              />
            )
          )}
        </div>
      )
    }

    if (!notificacoesExcluidas.length) {
      return (
        <EstadoVazio
          icon={
            <Trash2
              size={30}
            />
          }
          titulo="Lixeira vazia"
          descricao="As notificações excluídas aparecerão aqui."
        />
      )
    }

    return (
      <div className="grid gap-3">
        {notificacoesExcluidas.map(
          notificacao => (
            <CardNotificacao
              key={
                notificacao.id
              }
              notificacao={
                notificacao
              }
              excluida
            />
          )
        )}
      </div>
    )
  }

  // ─── ESTADO VAZIO ────────────────────────────────────────────────────

  function EstadoVazio({
    icon,
    titulo,
    descricao
  }: {
    icon: React.ReactNode
    titulo: string
    descricao: string
  }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div
          className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
          style={{
            backgroundColor:
              `${corSalao}15`,
            color:
              corSalao
          }}
        >
          {icon}
        </div>

        <h3 className="mt-4 text-base font-semibold text-gray-800">
          {titulo}
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          {descricao}
        </p>
      </div>
    )
  }

  // ─── MODAL DE ATENDIMENTO ────────────────────────────────────────────

  function ModalAtendimento() {
    if (!modalConfirmar) {
      return null
    }

    const agendamento =
      modalConfirmar.agendamento

    const ehNaoCompareceu =
      modalConfirmar.tipo ===
      'nao_compareceu'

    const clienteNome =
      obterNomeCliente(
        agendamento
      )

    const servicoNome =
      obterNomeServico(
        agendamento
      )

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => {
            if (!salvando) {
              setModalConfirmar(
                null
              )
            }
          }}
        />

        <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {ehNaoCompareceu
                    ? 'Registrar não comparecimento'
                    : 'Confirmar atendimento'}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {clienteNome}
                  {' · '}
                  {servicoNome}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!salvando) {
                    setModalConfirmar(
                      null
                    )
                  }
                }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X
                  size={18}
                />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {!ehNaoCompareceu && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Serviço realizado
                  </label>

                  <input
                    value={
                      servicoRealizado
                    }
                    onChange={e =>
                      setServicoRealizado(
                        e.target
                          .value
                      )
                    }
                    placeholder="Digite o serviço realizado"
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:ring-2"
                    style={{
                      ['--tw-ring-color' as any]:
                        `${corSalao}40`
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Horários vagos
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    {horariosLivres.map(
                      (
                        horario,
                        index
                      ) => (
                        <input
                          key={
                            index
                          }
                          type="time"
                          value={
                            horario
                          }
                          onChange={e => {
                            const novos =
                              [
                                ...horariosLivres
                              ]

                            novos[
                              index
                            ] =
                              e.target.value

                            setHorariosLivres(
                              novos
                            )
                          }}
                          className="h-11 rounded-xl border border-gray-200 px-3 text-sm"
                        />
                      )
                    )}
                  </div>
                </div>
              </>
            )}

            {ehNaoCompareceu && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Motivo / observação
                </label>

                <textarea
                  id="justificativa-nao-comparecimento"
                  rows={4}
                  defaultValue=""
                  placeholder="Ex.: cliente não compareceu e não avisou."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none outline-none"
                />
              </div>
            )}

            {ehNaoCompareceu ? (
              <ModalNaoComparecimento
                agendamento={
                  agendamento
                }
              />
            ) : (
              <ModalConfirmacaoPacote
                agendamento={
                  agendamento
                }
              />
            )}
          </div>
        </div>
      </div>
    )
  }
  function ModalConfirmacaoPacote({
    agendamento
  }: {
    agendamento: any
  }) {
    const [opcao, setOpcao] =
      useState<
        'perguntar' |
        'dar_baixa' |
        'apenas_confirmar'
      >(opcaoConfirmacaoPacote)

    const pacoteDisponivel =
      possuiPacoteDisponivel

    return (
      <div className="space-y-4">
        {verificandoPacoteConfirmacao ? (
          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
            Verificando pacote da cliente...
          </div>
        ) : pacoteDisponivel ? (
          <>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Este atendimento possui
                pacote disponível.
              </p>

              <p className="mt-1 text-xs text-gray-500">
                O que deseja fazer com
                esta confirmação?
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  setOpcao(
                    'dar_baixa'
                  )
                }
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  opcao ===
                  'dar_baixa'
                    ? 'border-2'
                    : 'border-gray-200'
                }`}
                style={
                  opcao ===
                  'dar_baixa'
                    ? {
                        borderColor:
                          corSalao,
                        backgroundColor:
                          `${corSalao}08`
                      }
                    : undefined
                }
              >
                <p className="font-semibold text-gray-800 text-sm">
                  Dar baixa no pacote
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Confirma o atendimento
                  e desconta uma sessão
                  do pacote.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpcao(
                    'apenas_confirmar'
                  )
                }
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  opcao ===
                  'apenas_confirmar'
                    ? 'border-2'
                    : 'border-gray-200'
                }`}
                style={
                  opcao ===
                  'apenas_confirmar'
                    ? {
                        borderColor:
                          corSalao,
                        backgroundColor:
                          `${corSalao}08`
                      }
                    : undefined
                }
              >
                <p className="font-semibold text-gray-800 text-sm">
                  Apenas confirmar
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Confirma o atendimento
                  sem descontar sessão.
                </p>
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-700">
              Sem pacote disponível
            </p>

            <p className="mt-1 text-xs text-gray-500">
              O atendimento será
              confirmado normalmente.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={salvando}
          onClick={() =>
            confirmarAtendimento(
              agendamento,
              pacoteDisponivel &&
                opcao ===
                  'dar_baixa'
            )
          }
          className="w-full h-12 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
          style={{
            backgroundColor:
              corSalao
          }}
        >
          {salvando
            ? 'Salvando...'
            : 'Confirmar atendimento'}
        </button>
      </div>
    )
  }

  function ModalNaoComparecimento({
    agendamento
  }: {
    agendamento: any
  }) {
    const [
      descontarPacote,
      setDescontarPacote
    ] = useState(
      possuiPacoteDisponivel
    )

    const [
      justificativa,
      setJustificativa
    ] = useState(
      'Não comparecimento sem aviso prévio.'
    )

    useEffect(() => {
      setDescontarPacote(
        possuiPacoteDisponivel
      )
    }, [
      possuiPacoteDisponivel
    ])

    return (
      <div className="space-y-4">
        {verificandoPacoteConfirmacao ? (
          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
            Verificando pacote da cliente...
          </div>
        ) : (
          <>
            {possuiPacoteDisponivel ? (
              <button
                type="button"
                onClick={() =>
                  setDescontarPacote(
                    !descontarPacote
                  )
                }
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  descontarPacote
                    ? 'border-2'
                    : 'border-gray-200'
                }`}
                style={
                  descontarPacote
                    ? {
                        borderColor:
                          corSalao,
                        backgroundColor:
                          `${corSalao}08`
                      }
                    : undefined
                }
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5"
                    style={
                      descontarPacote
                        ? {
                            backgroundColor:
                              corSalao,
                            borderColor:
                              corSalao
                          }
                        : undefined
                    }
                  >
                    {descontarPacote && (
                      <Check
                        size={14}
                        className="text-white"
                      />
                    )}
                  </div>

                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      Descontar sessão
                      do pacote
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      O não comparecimento
                      será registrado no
                      histórico do pacote.
                    </p>
                  </div>
                </div>
              </button>
            ) : (
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-700">
                  Sem pacote disponível
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Nenhuma sessão será
                  descontada.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo / observação
              </label>

              <textarea
                value={
                  justificativa
                }
                onChange={e =>
                  setJustificativa(
                    e.target.value
                  )
                }
                rows={4}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none outline-none focus:ring-2"
                style={{
                  ['--tw-ring-color' as any]:
                    `${corSalao}40`
                }}
              />
            </div>

            <button
              type="button"
              disabled={salvando}
              onClick={() =>
                registrarNaoComparecimento(
                  agendamento,
                  descontarPacote,
                  justificativa
                )
              }
              className="w-full h-12 rounded-xl bg-red-500 text-white font-semibold text-sm disabled:opacity-50"
            >
              {salvando
                ? 'Salvando...'
                : 'Registrar não comparecimento'}
            </button>
          </>
        )}
      </div>
    )
  }

  // ─── MODAL DE SUGESTÃO ───────────────────────────────────────────────

  function ModalSugestao() {
    if (!modalSugestao) {
      return null
    }

    const clienteNovo =
      modalSugestao.cliente_novo

    const clientePendente =
      modalSugestao.cliente_pendente

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => {
            if (!salvando) {
              setModalSugestao(
                null
              )
            }
          }}
        />

        <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Possível duplicidade
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Encontramos clientes
                  que podem ser a mesma
                  pessoa.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!salvando) {
                    setModalSugestao(
                      null
                    )
                  }
                }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X
                  size={18}
                />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Cliente principal
              </p>

              <p className="mt-1 font-semibold text-gray-800">
                {clienteNovo?.nome ||
                  'Cliente'}
              </p>

              {clienteNovo?.telefone && (
                <p className="mt-1 text-sm text-gray-500">
                  {clienteNovo.telefone}
                </p>
              )}
            </div>

            <div className="flex justify-center">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor:
                    `${corSalao}15`,
                  color:
                    corSalao
                }}
              >
                <ArrowDown
                  size={17}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Possível duplicado
              </p>

              <p className="mt-1 font-semibold text-gray-800">
                {clientePendente?.nome ||
                  'Cliente'}
              </p>

              {clientePendente?.telefone && (
                <p className="mt-1 text-sm text-gray-500">
                  {clientePendente.telefone}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={salvando}
                onClick={() =>
                  ignorarSugestao(
                    modalSugestao
                  )
                }
                className="h-11 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold"
              >
                Não são duplicados
              </button>

              <button
                type="button"
                disabled={salvando}
                onClick={() =>
                  aceitarSugestao(
                    modalSugestao
                  )
                }
                className="h-11 rounded-xl text-white text-sm font-semibold"
                style={{
                  backgroundColor:
                    corSalao
                }}
              >
                Mesclar
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── LAYOUT PRINCIPAL ────────────────────────────────────────────────

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
        <div
          className="w-8 h-8 rounded-full border-2 border-gray-200 animate-spin"
          style={{
            borderTopColor:
              corSalao
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[#f8f8f8] text-gray-800"
      style={{
        ['--cor-salao' as any]:
          corSalao
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6">
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-600 shadow-sm"
            >
              <ArrowLeft
                size={19}
              />
            </button>

            <div>
              <h1 className="text-xl font-bold text-gray-800">
                Central de Atendimento
              </h1>

              <p className="text-sm text-gray-500 mt-0.5">
                Organize os atendimentos
                do seu salão
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 mb-5 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            <TabButton
              id="pedidos"
              label="Pedidos"
              icon={Inbox}
              quantidade={
                solicitacoes.length
              }
            />

            <TabButton
              id="confirmacoes"
              label="Confirmar"
              icon={CheckCircle2}
              quantidade={
                confirmacoes.length
              }
            />

            <TabButton
              id="notificacoes"
              label="Notificações"
              icon={Bell}
              quantidade={
                notificacoes.length
              }
            />

            <TabButton
              id="excluidas"
              label="Excluídas"
              icon={Trash2}
              quantidade={
                notificacoesExcluidas.length
              }
            />
          </div>
        </div>

        {aba ===
          'confirmacoes' && (
          <div className="mb-4">
            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor:
                  `${corSalao}0A`,
                border:
                  `1px solid ${corSalao}20`
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor:
                      `${corSalao}18`,
                    color:
                      corSalao
                  }}
                >
                  <Info
                    size={18}
                  />
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Atendimentos aguardando
                    confirmação
                  </p>

                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                    Os atendimentos permanecem
                    nesta lista até que você
                    escolha <strong>Confirmar</strong>{' '}
                    ou <strong>Não veio</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {renderConteudo()}
      </div>

      <ModalAtendimento />
      <ModalSugestao />
    </div>
  )
}

export default NotificacoesSalaoCompleto
