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
  const [notificacoesExcluidas, setNotificacoesExcluidas] = useState<any[]>([])
  const [modalSugestao, setModalSugestao] = useState<any>(null)
  const [modalConfirmar, setModalConfirmar] = useState<any>(null)
  const [horariosLivres, setHorariosLivres] = useState(['', '', ''])
  const [servicoRealizado, setServicoRealizado] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [coberturas, setCoberturas] = useState<CoberturaServico[]>([])
  const [carregandoCoberturas, setCarregandoCoberturas] = useState(false)
  // ─── CONTROLE DO PACOTE NA CONFIRMAÇÃO ────────────────────────────────
  const [sessaoJaRegistradaNoPacote, setSessaoJaRegistradaNoPacote] =
    useState(false)
  const [possuiPacoteDisponivel, setPossuiPacoteDisponivel] =
    useState(false)
  const [opcaoConfirmacaoPacote, setOpcaoConfirmacaoPacote] = useState<
    'perguntar' | 'dar_baixa' | 'apenas_confirmar'
  >('perguntar')
  const [verificandoPacoteConfirmacao, setVerificandoPacoteConfirmacao] =
    useState(false)
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
      const registration = await navigator.serviceWorker.ready
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
      const subscriptionJson = subscription.toJSON()
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
        updated_at: new Date().toISOString()
      }
      const { error: upsertError } = await supabase
        .from('push_subscriptions')
        .upsert(
          dadosSubscription,
          { onConflict: 'user_id' }
        )
      if (!upsertError) return
      const { data: existente } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle()
      if (existente?.id) {
        await supabase
          .from('push_subscriptions')
          .update(dadosSubscription)
          .eq('id', existente.id)
      } else {
        await supabase
          .from('push_subscriptions')
          .insert(dadosSubscription)
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
    const { data: sal } = await supabase
      .from('saloes')
      .select('*')
      .eq('id', profile.salao_id)
      .single()
    setSalao(sal)
    const { data: sols } = await supabase
      .from('solicitacoes_agendamento')
      .select(
        '*, clientes(id, nome, email, telefone), servicos(nome, duracao_minutos)'
      )
      .eq('salao_id', profile.salao_id)
      .in('status', ['pendente', 'horario_sugerido'])
      .order('created_at', { ascending: false })
    setSolicitacoes(sols || [])
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
    const { data: ags } = await supabase
      .from('agendamentos')
      .select(
        '*, clientes(id, nome, telefone), servicos(nome, id), confirmacoes_atendimento(*)'
      )
      .eq('salao_id', profile.salao_id)
      .eq('status', 'confirmado')
      .order('data_hora', { ascending: true })
    setConfirmacoes(
      (ags || []).filter(
        (a: any) =>
          !a.confirmacoes_atendimento?.length
      )
    )
    const { data: notifs } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('salao_id', profile.salao_id)
      .eq('destinatario_id', profile.id)
      .eq('excluida', false)
      .order('created_at', { ascending: false })
    setNotificacoes(notifs || [])
    const { data: excluidas } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('salao_id', profile.salao_id)
      .eq('destinatario_id', profile.id)
      .eq('excluida', true)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotificacoesExcluidas(excluidas || [])
  }
  // ─── FORMATADORES DE SOLICITAÇÃO ─────────────────────────────────────
  function formatarDataPreferida(solicitacao: any) {
    const data =
      solicitacao?.data_preferida ??
      solicitacao?.data_desejada ??
      solicitacao?.data_solicitada ??
      solicitacao?.data
    if (!data) return null
    const dataString = String(data)
    let dataFormatada: Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
      const [ano, mes, dia] =
        dataString.split('-').map(Number)
      dataFormatada = new Date(
        ano,
        mes - 1,
        dia
      )
    } else {
      dataFormatada = new Date(dataString)
    }
    if (Number.isNaN(dataFormatada.getTime())) {
      return null
    }
    return dataFormatada.toLocaleDateString(
      'pt-BR',
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    )
  }
  function formatarPeriodoPreferido(solicitacao: any) {
    const periodo =
      solicitacao?.periodo_preferido ??
      solicitacao?.periodo_desejado ??
      solicitacao?.periodo ??
      solicitacao?.turno
    if (!periodo) return null
    const valor = String(periodo).trim()
    const mapa: Record<string, string> = {
      manha: 'Manhã',
      manhã: 'Manhã',
      tarde: 'Tarde',
      noite: 'Noite',
      qualquer: 'Qualquer horário',
      qualquer_horario: 'Qualquer horário',
      qualquer_horário: 'Qualquer horário',
      indiferente: 'Qualquer horário'
    }
    const normalizado = valor
      .toLowerCase()
      .replace(/\s+/g, '_')
    return (
      mapa[normalizado] ||
      valor.charAt(0).toUpperCase() +
        valor.slice(1)
    )
  }
  // ─── NOTIFICAÇÕES ────────────────────────────────────────────────────
  async function handleClicarNotificacao(n: any) {
    if (!n.lida) {
      await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', n.id)
      setNotificacoes(prev =>
        prev.map(item =>
          item.id === n.id
            ? { ...item, lida: true }
            : item
        )
      )
    }
    if (n.url) {
      router.push(n.url)
    }
  }
  // ─── PACOTES ─────────────────────────────────────────────────────────
  async function buscarTodosPacotesCliente(clienteNome: string) {
    if (!clienteNome) return []

    const { data, error } = await supabase
      .from('pacotes_clientes_resumo')
      .select(
        'id, cliente_nome, servico, sessoes_total, sessoes_restantes, data_sessao, created_at, status, historico_sessoes'
      )
      .eq('cliente_nome', clienteNome)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Erro ao buscar todos os pacotes:', error)
      return []
    }

    return data || []
  }

  async function buscarPacotesCliente(clienteNome: string) {
    if (!clienteNome) return []
    const { data, error } = await supabase
      .from('pacotes_clientes_resumo')
      .select(
        'id, cliente_nome, servico, sessoes_total, sessoes_restantes, data_sessao, created_at, status, historico_sessoes'
      )
      .eq('cliente_nome', clienteNome)
      .eq('status', 'ativo')
      .gt('sessoes_restantes', 0)
      .order('created_at', { ascending: true })
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

    const pacotes = await buscarTodosPacotesCliente(clienteNome)

    const possuiPacote = pacotes.some(
      (pacote: any) =>
        pacote.status === 'ativo' &&
        Number(pacote.sessoes_restantes || 0) > 0
    )

    // Primeiro usa o identificador mais seguro:
    // historico_sessoes[].agendamento_id === agendamento.id
    for (const pacote of pacotes) {
      const historico =
        Array.isArray(pacote.historico_sessoes)
          ? pacote.historico_sessoes
          : []

      const encontrada = historico.some(
        (registro: any) =>
          registro?.agendamento_id &&
          String(registro.agendamento_id) ===
            String(agendamento.id) &&
          registro?.tipo !== 'nao_comparecimento' &&
          registro?.tipo !== 'nao_compareceu'
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
        ? String(agendamento.data_hora).slice(0, 10)
        : null

    const normalizarTexto = (valor: any) =>
      String(valor || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    if (servicoNome && dataAgendamento) {
      const possiveis: any[] = []

      for (const pacote of pacotes) {
        const historico =
          Array.isArray(pacote.historico_sessoes)
            ? pacote.historico_sessoes
            : []

        for (const registro of historico) {
          if (registro?.agendamento_id) continue

          if (
            registro?.tipo === 'nao_comparecimento' ||
            registro?.tipo === 'nao_compareceu'
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
              ? String(dataRegistro).slice(0, 10)
              : null

          const nomeRegistro =
            registro?.servico ||
            registro?.servico_nome ||
            ''

          if (
            dataRegistroChave === dataAgendamento &&
            normalizarTexto(nomeRegistro) ===
              normalizarTexto(servicoNome)
          ) {
            possiveis.push({
              pacote,
              registro
            })
          }
        }
      }

      if (possiveis.length === 1) {
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
      Array.isArray(agendamento.servicos_ids) &&
      agendamento.servicos_ids.length > 0
        ? [...agendamento.servicos_ids]
        : agendamento.servico_id
          ? [agendamento.servico_id]
          : []

    if (
      idsServicos.length === 0 &&
      agendamento.servicos?.id
    ) {
      idsServicos.push(
        agendamento.servicos.id
      )
    }

    const { data: servicosInfo } = await supabase
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

    if (!clienteNome) return []

    const pacotesData =
      await buscarPacotesCliente(
        clienteNome
      )

    const opcoesGerais: PacoteOpcao[] =
      pacotesData
        .map((pacote: any) => ({
          clientePacoteId: pacote.id,
          nome: pacote.servico,
          sessoesRestantes: Number(
            pacote.sessoes_restantes || 0
          )
        }))
        .filter(
          (opcao: PacoteOpcao) =>
            opcao.sessoesRestantes > 0
        )

    const resultado: CoberturaServico[] = []

    for (const idServico of idsServicos) {
      const servicoInfo =
        (servicosInfo || []).find(
          (s: any) => s.id === idServico
        )

      if (!servicoInfo) continue

      const sessoesEquivalentes = Number(
        servicoInfo.sessoes_equivalentes || 1
      )

      const nomeServico = servicoInfo.nome

      const pacotesDisponiveis =
        opcoesGerais.filter(
          (opcao: PacoteOpcao) => {
            const nomePacote =
              String(opcao.nome || '').toLowerCase()

            const nomeServicoNormalizado =
              String(nomeServico || '').toLowerCase()

            return (
              nomePacote.includes(
                nomeServicoNormalizado
              ) ||
              nomeServicoNormalizado.includes(
                nomePacote
              )
            )
          }
        )

      resultado.push({
        servicoId: idServico,
        servicoNome: nomeServico,
        sessoesEquivalentes,
        clientePacoteIdSelecionado:
          pacotesDisponiveis.length === 1
            ? pacotesDisponiveis[0].clientePacoteId
            : null,
        pacotesDisponiveis
      })
    }

    return resultado
  }

  async function prepararConfirmacao(
    agendamento: any
  ) {
    setModalConfirmar(agendamento)
    setServicoRealizado(
      agendamento.servicos?.nome ||
        agendamento.servico_nome ||
        ''
    )
    setHorariosLivres(['', '', ''])
    setOpcaoConfirmacaoPacote('perguntar')
    setSessaoJaRegistradaNoPacote(false)
    setPossuiPacoteDisponivel(false)
    setCoberturas([])
    setCarregandoCoberturas(true)
    setVerificandoPacoteConfirmacao(true)

    try {
      const verificacao =
        await verificarSessaoJaRegistrada(
          agendamento
        )

      setSessaoJaRegistradaNoPacote(
        verificacao.registrada
      )
      setPossuiPacoteDisponivel(
        verificacao.possuiPacote
      )

      if (
        !verificacao.registrada &&
        verificacao.possuiPacote
      ) {
        const coberturas =
          await montarCoberturas(
            agendamento
          )

        setCoberturas(coberturas)
      }
    } catch (err) {
      console.error(
        'Erro ao preparar confirmação:',
        err
      )
    } finally {
      setCarregandoCoberturas(false)
      setVerificandoPacoteConfirmacao(false)
    }
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
        url: '/cliente'
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

  async function aplicarDescontosPacotes(
    agendamento: any,
    justificativa: string
  ) {
    if (!profile?.salao_id) return

    const clienteNome =
      agendamento.clientes?.nome ||
      agendamento.cliente_nome ||
      ''

    if (!clienteNome) return

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

    for (const cobertura of coberturasAtuais) {
      let quantidadeRestante =
        Number(
          cobertura.sessoesEquivalentes || 1
        )

      if (quantidadeRestante <= 0) {
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
              ) >= quantidadeRestante
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
            pacoteSelecionado.sessoes_restantes || 0
          )

        if (restantesAntes <= 0) {
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
          restantesAntes - desconto

        const historico =
          Array.isArray(
            pacoteSelecionado.historico_sessoes
          )
            ? [
                ...pacoteSelecionado.historico_sessoes
              ]
            : []

        const jaRegistrado =
          historico.some(
            (registro: any) =>
              String(
                registro?.agendamento_id || ''
              ) ===
                String(agendamento.id) &&
              (
                registro?.tipo ===
                  'nao_comparecimento' ||
                registro?.tipo ===
                  'nao_compareceu'
              )
          )

        if (jaRegistrado) {
          return
        }

        historico.push({
          tipo:
            'nao_comparecimento',
          data:
            new Date().toISOString(),
          quantidade:
            desconto,
          servico:
            cobertura.servicoNome,
          sessoes_equivalentes:
            cobertura.sessoesEquivalentes,
          agendamento_id:
            agendamento.id,
          justificativa:
            justificativa ||
            null
        })

        const { error } =
          await supabase
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
                  p.sessoes_restantes || 0
                ) > 0
            ) || null
        }
      }
    }
  }

  // ─── SOLICITAÇÕES ─────────────────────────────────────────────────────
  async function aceitarSolicitacao(
    solicitacao: any,
    dataHora: string
  ) {
    if (!profile?.salao_id) return

    setSalvando(true)

    try {
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
          profissional_id:
            solicitacao.profissional_id ||
            null,
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

      const {
        error: erroSolicitacao
      } = await supabase
        .from('solicitacoes_agendamento')
        .update({
          status:
            'aprovado',
          data_hora_aprovada:
            dataHora
        })
        .eq(
          'id',
          solicitacao.id
        )
        .eq(
          'salao_id',
          profile.salao_id
        )

      if (erroSolicitacao) {
        throw erroSolicitacao
      }

      await notificar({
        salao_id:
          profile.salao_id,
        tipo:
          'agendamento_aprovado',
        titulo:
          'Agendamento aprovado',
        mensagem: `Seu agendamento para ${
          solicitacao.servicos?.nome ||
          'o serviço'
        } foi aprovado.`,
        destinatario_id:
          solicitacao.cliente_id ||
          null,
        url: '/cliente'
      })

      await carregarDados()
      setModalSugestao(null)
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
          status:
            'recusado'
        })
        .eq(
          'id',
          solicitacao.id
        )
        .eq(
          'salao_id',
          profile.salao_id
        )

      if (error) {
        throw error
      }

      await notificar({
        salao_id:
          profile.salao_id,
        tipo:
          'agendamento_recusado',
        titulo:
          'Solicitação não aprovada',
        mensagem:
          'Sua solicitação de agendamento não pôde ser aprovada.',
        destinatario_id:
          solicitacao.cliente_id ||
          null,
        url: '/cliente'
      })

      await carregarDados()
      setModalSugestao(null)
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

  async function sugerirHorarios(
    solicitacao: any
  ) {
    if (!profile?.salao_id) return

    const horariosValidos =
      horariosLivres.filter(
        horario =>
          horario &&
          horario.trim()
      )

    if (
      horariosValidos.length === 0
    ) {
      alert(
        'Informe pelo menos um horário.'
      )
      return
    }

    setSalvando(true)

    try {
      const {
        error
      } = await supabase
        .from(
          'solicitacoes_agendamento'
        )
        .update({
          status:
            'horario_sugerido',
          horarios_sugeridos:
            horariosValidos
        })
        .eq(
          'id',
          solicitacao.id
        )
        .eq(
          'salao_id',
          profile.salao_id
        )

      if (error) {
        throw error
      }

      await notificar({
        salao_id:
          profile.salao_id,
        tipo:
          'horarios_sugeridos',
        titulo:
          'Novos horários disponíveis',
        mensagem:
          'O salão enviou novos horários para seu agendamento.',
        destinatario_id:
          solicitacao.cliente_id ||
          null,
        url: '/cliente'
      })

      await carregarDados()
      setModalSugestao(null)
      setHorariosLivres([
        '',
        '',
        ''
      ])
    } catch (error: any) {
      console.error(
        'Erro ao sugerir horários:',
        error
      )
      alert(
        error?.message ||
          'Não foi possível enviar os horários.'
      )
    } finally {
      setSalvando(false)
    }
  }

  async function excluirNotificacao(
    id: string
  ) {
    try {
      const {
        error
      } = await supabase
        .from('notificacoes')
        .update({
          excluida:
            true
        })
        .eq(
          'id',
          id
        )
        .eq(
          'salao_id',
          profile?.salao_id
        )

      if (error) {
        throw error
      }

      setNotificacoes(prev =>
        prev.filter(
          n =>
            n.id !== id
        )
      )

      const {
        data
      } = await supabase
        .from('notificacoes')
        .select('*')
        .eq(
          'id',
          id
        )
        .maybeSingle()

      if (data) {
        setNotificacoesExcluidas(
          prev => [
            data,
            ...prev
          ]
        )
      }
    } catch (error) {
      console.error(
        'Erro ao excluir notificação:',
        error
      )
    }
  }

  async function restaurarNotificacao(
    id: string
  ) {
    try {
      const {
        error
      } = await supabase
        .from('notificacoes')
        .update({
          excluida:
            false
        })
        .eq(
          'id',
          id
        )
        .eq(
          'salao_id',
          profile?.salao_id
        )

      if (error) {
        throw error
      }

      const {
        data
      } = await supabase
        .from('notificacoes')
        .select('*')
        .eq(
          'id',
          id
        )
        .maybeSingle()

      setNotificacoesExcluidas(
        prev =>
          prev.filter(
            n =>
              n.id !== id
          )
      )

      if (data) {
        setNotificacoes(
          prev => [
            data,
            ...prev
          ]
        )
      }
    } catch (error) {
      console.error(
        'Erro ao restaurar notificação:',
        error
      )
    }
  }

  // ─── FORMATAÇÃO ───────────────────────────────────────────────────────
  function formatarDataHora(
    dataHora: any
  ) {
    if (!dataHora) {
      return {
        data: '',
        hora: ''
      }
    }

    const data =
      new Date(dataHora)

    if (
      Number.isNaN(
        data.getTime()
      )
    ) {
      return {
        data: '',
        hora: ''
      }
    }

    return {
      data:
        data.toLocaleDateString(
          'pt-BR',
          {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }
        ),
      hora:
        data.toLocaleTimeString(
          'pt-BR',
          {
            hour: '2-digit',
            minute: '2-digit'
          }
        )
    }
  }

  function formatarDataLonga(
    dataHora: any
  ) {
    if (!dataHora) return ''

    const data =
      new Date(dataHora)

    if (
      Number.isNaN(
        data.getTime()
      )
    ) {
      return ''
    }

    return data.toLocaleDateString(
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

  function formatarTelefone(
    telefone: any
  ) {
    if (!telefone) {
      return ''
    }

    const numeros =
      String(
        telefone
      ).replace(
        /\D/g,
        ''
      )

    if (
      numeros.length === 11
    ) {
      return `(${numeros.slice(
        0,
        2
      )}) ${numeros.slice(
        2,
        7
      )}-${numeros.slice(
        7
      )}`
    }

    if (
      numeros.length === 10
    ) {
      return `(${numeros.slice(
        0,
        2
      )}) ${numeros.slice(
        2,
        6
      )}-${numeros.slice(
        6
      )}`
    }

    return String(
      telefone
    )
  }

  function abrirWhatsApp(
    telefone: any,
    mensagem?: string
  ) {
    const numeros =
      String(
        telefone || ''
      ).replace(
        /\D/g,
        ''
      )

    if (!numeros) {
      return
    }

    const numeroFinal =
      numeros.startsWith(
        '55'
      )
        ? numeros
        : `55${numeros}`

    const texto =
      mensagem ||
      ''

    window.open(
      `https://wa.me/${numeroFinal}?text=${encodeURIComponent(
        texto
      )}`,
      '_blank'
    )
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

  function obterTelefoneCliente(
    item: any
  ) {
    return (
      item?.clientes?.telefone ||
      item?.cliente_telefone ||
      ''
    )
  }

  function obterNomeServico(
    item: any
  ) {
    return (
      item?.servicos?.nome ||
      item?.servico_nome ||
      'Atendimento'
    )
  }

  // ─── TOTAIS ───────────────────────────────────────────────────────────
  const quantidadePedidos =
    solicitacoes.length

  const quantidadeConfirmacoes =
    confirmacoes.length

  const quantidadeNotificacoes =
    notificacoes.filter(
      n =>
        !n.lida
    ).length

  // ─── RENDERIZAÇÃO ─────────────────────────────────────────────────────
  if (
    loading ||
    !profile
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
        <div
          className="w-8 h-8 rounded-full border-2 border-[#E91E8C] border-t-transparent animate-spin"
        />
      </div>
    )
  }

  const corSalao =
    '#E91E8C'

  return (
    <div
      className="min-h-screen bg-[#f8f8f8] text-[#333]"
      style={
        {
          '--cor-salao':
            corSalao
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              router.back()
            }
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft
              size={20}
            />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">
              Central de Atendimento
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {salao?.nome ||
                'Atendimento'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-gray-800">
            Central de Atendimento
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie pedidos, confirmações e notificações.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <TabButton
            ativo={
              aba ===
              'pedidos'
            }
            onClick={() =>
              setAba(
                'pedidos'
              )
            }
            icone={
              <Calendar
                size={17}
              />
            }
            titulo="Pedidos"
            contador={
              quantidadePedidos
            }
            cor={corSalao}
          />

          <TabButton
            ativo={
              aba ===
              'confirmacoes'
            }
            onClick={() =>
              setAba(
                'confirmacoes'
              )
            }
            icone={
              <Check
                size={17}
              />
            }
            titulo="Confirmar"
            contador={
              quantidadeConfirmacoes
            }
            cor={corSalao}
          />

          <TabButton
            ativo={
              aba ===
              'notificacoes'
            }
            onClick={() =>
              setAba(
                'notificacoes'
              )
            }
            icone={
              <Bell
                size={17}
              />
            }
            titulo="Avisos"
            contador={
              quantidadeNotificacoes
            }
            cor={corSalao}
          />

          <TabButton
            ativo={
              aba ===
              'excluidas'
            }
            onClick={() =>
              setAba(
                'excluidas'
              )
            }
            icone={
              <Trash2
                size={17}
              />
            }
            titulo="Excluídas"
            contador={
              notificacoesExcluidas.length
            }
            cor={corSalao}
          />
        </div>

        {aba ===
          'pedidos' && (
          <section>
            {solicitacoes.length ===
            0 ? (
              <EmptyState
                icone={
                  <Calendar
                    size={26}
                  />
                }
                titulo="Nenhum pedido pendente"
                texto="Novos pedidos de agendamento aparecerão aqui."
              />
            ) : (
              <div className="space-y-3">
                {solicitacoes.map(
                  (
                    solicitacao
                  ) => (
                    <div
                      key={
                        solicitacao.id
                      }
                      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor:
                              `${corSalao}18`,
                            color:
                              corSalao
                          }}
                        >
                          <Calendar
                            size={
                              20
                            }
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-gray-800">
                                {obterNomeCliente(
                                  solicitacao
                                )}
                              </h3>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {obterNomeServico(
                                  solicitacao
                                )}
                              </p>
                            </div>

                            <span
                              className="text-[11px] px-2 py-1 rounded-full font-medium shrink-0"
                              style={{
                                backgroundColor:
                                  `${corSalao}12`,
                                color:
                                  corSalao
                              }}
                            >
                              Pendente
                            </span>
                          </div>

                          <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                            {formatarDataPreferida(
                              solicitacao
                            ) && (
                              <div className="flex items-center gap-2">
                                <Calendar
                                  size={
                                    15
                                  }
                                />
                                <span>
                                  {formatarDataPreferida(
                                    solicitacao
                                  )}
                                </span>
                              </div>
                            )}

                            {formatarPeriodoPreferido(
                              solicitacao
                            ) && (
                              <div className="flex items-center gap-2">
                                <Clock
                                  size={
                                    15
                                  }
                                />
                                <span>
                                  {formatarPeriodoPreferido(
                                    solicitacao
                                  )}
                                </span>
                              </div>
                            )}

                            {obterTelefoneCliente(
                              solicitacao
                            ) && (
                              <div className="flex items-center gap-2">
                                <MessageCircle
                                  size={
                                    15
                                  }
                                />
                                <span>
                                  {formatarTelefone(
                                    obterTelefoneCliente(
                                      solicitacao
                                    )
                                  )}
                                </span>
                              </div>
                            )}
                          </div>

                          {solicitacao.observacoes && (
                            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                              <span className="font-medium text-gray-700">
                                Observação:
                              </span>{' '}
                              {
                                solicitacao.observacoes
                              }
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 mt-4">
                            <button
                              type="button"
                              onClick={() =>
                                setModalSugestao(
                                  {
                                    tipo:
                                      'recusar',
                                    solicitacao
                                  }
                                )
                              }
                              className="h-11 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                            >
                              Recusar
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setModalSugestao(
                                  {
                                    tipo:
                                      'aceitar',
                                    solicitacao
                                  }
                                )
                              }
                              className="h-11 rounded-xl text-white text-sm font-semibold"
                              style={{
                                backgroundColor:
                                  corSalao
                              }}
                            >
                              Ver pedido
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {aba ===
          'confirmacoes' && (
          <section>
            {confirmacoes.length ===
            0 ? (
              <EmptyState
                icone={
                  <Check
                    size={26}
                  />
                }
                titulo="Tudo em dia"
                texto="Não há atendimentos aguardando confirmação."
              />
            ) : (
              <div className="space-y-3">
                {confirmacoes.map(
                  (
                    agendamento
                  ) => {
                    const dh =
                      formatarDataHora(
                        agendamento.data_hora
                      )

                    return (
                      <div
                        key={
                          agendamento.id
                        }
                        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor:
                                `${corSalao}18`,
                              color:
                                corSalao
                            }}
                          >
                            <Check
                              size={
                                20
                              }
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-gray-800">
                                  {obterNomeCliente(
                                    agendamento
                                  )}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                  {obterNomeServico(
                                    agendamento
                                  )}
                                </p>
                              </div>

                              <span className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium shrink-0">
                                Aguardando
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <Calendar
                                  size={
                                    15
                                  }
                                />
                                <span>
                                  {dh.data}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Clock
                                  size={
                                    15
                                  }
                                />
                                <span>
                                  {dh.hora}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() =>
                                  iniciarNaoComparecimento(
                                    agendamento
                                  )
                                }
                                className="h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50"
                              >
                                Não veio
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  abrirModalConfirmar(
                                    agendamento
                                  )
                                }
                                className="h-11 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                                style={{
                                  backgroundColor:
                                    corSalao
                                }}
                                disabled={
                                  verificandoPacoteConfirmacao &&
                                  modalConfirmar?.id ===
                                    agendamento.id
                                }
                              >
                                Confirmar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }
                )}
              </div>
            )}
          </section>
        )}

        {aba ===
          'notificacoes' && (
          <section>
            {notificacoes.length ===
            0 ? (
              <EmptyState
                icone={
                  <Bell
                    size={26}
                  />
                }
                titulo="Nenhum aviso"
                texto="As notificações do salão aparecerão aqui."
              />
            ) : (
              <div className="space-y-2">
                {notificacoes.map(
                  (
                    notificacao
                  ) => (
                    <div
                      key={
                        notificacao.id
                      }
                      className={`bg-white rounded-2xl border p-4 shadow-sm ${
                        notificacao.lida
                          ? 'border-gray-100'
                          : 'border-pink-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            handleClicarNotificacao(
                              notificacao
                            )
                          }
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor:
                                  `${corSalao}18`,
                                color:
                                  corSalao
                              }}
                            >
                              <Bell
                                size={
                                  18
                                }
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm text-gray-800">
                                  {notificacao.titulo ||
                                    'Notificação'}
                                </h3>

                                {!notificacao.lida && (
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{
                                      backgroundColor:
                                        corSalao
                                    }}
                                  />
                                )}
                              </div>

                              <p className="text-sm text-gray-600 mt-1">
                                {notificacao.mensagem}
                              </p>

                              {notificacao.created_at && (
                                <p className="text-xs text-gray-400 mt-2">
                                  {new Date(
                                    notificacao.created_at
                                  ).toLocaleString(
                                    'pt-BR'
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            excluirNotificacao(
                              notificacao.id
                            )
                          }
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                        >
                          <Trash2
                            size={
                              17
                            }
                          />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {aba ===
          'excluidas' && (
          <section>
            {notificacoesExcluidas.length ===
            0 ? (
              <EmptyState
                icone={
                  <Trash2
                    size={26}
                  />
                }
                titulo="Lixeira vazia"
                texto="Notificações excluídas aparecerão aqui."
              />
            ) : (
              <div className="space-y-2">
                {notificacoesExcluidas.map(
                  (
                    notificacao
                  ) => (
                    <div
                      key={
                        notificacao.id
                      }
                      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                          <Trash2
                            size={
                              18
                            }
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-gray-800">
                            {notificacao.titulo ||
                              'Notificação'}
                          </h3>

                          <p className="text-sm text-gray-600 mt-1">
                            {notificacao.mensagem}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              restaurarNotificacao(
                                notificacao.id
                              )
                            }
                            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"
                            style={{
                              color:
                                corSalao
                            }}
                          >
                            <RotateCcw
                              size={
                                15
                              }
                            />
                            Restaurar
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {modalSugestao && (
        <ModalSugestao
          dados={
            modalSugestao
          }
          salvando={
            salvando
          }
          horariosLivres={
            horariosLivres
          }
          setHorariosLivres={
            setHorariosLivres
          }
          onFechar={() =>
            setModalSugestao(
              null
            )
          }
          onAceitar={(
            solicitacao,
            dataHora
          ) =>
            aceitarSolicitacao(
              solicitacao,
              dataHora
            )
          }
          onRecusar={
            recusarSolicitacao
          }
          onSugerir={
            sugerirHorarios
          }
          cor={
            corSalao
          }
        />
      )}

      {modalConfirmar && (
        <ModalAtendimento
          dados={
            modalConfirmar
          }
          coberturas={
            coberturas
          }
          setCoberturas={
            setCoberturas
          }
          servicoRealizado={
            servicoRealizado
          }
          setServicoRealizado={
            setServicoRealizado
          }
          salvando={
            salvando
          }
          carregandoCoberturas={
            carregandoCoberturas
          }
          sessaoJaRegistradaNoPacote={
            sessaoJaRegistradaNoPacote
          }
          possuiPacoteDisponivel={
            possuiPacoteDisponivel
          }
          opcaoConfirmacaoPacote={
            opcaoConfirmacaoPacote
          }
          setOpcaoConfirmacaoPacote={
            setOpcaoConfirmacaoPacote
          }
          onFechar={() =>
            setModalConfirmar(
              null
            )
          }
          onConfirmar={
            confirmarAtendimento
          }
          onNaoComparecimento={
            registrarNaoComparecimento
          }
          cor={
            corSalao
          }
        />
      )}
    </div>
  )
}

function TabButton({
  ativo,
  onClick,
  icone,
  titulo,
  contador,
  cor
}: {
  ativo: boolean
  onClick: () => void
  icone: React.ReactNode
  titulo: string
  contador: number
  cor: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-3 flex items-center justify-center gap-2 text-sm font-semibold transition ${
        ativo
          ? 'text-white shadow-sm'
          : 'text-gray-600 bg-white border border-gray-100 hover:bg-gray-50'
      }`}
      style={
        ativo
          ? {
              backgroundColor:
                cor
            }
          : undefined
      }
    >
      {icone}

      <span>
        {titulo}
      </span>

      {contador > 0 && (
        <span
          className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center ${
            ativo
              ? 'bg-white/20 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {contador}
        </span>
      )}
    </button>
  )
}

function EmptyState({
  icone,
  titulo,
  texto
}: {
  icone: React.ReactNode
  titulo: string
  texto: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center">
        {icone}
      </div>

      <h3 className="mt-4 font-semibold text-gray-800">
        {titulo}
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        {texto}
      </p>
    </div>
  )
}

function ModalSugestao({
  dados,
  salvando,
  horariosLivres,
  setHorariosLivres,
  onFechar,
  onAceitar,
  onRecusar,
  onSugerir,
  cor
}: any) {
  const solicitacao =
    dados?.solicitacao

  const [dataHora, setDataHora] =
    useState('')

  if (!solicitacao) {
    return null
  }

  const tipo =
    dados?.tipo

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">
              {tipo ===
              'recusar'
                ? 'Recusar pedido'
                : 'Pedido de agendamento'}
            </h2>

            <p className="text-xs text-gray-500 mt-0.5">
              {obterNomeClienteStatic(
                solicitacao
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={
              onFechar
            }
            className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center"
          >
            <X
              size={18}
            />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-800">
              {obterNomeServicoStatic(
                solicitacao
              )}
            </p>

            {formatarDataPreferidaStatic(
              solicitacao
            ) && (
              <p className="text-sm text-gray-600 mt-2">
                {formatarDataPreferidaStatic(
                  solicitacao
                )}
              </p>
            )}

            {formatarPeriodoPreferidoStatic(
              solicitacao
            ) && (
              <p className="text-sm text-gray-600 mt-1">
                {formatarPeriodoPreferidoStatic(
                  solicitacao
                )}
              </p>
            )}
          </div>

          {tipo !==
            'recusar' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Horário para confirmar
                </label>

                <input
                  type="datetime-local"
                  value={
                    dataHora
                  }
                  onChange={e =>
                    setDataHora(
                      e.target.value
                    )
                  }
                  className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2"
                  style={{
                    '--tw-ring-color':
                      `${cor}33`
                  } as React.CSSProperties}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Ou sugira até 3 horários
                </label>

                <div className="mt-2 space-y-2">
                  {horariosLivres.map(
                    (
                      horario: string,
                      index: number
                    ) => (
                      <input
                        key={
                          index
                        }
                        type="datetime-local"
                        value={
                          horario
                        }
                        onChange={e => {
                          const copia =
                            [
                              ...horariosLivres
                            ]
                          copia[
                            index
                          ] =
                            e.target.value
                          setHorariosLivres(
                            copia
                          )
                        }}
                        className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none"
                      />
                    )
                  )}
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={
                onFechar
              }
              className="h-11 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold"
            >
              Voltar
            </button>

            {tipo ===
            'recusar' ? (
              <button
                type="button"
                disabled={
                  salvando
                }
                onClick={() =>
                  onRecusar(
                    solicitacao
                  )
                }
                className="h-11 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {salvando
                  ? 'Recusando...'
                  : 'Recusar pedido'}
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  salvando ||
                  !dataHora
                }
                onClick={() =>
                  onAceitar(
                    solicitacao,
                    dataHora
                  )
                }
                className="h-11 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{
                  backgroundColor:
                    cor
                }}
              >
                {salvando
                  ? 'Salvando...'
                  : 'Confirmar horário'}
              </button>
            )}
          </div>

          {tipo !==
            'recusar' && (
            <button
              type="button"
              disabled={
                salvando ||
                !horariosLivres.some(
                  h =>
                    h &&
                    h.trim()
                )
              }
              onClick={() =>
                onSugerir(
                  solicitacao
                )
              }
              className="w-full h-11 rounded-xl border text-sm font-semibold disabled:opacity-50"
              style={{
                borderColor:
                  cor,
                color:
                  cor
              }}
            >
              {salvando
                ? 'Enviando...'
                : 'Enviar horários sugeridos'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalAtendimento({
  dados,
  coberturas,
  setCoberturas,
  servicoRealizado,
  setServicoRealizado,
  salvando,
  carregandoCoberturas,
  sessaoJaRegistradaNoPacote,
  possuiPacoteDisponivel,
  opcaoConfirmacaoPacote,
  setOpcaoConfirmacaoPacote,
  onFechar,
  onConfirmar,
  onNaoComparecimento,
  cor
}: any) {
  const [justificativa, setJustificativa] =
    useState('')

  const ehNaoComparecimento =
    dados?.tipo ===
    'nao_compareceu'

  const agendamento =
    ehNaoComparecimento
      ? dados?.agendamento
      : dados

  if (!agendamento) {
    return null
  }

  const clienteNome =
    agendamento?.clientes?.nome ||
    agendamento?.cliente_nome ||
    'Cliente'

  const servicoNome =
    agendamento?.servicos?.nome ||
    agendamento?.servico_nome ||
    'Atendimento'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-800">
              {ehNaoComparecimento
                ? 'Não comparecimento'
                : 'Confirmar atendimento'}
            </h2>

            <p className="text-xs text-gray-500 mt-0.5">
              {clienteNome}
            </p>
          </div>

          <button
            type="button"
            onClick={
              onFechar
            }
            className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center"
          >
            <X
              size={18}
            />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="font-semibold text-gray-800">
              {servicoNome}
            </p>

            {agendamento.data_hora && (
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Calendar
                    size={15}
                  />
                  {new Date(
                    agendamento.data_hora
                  ).toLocaleDateString(
                    'pt-BR'
                  )}
                </span>

                <span className="flex items-center gap-1.5">
                  <Clock
                    size={15}
                  />
                  {new Date(
                    agendamento.data_hora
                  ).toLocaleTimeString(
                    'pt-BR',
                    {
                      hour:
                        '2-digit',
                      minute:
                        '2-digit'
                    }
                  )}
                </span>
              </div>
            )}
          </div>

          {!ehNaoComparecimento && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Serviço realizado
              </label>

              <input
                type="text"
                value={
                  servicoRealizado
                }
                onChange={e =>
                  setServicoRealizado(
                    e.target.value
                  )
                }
                className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none"
              />
            </div>
          )}

          {ehNaoComparecimento && (
            <div>
              <label className="text-sm font-medium text-gray-700">
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
                rows={3}
                placeholder="Ex.: cliente não compareceu e não avisou."
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none resize-none"
              />
            </div>
          )}

          {carregandoCoberturas ? (
            <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
              Verificando pacote da cliente...
            </div>
          ) : (
            <>
              {!ehNaoComparecimento &&
                sessaoJaRegistradaNoPacote && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-semibold text-green-800">
                      Esta sessão já foi registrada no pacote.
                    </p>

                    <p className="text-xs text-green-700 mt-1">
                      Nenhuma nova sessão será descontada.
                    </p>
                  </div>
                )}

              {possuiPacoteDisponivel &&
                !sessaoJaRegistradaNoPacote && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        Pacote da cliente
                      </p>

                      <p className="text-xs text-gray-500 mt-0.5">
                        Escolha como deseja tratar as sessões.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setOpcaoConfirmacaoPacote(
                          'dar_baixa'
                        )
                      }
                      className={`w-full text-left rounded-2xl border p-4 transition ${
                        opcaoConfirmacaoPacote ===
                        'dar_baixa'
                          ? 'border-2'
                          : 'border-gray-200'
                      }`}
                      style={
                        opcaoConfirmacaoPacote ===
                        'dar_baixa'
                          ? {
                              borderColor:
                                cor,
                              backgroundColor:
                                `${cor}08`
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor:
                              `${cor}18`,
                            color:
                              cor
                          }}
                        >
                          <Check
                            size={
                              17
                            }
                          />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Dar baixa no pacote
                          </p>

                          <p className="text-xs text-gray-500 mt-1">
                            Desconta a sessão correspondente ao atendimento.
                          </p>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setOpcaoConfirmacaoPacote(
                          'apenas_confirmar'
                        )
                      }
                      className={`w-full text-left rounded-2xl border p-4 transition ${
                        opcaoConfirmacaoPacote ===
                        'apenas_confirmar'
                          ? 'border-2'
                          : 'border-gray-200'
                      }`}
                      style={
                        opcaoConfirmacaoPacote ===
                        'apenas_confirmar'
                          ? {
                              borderColor:
                                cor,
                              backgroundColor:
                                `${cor}08`
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                          <Check
                            size={
                              17
                            }
                          />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Apenas confirmar
                          </p>

                          <p className="text-xs text-gray-500 mt-1">
                            Confirma o atendimento sem descontar uma sessão agora.
                          </p>
                        </div>
                      </div>
                    </button>

                    {coberturas.length >
                      0 && (
                      <div className="space-y-2">
                        {coberturas.map(
                          (
                            cobertura: CoberturaServico
                          ) => (
                            <div
                              key={
                                cobertura.servicoId
                              }
                              className="rounded-2xl border border-gray-100 bg-gray-50 p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">
                                    {
                                      cobertura.servicoNome
                                    }
                                  </p>

                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    {
                                      cobertura.sessoesEquivalentes
                                    }{' '}
                                    sessão(ões)
                                  </p>
                                </div>

                                {cobertura.pacotesDisponiveis.length >
                                  0 && (
                                  <select
                                    value={
                                      cobertura.clientePacoteIdSelecionado ||
                                      ''
                                    }
                                    onChange={e => {
                                      setCoberturas(
                                        (
                                          anterior: CoberturaServico[]
                                        ) =>
                                          anterior.map(
                                            item =>
                                              item.servicoId ===
                                              cobertura.servicoId
                                                ? {
                                                    ...item,
                                                    clientePacoteIdSelecionado:
                                                      e
                                                        .target
                                                        .value ||
                                                      null
                                                  }
                                                : item
                                          )
                                      )
                                    }}
                                    className="max-w-[190px] h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs outline-none"
                                  >
                                    <option value="">
                                      Selecionar pacote
                                    </option>

                                    {cobertura.pacotesDisponiveis.map(
                                      pacote => (
                                        <option
                                          key={
                                            pacote.clientePacoteId
                                          }
                                          value={
                                            pacote.clientePacoteId
                                          }
                                        >
                                          {pacote.nome} —{' '}
                                          {
                                            pacote.sessoesRestantes
                                          }{' '}
                                          restantes
                                        </option>
                                      )
                                    )}
                                  </select>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

              {ehNaoComparecimento &&
                possuiPacoteDisponivel && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">
                      A cliente possui pacote disponível.
                    </p>

                    <p className="text-xs text-amber-700 mt-1">
                      Se desejar, a sessão poderá ser descontada por não comparecimento.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setOpcaoConfirmacaoPacote(
                          opcaoConfirmacaoPacote ===
                            'dar_baixa'
                            ? 'apenas_confirmar'
                            : 'dar_baixa'
                        )
                      }
                      className={`mt-3 w-full h-10 rounded-xl text-sm font-semibold ${
                        opcaoConfirmacaoPacote ===
                        'dar_baixa'
                          ? 'text-white'
                          : 'bg-white border border-amber-300 text-amber-800'
                      }`}
                      style={
                        opcaoConfirmacaoPacote ===
                        'dar_baixa'
                          ? {
                              backgroundColor:
                                cor
                            }
                          : undefined
                      }
                    >
                      {opcaoConfirmacaoPacote ===
                      'dar_baixa'
                        ? 'Descontar sessão do pacote'
                        : 'Descontar sessão do pacote'}
                    </button>
                  </div>
                )}
            </>
          )}

          <div className="pt-1">
            {ehNaoComparecimento ? (
              <button
                type="button"
                disabled={
                  salvando ||
                  carregandoCoberturas
                }
                onClick={() =>
                  onNaoComparecimento(
                    agendamento,
                    opcaoConfirmacaoPacote ===
                      'dar_baixa',
                    justificativa
                  )
                }
                className="w-full h-12 rounded-xl bg-red-500 text-white font-semibold text-sm disabled:opacity-50"
              >
                {salvando
                  ? 'Salvando...'
                  : 'Marcar como não veio'}
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  salvando ||
                  carregandoCoberturas
                }
                onClick={
                  onConfirmar
                }
                className="w-full h-12 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                style={{
                  backgroundColor:
                    cor
                }}
              >
                {salvando
                  ? 'Confirmando...'
                  : 'Confirmar atendimento'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function obterNomeClienteStatic(
  item: any
) {
  return (
    item?.clientes?.nome ||
    item?.cliente_nome ||
    'Cliente'
  )
}

function obterNomeServicoStatic(
  item: any
) {
  return (
    item?.servicos?.nome ||
    item?.servico_nome ||
    'Atendimento'
  )
}

function formatarDataPreferidaStatic(
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

function formatarPeriodoPreferidoStatic(
  solicitacao: any
) {
  const periodo =
    solicitacao?.periodo_preferido ??
    solicitacao?.periodo_desejado ??
    solicitacao?.periodo ??
    solicitacao?.turno

  if (!periodo) {
    return null
  }

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
    valor.charAt(
      0
    ).toUpperCase() +
      valor.slice(
        1
      )
  )
}
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
    for (const cobertura of coberturasAtuais) {
      let quantidadeRestante =
        Number(
          cobertura.sessoesEquivalentes || 1
        )
      if (quantidadeRestante <= 0) {
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
              ) >= quantidadeRestante
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
            pacoteSelecionado.sessoes_restantes || 0
          )
        if (restantesAntes <= 0) {
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
        const desconto = Math.min(
          quantidadeRestante,
          restantesAntes
        )
        const restantesDepois =
          restantesAntes - desconto
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
                registro?.agendamento_id || ''
              ) === String(agendamento.id)
          )
        if (jaRegistrado) {
          quantidadeRestante = 0
          break
        }
        historico.push({
          tipo:
            'nao_comparecimento',
          data: dataRegistro,
          quantidade: desconto,
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
                  p.sessoes_restantes || 0
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
          data_hora: dataHora,
          status: 'confirmado',
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
        url: '/cliente'
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
    const motivo =
      window.prompt(
        'Informe o motivo da recusa:'
      )
    if (motivo === null) return
    setSalvando(true)
    try {
      const { error } =
        await supabase
          .from(
            'solicitacoes_agendamento'
          )
          .update({
            status:
              'recusado',
            motivo_recusa:
              motivo || null
          })
          .eq(
            'id',
            solicitacao.id
          )
          .eq(
            'salao_id',
            profile.salao_id
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
          'Solicitação recusada',
        mensagem: `A solicitação de ${
          solicitacao.clientes?.nome ||
          'cliente'
        } foi recusada.`,
        destinatario_id:
          solicitacao.cliente_id ||
          null,
        url: '/cliente'
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
  // ─── SUGESTÃO DE HORÁRIOS ────────────────────────────────────────────
  async function salvarSugestaoHorario() {
    if (
      !modalSugestao ||
      !profile?.salao_id
    ) {
      return
    }
    const horarios =
      horariosLivres.filter(
        h => h.trim()
      )
    if (!horarios.length) {
      alert(
        'Informe pelo menos um horário.'
      )
      return
    }
    setSalvando(true)
    try {
      const { error } =
        await supabase
          .from(
            'solicitacoes_agendamento'
          )
          .update({
            status:
              'horario_sugerido',
            horarios_sugeridos:
              horarios
          })
          .eq(
            'id',
            modalSugestao.id
          )
          .eq(
            'salao_id',
            profile.salao_id
          )
      if (error) {
        throw error
      }
      await notificar({
        salao_id:
          profile.salao_id,
        tipo:
          'horarios_sugeridos',
        titulo:
          'Novos horários disponíveis',
        mensagem: `O salão enviou novos horários para ${
          modalSugestao.clientes?.nome ||
          'você'
        }.`,
        destinatario_id:
          modalSugestao.cliente_id ||
          null,
        url: '/cliente'
      })
      setModalSugestao(null)
      setHorariosLivres([
        '',
        '',
        ''
      ])
      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao salvar sugestão:',
        error
      )
      alert(
        error?.message ||
          'Não foi possível enviar os horários.'
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
      const { error } =
        await supabase
          .from('notificacoes')
          .update({
            excluida: true
          })
          .eq(
            'id',
            notificacao.id
          )
          .eq(
            'salao_id',
            profile.salao_id
          )
      if (error) throw error
      setNotificacoes(prev =>
        prev.filter(
          item =>
            item.id !==
            notificacao.id
        )
      )
      setNotificacoesExcluidas(
        prev => [
          notificacao,
          ...prev.filter(
            item =>
              item.id !==
              notificacao.id
          )
        ]
      )
    } catch (error: any) {
      console.error(error)
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
      const { error } =
        await supabase
          .from('notificacoes')
          .update({
            excluida: false
          })
          .eq(
            'id',
            notificacao.id
          )
          .eq(
            'salao_id',
            profile.salao_id
          )
      if (error) throw error
      setNotificacoesExcluidas(
        prev =>
          prev.filter(
            item =>
              item.id !==
              notificacao.id
          )
      )
      setNotificacoes(prev => [
        {
          ...notificacao,
          excluida: false
        },
        ...prev
      ])
    } catch (error: any) {
      console.error(error)
      alert(
        error?.message ||
          'Não foi possível restaurar a notificação.'
      )
    }
  }
        error?.message ||
          'Não foi possível restaurar a notificação.'
      )
    }
  }
  async function limparNotificacoes() {
    if (
      !profile?.salao_id ||
      notificacoes.length === 0
    ) {
      return
    }
    if (
      !window.confirm(
        'Deseja excluir todas as notificações?'
      )
    ) {
      return
    }
    try {
      const { error } =
        await supabase
          .from('notificacoes')
          .update({
            excluida: true
          })
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
      if (error) throw error
      await carregarDados()
    } catch (error: any) {
      console.error(error)
      alert(
        error?.message ||
          'Não foi possível limpar as notificações.'
      )
    }
  }
  // ─── FORMATADORES ────────────────────────────────────────────────────
  function formatarDataHora(
    valor: string | null | undefined
  ) {
    if (!valor) return ''
    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) {
      return ''
    }
    return (
      data.toLocaleDateString(
        'pt-BR',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }
      ) +
      ' às ' +
      data.toLocaleTimeString(
        'pt-BR',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      )
    )
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
  function obterTelefoneCliente(
    item: any
  ) {
    return (
      item?.clientes?.telefone ||
      item?.telefone ||
      ''
    )
  }
  function abrirWhatsApp(
    telefone: string
  ) {
    if (!telefone) return
    const numero =
      telefone.replace(/\D/g, '')
    if (!numero) return
    const numeroFinal =
      numero.startsWith('55')
        ? numero
        : `55${numero}`
    window.open(
      `https://wa.me/${numeroFinal}`,
      '_blank'
    )
  }
  // ─── LOADING ─────────────────────────────────────────────────────────
  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-
[#f8faf8]">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 
border-t-[#E91E8C] animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Carregando...
          </p>
        </div>
      </div>
    )
  }
  const quantidadeSolicitacoes =
    solicitacoes.length
  const quantidadeConfirmacoes =
    confirmacoes.length
  const quantidadeNotificacoes =
    notificacoes.filter(
      n => !n.lida
    ).length
  return (
    <div
      className="min-h-screen bg-[#f8f8f8] text-gray-900"
      style={
        {
          '--cor-salao': '#E91E8C'
        } as any
      }
    >
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b 
border-[#e8e8e8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full bg-[#f7f7f7] flex items-center 
justify-center text-[var(--cor-salao)]"
            >
              <ArrowLeft size={19} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                Central de Atendimento
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
                {salao?.nome ||
                  'Gerencie seus atendimentos'}
              </p>
            </div>
          </div>
        </div>
      </header>
      {/* ABAS */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5">
        <div className="bg-white rounded-2xl border border-[#e8e8e8] p-1.5 flex 
gap-1 overflow-x-auto">
          <TabButton
            ativo={aba === 'pedidos'}
            onClick={() =>
              setAba('pedidos')
            }
            icon={<Calendar size={16} />}
            label="Pedidos"
            quantidade={
              quantidadeSolicitacoes
            }
          />
          <TabButton
            ativo={
              aba === 'confirmacoes'
            }
            onClick={() =>
              setAba('confirmacoes')
            }
            icon={<Check size={16} />}
            label="Confirmar"
            quantidade={
              quantidadeConfirmacoes
            }
          />
          <TabButton
            ativo={
              aba === 'notificacoes'
            }
            onClick={() =>
              setAba('notificacoes')
            }
            icon={<Bell size={16} />}
            label="Notificações"
            quantidade={
              quantidadeNotificacoes
            }
          />
          <TabButton
            ativo={
              aba === 'excluidas'
            }
            onClick={() =>
              setAba('excluidas')
            }
            icon={<Trash2 size={16} />}
            label="Excluídas"
            quantidade={
              notificacoesExcluidas.length
            }
          />
        </div>
      </div>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* PEDIDOS */}
        {aba === 'pedidos' && (
          <section>
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Solicitações de agendamento
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Pedidos enviados pelas clientes.
              </p>
            </div>
            {solicitacoes.length === 0 ? (
              <EmptyState
                icon={<Calendar size={30} />}
                title="Nenhuma solicitação pendente"
                text="Novos pedidos aparecerão aqui."
              />
            ) : (
              <div className="space-y-4">
                {solicitacoes.map(
                  (solicitacao: any) => (
                    <div
                      key={solicitacao.id}
                      className="bg-white border border-[#e8e8e8] rounded-2xl p-
4 sm:p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">
                            {obterNomeCliente(
                              solicitacao
                            )}
                          </h3>
                          {solicitacao.clientes?.telefone && (
                            <p className="text-xs text-gray-500 mt-1">
                              {
                                solicitacao.clientes.telefone
                              }
                            </p>
                          )}
                        </div>
                        {solicitacao.status ===
                          'horario_sugerido' && (
                          <span className="shrink-0 px-2.5 py-1 rounded-full bg-
[#fff5df] text-[#946b1c] text-xs font-medium">
                            Horários sugeridos
                          </span>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-
3">
                        <InfoBox
                          label="Serviço"
                          value={
                            solicitacao.servicos?.nome ||
                            solicitacao.servico_nome ||
                            'Serviço'
                          }
                        />
                        <InfoBox
                          label="Data desejada"
                          value={
                            formatarDataPreferida(
                              solicitacao
                            ) ||
                            'Não informada'
                          }
                        />
                        <InfoBox
                          label="Período"
                          value={
                            formatarPeriodoPreferido(
                              solicitacao
                            ) ||
                            'Não informado'
                          }
                        />
                        {solicitacao.observacoes && (
                          <InfoBox
                            label="Observações"
                            value={
                              solicitacao.observacoes
                            }
                          />
                        )}
                      </div>
                      {Array.isArray(
                        solicitacao.horarios_sugeridos
                      ) &&
                        solicitacao.horarios_sugeridos.length >
                          0 && (
                          <div className="mt-4 rounded-xl bg-[#f7f7f7] p-3">
                            <p className="text-xs font-semibold text-[var(--cor-salao)] 
mb-2">
                              Horários enviados
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {solicitacao.horarios_sugeridos.map(
                                (
                                  horario: string,
                                  index: number
                                ) => (
                                  <span
                                    key={index}
                                    className="px-3 py-1.5 bg-white border 
border-[#e6e6e6] rounded-lg text-sm"
                                  >
                                    {horario}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      <div className="mt-5 flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() =>
                            aceitarSolicitacao(
                              solicitacao
                            )
                          }
                          className="flex-1 h-11 rounded-xl bg-[var(--cor-salao)] text-
white text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-
2">
                            <Check size={17} />
                            Aceitar
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() => {
                            setModalSugestao(
                              solicitacao
                            )
                            setHorariosLivres([
                              '',
                              '',
                              ''
                            ])
                          }}
                          className="flex-1 h-11 rounded-xl border border-
[#dbe5dc] bg-white text-[var(--cor-salao)] text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-
2">
                            <Clock size={17} />
                            Sugerir horários
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() =>
                            recusarSolicitacao(
                              solicitacao
                            )
                          }
                          className="h-11 px-5 rounded-xl border border-
[#eadada] bg-white text-[#9b5e5e] text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-
2">
                            <X size={17} />
                            Recusar
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}
        {/* CONFIRMAÇÕES */}
        {aba === 'confirmacoes' && (
          <section>
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Confirmar atendimentos
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Confirme quem realmente compareceu ou registre o não 
comparecimento.
              </p>
            </div>
            {confirmacoes.length === 0 ? (
              <EmptyState
                icon={<Check size={30} />}
                title="Tudo em dia"
                text="Não há atendimentos aguardando confirmação."
              />
            ) : (
              <div className="space-y-4">
                {confirmacoes.map(
                  (agendamento: any) => (
                    <div
                      key={agendamento.id}
                      className="bg-white border border-[#e8e8e8] rounded-2xl p-
4 sm:p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold">
                            {obterNomeCliente(
                              agendamento
                            )}
                          </h3>
                          {obterTelefoneCliente(
                            agendamento
                          ) && (
                            <button
                              type="button"
                              onClick={() =>
                                abrirWhatsApp(
                                  obterTelefoneCliente(
                                    agendamento
                                  )
                                )
                              }
                              className="mt-1 inline-flex items-center gap-1.5 
text-xs text-[var(--cor-salao)] hover:underline"
                            >
                              <MessageCircle
                                size={13}
                              />
                              {
                                obterTelefoneCliente(
                                  agendamento
                                )
                              }
                            </button>
                          )}
                        </div>
                        <span className="shrink-0 px-2.5 py-1 rounded-full bg-
[#fff5df] text-[#946b1c] text-xs font-medium">
                          Aguardando
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-
3">
                        <InfoBox
                          label="Data"
                          value={formatarDataHora(
                            agendamento.data_hora
                          )}
                        />
                        <InfoBox
                          label="Serviço"
                          value={
                            agendamento.servicos?.nome ||
                            agendamento.servico_nome ||
                            'Atendimento'
                          }
                        />
                      </div>
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-
2">
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() =>
                            iniciarNaoComparecimento(
                              agendamento
                            )
                          }
                          className="h-11 rounded-xl border border-[#eadada] bg-
white text-[#9b5e5e] text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-
2">
                            <X size={17} />
                            Não veio
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={
                            salvando ||
                            verificandoPacoteConfirmacao
                          }
                          onClick={() =>
                            abrirModalConfirmar(
                              agendamento
                            )
                          }
                          className="h-11 rounded-xl bg-[var(--cor-salao)] text-white 
text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-
2">
                            <Check size={17} />
                            Confirmar atendimento
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}
        {/* NOTIFICAÇÕES */}
        {aba === 'notificacoes' && (
          <section>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-semibold">
                  Notificações
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Avisos e atualizações do salão.
                </p>
              </div>
              {notificacoes.length > 0 && (
                <button
                  type="button"
                  onClick={
                    limparNotificacoes
                  }
                  className="text-xs font-medium text-[#9b5e5e] hover:underline"
                >
                  Limpar tudo
                </button>
              )}
            </div>
            {notificacoes.length === 0 ? (
              <EmptyState
                icon={<Bell size={30} />}
                title="Nenhuma notificação"
                text="Você está em dia."
              />
            ) : (
              <div className="space-y-3">
                {notificacoes.map(
                  (notificacao: any) => (
                    <div
                      key={
                        notificacao.id
                      }
                      className={`bg-white border rounded-2xl p-4 ${
                        notificacao.lida
                          ? 'border-[#e8e8e8]'
                          : 'border-[#e6e6e6] shadow-sm'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleClicarNotificacao(
                            notificacao
                          )
                        }
                        className="w-full text-left"
                      >
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full flex items-
center justify-center shrink-0 bg-[#f7f7f7] text-[var(--cor-salao)]">
                            <Bell size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between 
gap-2">
                              <p className="font-semibold text-sm">
                                {
                                  notificacao.titulo
                                }
                              </p>
                              {!notificacao.lida && (
                                <span className="w-2 h-2 rounded-full bg-
[var(--cor-salao)] shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {
                                notificacao.mensagem
                              }
                            </p>
                            {notificacao.created_at && (
                              <p className="text-[11px] text-gray-400 mt-2">
                                {formatarDataHora(
                                  notificacao.created_at
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            excluirNotificacao(
                              notificacao
                            )
                          }
                          className="text-xs text-gray-400 hover:text-[#9b5e5e]"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}
        {/* EXCLUÍDAS */}
        {aba === 'excluidas' && (
          <section>
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Notificações excluídas
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Notificações que foram removidas da central.
              </p>
            </div>
            {notificacoesExcluidas.length === 0 ? (
              <EmptyState
                icon={<Trash2 size={30} />}
                title="Nenhuma notificação excluída"
              />
            ) : (
              <div className="space-y-3">
                {notificacoesExcluidas.map(
                  (notificacao: any) => (
                    <div
                      key={
                        notificacao.id
                      }
                      className="bg-white border border-[#e8e8e8] rounded-2xl p-
4"
                    >
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#f7f7f7] 
text-gray-400 flex items-center justify-center shrink-0">
                          <Trash2 size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">
                            {
                              notificacao.titulo
                            }
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {
                              notificacao.mensagem
                            }
                          </p>
                          {notificacao.created_at && (
                            <p className="text-[11px] text-gray-400 mt-2">
                              {formatarDataHora(
                                notificacao.created_at
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            restaurarNotificacao(
                              notificacao
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs 
font-medium text-[var(--cor-salao)]"
                        >
                          <RotateCcw size={13} />
                          Restaurar
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}
      </main>
      {/* MODAL SUGERIR HORÁRIOS */}
      {modalSugestao && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-
center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-
3xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#e8e8e8] flex items-center 
justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  Sugerir horários
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {obterNomeCliente(
                    modalSugestao
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setModalSugestao(null)
                }
                className="w-9 h-9 rounded-full bg-[#f7f7f7] flex items-center 
justify-center text-gray-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Informe até três horários que podem funcionar para a cliente.
              </p>
              <div className="space-y-3">
                {horariosLivres.map(
                  (
                    horario,
                    index
                  ) => (
                    <div key={index}>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 
block">
                        Horário {index + 1}
                      </label>
                      <input
                        type="datetime-local"
                        value={horario}
                        onChange={e => {
                          const novos = [
                            ...horariosLivres
                          ]
                          novos[index] =
                            e.target.value
                          setHorariosLivres(
                            novos
                          )
                        }}
                        className="w-full h-11 rounded-xl border border-
[#e2e2e2] px-3 text-sm outline-none"
                      />
                    </div>
                  )
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setModalSugestao(null)
                  }
                  className="h-11 rounded-xl border border-[#e2e2e2] text-sm 
font-semibold text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={
                    salvarSugestaoHorario
                  }
                  className="h-11 rounded-xl bg-[var(--cor-salao)] text-white text-sm 
font-semibold disabled:opacity-50"
                >
                  Enviar horários
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL CONFIRMAR / NÃO COMPARECEU */}
      {modalConfirmar && (
        <ModalAtendimento
          modalConfirmar={
            modalConfirmar
          }
          salvando={
            salvando
          }
          servicoRealizado={
            servicoRealizado
          }
          setServicoRealizado={
            setServicoRealizado
          }
          coberturas={
            coberturas
          }
          carregandoCoberturas={
            carregandoCoberturas
          }
          sessaoJaRegistradaNoPacote={
            sessaoJaRegistradaNoPacote
          }
          possuiPacoteDisponivel={
            possuiPacoteDisponivel
          }
          opcaoConfirmacaoPacote={
            opcaoConfirmacaoPacote
          }
          setOpcaoConfirmacaoPacote={
            setOpcaoConfirmacaoPacote
          }
          verificandoPacoteConfirmacao={
            verificandoPacoteConfirmacao
          }
          onClose={() =>
            setModalConfirmar(null)
          }
          onConfirmar={
            confirmarAtendimento
          }
          onNaoComparecimento={
            registrarNaoComparecimento
          }
        />
      )}
    </div>
  )
}
// ────────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ────────────────────────────────────────────────────────────────────────
function TabButton({
  ativo,
  onClick,
  icon,
  label,
  quantidade
}: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 min-w-[110px] rounded-xl px-3 py-2.5 text-sm font-
medium transition ${
        ativo
          ? 'bg-[var(--cor-salao)] text-white shadow-sm'
          : 'text-gray-600 hover:bg-[#f7f7f7]'
      }`}
    >
      <span className="flex items-center justify-center gap-2">
        {icon}
        {label}
        {quantidade > 0 && (
          <span
            className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] flex items-
center justify-center ${
              ativo
                ? 'bg-white/20 text-white'
                : 'bg-[#f5f5f5] text-[var(--cor-salao)]'
            }`}
          >
            {quantidade}
          </span>
        )}
      </span>
    </button>
  )
}
function InfoBox({
  label,
  value
}: any) {
  return (
    <div className="rounded-xl bg-[#f8f8f8] p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="text-sm font-medium mt-1">
        {value}
      </p>
    </div>
  )
}
function EmptyState({
  icon,
  title,
  text
}: any) {
  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-
center">
      <div className="mx-auto text-gray-300 mb-3 w-fit">
        {icon}
      </div>
      <p className="font-medium text-gray-700">
        {title}
      </p>
      {text && (
        <p className="text-sm text-gray-500 mt-1">
          {text}
        </p>
      )}
    </div>
  )
}
// ────────────────────────────────────────────────────────────────────────
// MODAL DE ATENDIMENTO
// ────────────────────────────────────────────────────────────────────────
function ModalAtendimento({
  modalConfirmar,
  salvando,
  servicoRealizado,
  setServicoRealizado,
  coberturas,
  carregandoCoberturas,
  sessaoJaRegistradaNoPacote,
  possuiPacoteDisponivel,
  opcaoConfirmacaoPacote,
  setOpcaoConfirmacaoPacote,
  verificandoPacoteConfirmacao,
  onClose,
  onConfirmar,
  onNaoComparecimento
}: any) {
  const [
    etapaNaoCompareceu,
    setEtapaNaoCompareceu
  ] = useState<
    'pergunta_aviso' |
    'pergunta_pacote' |
    'justificativa'
  >('pergunta_aviso')
  const [
    avisouComAntecedencia,
    setAvisouComAntecedencia
  ] = useState<boolean | null>(null)
  const [
    descontarPacote,
    setDescontarPacote
  ] = useState<boolean | null>(null)
  const [
    justificativa,
    setJustificativa
  ] = useState('')
  const isNaoComparecimento =
    modalConfirmar?.tipo ===
    'nao_compareceu'
  const agendamento =
    isNaoComparecimento
      ? modalConfirmar?.agendamento
      : modalConfirmar
  useEffect(() => {
    if (isNaoComparecimento) {
      setEtapaNaoCompareceu(
        'pergunta_aviso'
      )
      setAvisouComAntecedencia(
        null
      )
      setDescontarPacote(
        null
      )
      setJustificativa('')
    }
  }, [
    modalConfirmar?.agendamento?.id,
    isNaoComparecimento
  ])
  function fechar() {
    if (salvando) return
    onClose()
  }
  function selecionarAviso(
    avisou: boolean
    }
    if (avisou === false) {
      setEtapaNaoCompareceu(
        'pergunta_pacote'
      )
      setDescontarPacote(null)
      return
    }
    setEtapaNaoCompareceu(
      'justificativa'
    )
  }
  function selecionarDesconto(
    descontar: boolean
  ) {
    setDescontarPacote(
      descontar
    )
    setEtapaNaoCompareceu(
      'justificativa'
    )
  }
  async function finalizarNaoComparecimento() {
    await onNaoComparecimento(
      agendamento,
      avisouComAntecedencia,
      descontarPacote,
      justificativa
    )
  }
  if (!agendamento) return null
  const nomeCliente =
    agendamento.clientes?.nome ||
    agendamento.cliente_nome ||
    'Cliente'
  const nomeServico =
    agendamento.servicos?.nome ||
    agendamento.servico_nome ||
    'Atendimento'
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center 
justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl 
shadow-xl overflow-hidden max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b border-[#e8e8e8] flex items-center 
justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-lg">
              {isNaoComparecimento
                ? 'Registrar não comparecimento'
                : 'Confirmar atendimento'}
            </h3>
            <p className="text-sm text-gray-500 mt-1 truncate">
              {nomeCliente} · {nomeServico}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="w-9 h-9 rounded-full bg-[#f7f7f7] flex items-center justify-
center text-gray-500 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {!isNaoComparecimento ? (
          <div className="p-5">
            <div className="rounded-2xl bg-[#f8f8f8] p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Atendimento
              </p>
              <p className="font-semibold mt-1">
                {nomeServico}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {formatarDataHora(
                  agendamento.data_hora
                )}
              </p>
            </div>

            <div className="mt-5">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Serviço realizado
              </label>
              <input
                type="text"
                value={servicoRealizado}
                onChange={e =>
                  setServicoRealizado(
                    e.target.value
                  )
                }
                placeholder={nomeServico}
                className="w-full h-11 rounded-xl border border-[#e2e2e2] px-3 text-sm 
outline-none focus:ring-2 focus:ring-[var(--cor-salao)]/20"
              />
            </div>

            {carregandoCoberturas || verificandoPacoteConfirmacao ? (
              <div className="mt-5 rounded-2xl bg-[#f8f8f8] p-4">
                <p className="text-sm text-gray-500">
                  Verificando pacotes da cliente...
                </p>
              </div>
            ) : sessaoJaRegistradaNoPacote ? (
              <div className="mt-5 rounded-2xl border border-[#eadfba] bg-[#fffaf0] 
p-4">
                <p className="text-sm font-semibold text-[#80631f]">
                  Esta sessão já foi registrada em um pacote.
                </p>
                <p className="text-xs text-[#8d7946] mt-1">
                  O sistema não fará uma nova baixa para evitar desconto duplicado.
                </p>
              </div>
            ) : possuiPacoteDisponivel &&
              coberturas.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-gray-700">
                  Pacote da cliente
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Escolha como deseja registrar o atendimento.
                </p>

                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOpcaoConfirmacaoPacote(
                        'dar_baixa'
                      )
                    }
                    className={`w-full text-left rounded-2xl border p-4 transition ${
                      opcaoConfirmacaoPacote ===
                      'dar_baixa'
                        ? 'border-[var(--cor-salao)] bg-[var(--cor-salao)]/5'
                        : 'border-[#e5e5e5] bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center 
justify-center mt-0.5 ${
                          opcaoConfirmacaoPacote ===
                          'dar_baixa'
                            ? 'border-[var(--cor-salao)]'
                            : 'border-gray-300'
                        }`}
                      >
                        {opcaoConfirmacaoPacote ===
                          'dar_baixa' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--cor-
salao)]" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          Dar baixa no pacote
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Registrar esta sessão como utilizada.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setOpcaoConfirmacaoPacote(
                        'apenas_confirmar'
                      )
                    }
                    className={`w-full text-left rounded-2xl border p-4 transition ${
                      opcaoConfirmacaoPacote ===
                      'apenas_confirmar'
                        ? 'border-[var(--cor-salao)] bg-[var(--cor-salao)]/5'
                        : 'border-[#e5e5e5] bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center 
justify-center mt-0.5 ${
                          opcaoConfirmacaoPacote ===
                          'apenas_confirmar'
                            ? 'border-[var(--cor-salao)]'
                            : 'border-gray-300'
                        }`}
                      >
                        {opcaoConfirmacaoPacote ===
                          'apenas_confirmar' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--cor-
salao)]" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          Apenas confirmar
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Confirmar o atendimento sem descontar uma sessão.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {coberturas.map(
                  (
                    cobertura,
                    index
                  ) => (
                    <div
                      key={`${cobertura.servicoNome}-${index}`}
                      className="mt-3 rounded-xl bg-[#f8f8f8] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-gray-700">
                          {cobertura.servicoNome}
                        </p>
                        <span className="text-xs text-gray-500">
                          {cobertura.sessoesEquivalentes}{' '}
                          {cobertura.sessoesEquivalentes ===
                          1
                            ? 'sessão'
                            : 'sessões'}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-[#f8f8f8] p-4">
                <p className="text-sm text-gray-600">
                  Nenhum pacote disponível para este atendimento.
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={
                salvando ||
                verificandoPacoteConfirmacao
              }
              onClick={() =>
                onConfirmar(
                  agendamento,
                  opcaoConfirmacaoPacote
                )
              }
              className="w-full h-12 mt-5 rounded-xl bg-[var(--cor-salao)] text-white 
font-semibold text-sm disabled:opacity-50"
            >
              {salvando
                ? 'Salvando...'
                : 'Confirmar atendimento'}
            </button>

            <button
              type="button"
              disabled={salvando}
              onClick={fechar}
              className="w-full h-11 mt-2 rounded-xl text-sm font-semibold text-
gray-500"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="p-5">
            {etapaNaoCompareceu ===
              'pergunta_aviso' && (
              <>
                <div className="rounded-2xl bg-[#fff7f7] border border-[#f0dede] p-4">
                  <p className="text-sm font-semibold text-[#875656]">
                    A cliente avisou que não viria?
                  </p>
                  <p className="text-xs text-[#9a6b6b] mt-1">
                    Esta informação ajuda o salão a decidir se haverá desconto no
                    pacote.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() =>
                      selecionarAviso(
                        true
                      )
                    }
                    className="h-11 rounded-xl border border-[#e2e2e2] bg-white text-
sm font-semibold text-gray-700"
                  >
                    Sim, avisou
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() =>
                      selecionarAviso(
                        false
                      )
                    }
                    className="h-11 rounded-xl bg-[#9b5e5e] text-white text-sm font-
semibold"
                  >
                    Não avisou
                  </button>
                </div>
              </>
            )}

            {etapaNaoCompareceu ===
              'pergunta_pacote' && (
              <>
                <div className="rounded-2xl bg-[#fff7f7] border border-[#f0dede] p-4">
                  <p className="text-sm font-semibold text-[#875656]">
                    Descontar a sessão do pacote?
                  </p>
                  <p className="text-xs text-[#9a6b6b] mt-1">
                    Como a cliente não avisou com antecedência, você pode escolher
                    se esta falta consumirá uma sessão.
                  </p>
                </div>

                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() =>
                      selecionarDesconto(
                        true
                      )
                    }
                    className="w-full h-11 rounded-xl bg-[var(--cor-salao)] text-white 
text-sm font-semibold"
                  >
                    Sim, descontar sessão
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() =>
                      selecionarDesconto(
                        false
                      )
                    }
                    className="w-full h-11 rounded-xl border border-[#e2e2e2] bg-white 
text-sm font-semibold text-gray-700"
                  >
                    Não descontar
                  </button>
                </div>
              </>
            )}

            {etapaNaoCompareceu ===
              'justificativa' && (
              <>
                <div className="rounded-2xl bg-[#fff7f7] border border-[#f0dede] p-4">
                  <p className="text-sm font-semibold text-[#875656]">
                    Registrar o não comparecimento
                  </p>
                  <p className="text-xs text-[#9a6b6b] mt-1">
                    Você pode deixar uma observação para o histórico da cliente.
                  </p>
                </div>

                <div className="mt-5">
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Observação
                  </label>
                  <textarea
                    value={justificativa}
                    onChange={e =>
                      setJustificativa(
                        e.target.value
                      )
                    }
                    rows={4}
                    placeholder="Ex.: Cliente não compareceu e não avisou."
                    className="w-full rounded-xl border border-[#e2e2e2] px-3 py-3 
text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--cor-salao)]/20"
                  />
                </div>

                <div className="mt-5">
                  <div className="rounded-xl bg-[#f8f8f8] p-3">
                    <p className="text-xs text-gray-500">
                      Cliente
                    </p>
                    <p className="text-sm font-semibold mt-0.5">
                      {nomeCliente}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {formatarDataHora(
                        agendamento.data_hora
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={salvando}
                  onClick={
                    finalizarNaoComparecimento
                  }
                  className="w-full h-12 mt-5 rounded-xl bg-[#9b5e5e] text-white font-
semibold text-sm disabled:opacity-50"
                >
                  {salvando
                    ? 'Salvando...'
                    : 'Registrar não comparecimento'}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={salvando}
              onClick={fechar}
              className="w-full h-11 mt-2 rounded-xl text-sm font-semibold text-
gray-500"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}