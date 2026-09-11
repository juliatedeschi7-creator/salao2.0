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
  const [tevePacoteAnterior, setTevePacoteAnterior] =
    useState(false)
  const [respostaNovoPacote, setRespostaNovoPacote] = useState<
    'perguntar' | 'sim' | 'nao'
  >('perguntar')
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

    const tevePacoteAnterior = pacotes.some(
      (pacote: any) =>
        pacote.status === 'concluido' ||
        Number(pacote.sessoes_restantes || 0) <= 0
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
          possuiPacote,
          tevePacoteAnterior
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
          possuiPacote,
          tevePacoteAnterior
        }
      }
    }

    return {
      registrada: false,
      possuiPacote,
      tevePacoteAnterior
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
          clientePacoteId:
            pacote.id,
          nome:
            pacote.servico ||
            'Pacote',
          sessoesRestantes:
            Number(
              pacote.sessoes_restantes || 0
            )
        }))
        .filter(
          pacote =>
            pacote.sessoesRestantes > 0
        )
    if (idsServicos.length === 0) {
      return [
        {
          servicoId:
            agendamento.servico_id ||
            'geral',
          servicoNome:
            agendamento.servicos?.nome ||
            'Atendimento',
          sessoesEquivalentes: 1,
          clientePacoteIdSelecionado:
            opcoesGerais[0]?.clientePacoteId ||
            null,
          pacotesDisponiveis:
            opcoesGerais
        }
      ]
    }
    return idsServicos.map(id => {
      const srv =
        (servicosInfo || []).find(
          (s: any) =>
            s.id === id
        )
      return {
        servicoId: id,
        servicoNome:
          srv?.nome ||
          'Serviço',
        sessoesEquivalentes:
          Number(
            srv?.sessoes_equivalentes ?? 1
          ),
        clientePacoteIdSelecionado:
          opcoesGerais[0]?.clientePacoteId ||
          null,
        pacotesDisponiveis:
          opcoesGerais
      }
    })
  }
  // ─── ABRIR CONFIRMAÇÃO ───────────────────────────────────────────────
  async function abrirModalConfirmar(
    agendamento: any
  ) {
    setVerificandoPacoteConfirmacao(true)
    setModalConfirmar(null)
    setSessaoJaRegistradaNoPacote(false)
    setPossuiPacoteDisponivel(false)
    setTevePacoteAnterior(false)
    setRespostaNovoPacote('perguntar')
    setOpcaoConfirmacaoPacote('perguntar')
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
      setTevePacoteAnterior(
        resultado.tevePacoteAnterior
      )
      if (resultado.registrada) {
        setOpcaoConfirmacaoPacote(
          'apenas_confirmar'
        )
      } else {
        const dados =
          await montarCoberturas(
            agendamento
          )
        setCoberturas(dados)
      }
    } catch (error) {
      console.error(
        'Erro ao verificar pacote:',
        error
      )
    } finally {
      setVerificandoPacoteConfirmacao(false)
      setModalConfirmar(agendamento)
    }
  }
  // ─── VERIFICAÇÃO DUPLA DA CONFIRMAÇÃO ────────────────────────────────
  async function verificarConfirmacaoAtendimento(
    agendamentoId: string
  ) {
    if (!profile?.salao_id) return false
    const { data, error } = await supabase
      .from('confirmacoes_atendimento')
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
    if (!pacotes.length) {
      return
    }
    // PROTEÇÃO ABSOLUTA:
    // se este agendamento já estiver no histórico, não desconta novamente.
    for (const pacote of pacotes) {
      const historico =
        Array.isArray(pacote.historico_sessoes)
          ? pacote.historico_sessoes
          : []
      const jaExiste =
        historico.some(
          (registro: any) =>
            String(
              registro?.agendamento_id || ''
            ) === String(agendamento.id)
        )
      if (jaExiste) {
        return
      }
    }
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
        // Segunda proteção antes de alterar o pacote.
        const duplicado =
          historico.some(
            (registro: any) =>
              String(
                registro?.agendamento_id || ''
              ) === String(agendamento.id)
          )
        if (duplicado) {
          return
        }
        historico.push({
          tipo: 'sessao_realizada',
          data: dataRegistro,
          quantidade: desconto,
          servico:
            cobertura.servicoNome,
          sessoes_equivalentes:
            cobertura.sessoesEquivalentes,
          agendamento_id:
            agendamento.id
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
  // ─── CONFIRMAR ATENDIMENTO ───────────────────────────────────────────
  async function confirmarAtendimento() {
    if (
      !modalConfirmar ||
      !profile?.salao_id
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
        setModalConfirmar(null)
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
        data: confirmacaoCriada,
        error: erroConfirmacao
      } = await supabase
        .from('confirmacoes_atendimento')
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
          setModalConfirmar(null)
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
        error: erroAgendamento
      } = await supabase
        .from('agendamentos')
        .update({
          status: 'concluido'
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
        mensagem: `O atendimento de ${           agendamento.clientes?.nome ||           'cliente'         } foi confirmado.`,
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
      const dados =
        await montarCoberturas(
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
        mensagem: `O atendimento de ${           agendamento.clientes?.nome ||           'cliente'         } foi marcado como não comparecimento.`,
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
        mensagem: `O agendamento de ${           solicitacao.clientes?.nome ||           'cliente'         } foi confirmado.`,
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
        mensagem: `A solicitação de ${           solicitacao.clientes?.nome ||           'cliente'         } foi recusada.`,
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
        mensagem: `O salão enviou novos horários para ${           modalSugestao.clientes?.nome ||           'você'         }.`,
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
      <div className="min-h-screen flex items-center justify-center bg- [#f8faf8]">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[var(--cor-salao)] animate-spin mx-auto mb-3" />
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
  const corSalao =
    salao?.cor_primaria ||
    salao?.cor ||
    '#E91E8C'
  return (
    <div
      className="min-h-screen bg-[#f8f8f8] text-gray-900"
      style={
        {
          '--cor-salao': corSalao
        } as any
      }
    >
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#e8e8e8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full bg-[#f7f7f7] flex items-center justify-center text-[var(--cor-salao)]"
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
        <div className="bg-white rounded-2xl border border-[#e8e8e8] p-1.5 flex gap-1 overflow-x-auto">
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
                      className="bg-white border border-[#e8e8e8] rounded-2xl p-4 sm:p-5 shadow-sm"
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
                          <span className="shrink-0 px-2.5 py-1 rounded-full bg- [#fff5df] text-[#946b1c] text-xs font-medium">
                            Horários sugeridos
                          </span>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            <p className="text-xs font-semibold text-[var(--cor-salao)] mb-2">
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
                                    className="px-3 py-1.5 bg-white border border-[#e6e6e6] rounded-lg text-sm"
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
                          className="flex-1 min-h-[56px] rounded-xl bg-[var(--cor-salao)] text-white text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-2">
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
                          className="flex-1 min-h-[56px] rounded-xl border border-[#dbe5dc] bg-white text-[var(--cor-salao)] text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-2">
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
                          className="flex-1 min-h-[56px] rounded-xl border border-[#eadada] bg-white text-[#9b5e5e] text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-2">
                            <X size={17} />
                            Recusar
                          </span>
                        </button>
                      </div>
                      {obterTelefoneCliente(solicitacao) && (
                        <button
                          type="button"
                          onClick={() =>
                            abrirWhatsApp(
                              obterTelefoneCliente(solicitacao)
                            )
                          }
                          className="mt-3 w-full min-h-[56px] rounded-xl bg-[#16A34A] text-white text-sm font-semibold shadow-sm active:scale-[0.99] transition"
                        >
                          <span className="flex items-center justify-center gap-2">
                            <MessageCircle size={18} />
                            Enviar WhatsApp
                          </span>
                        </button>
                      )}
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
                      className="bg-white border border-[#e8e8e8] rounded-2xl p-4 sm:p-5 shadow-sm"
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
                              className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--cor-salao)] hover:underline"
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
                        <span className="shrink-0 px-2.5 py-1 rounded-full bg- [#fff5df] text-[#946b1c] text-xs font-medium">
                          Aguardando
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() =>
                            iniciarNaoComparecimento(
                              agendamento
                            )
                          }
                          className="min-h-[56px] rounded-xl border border-[#eadada] bg-white text-[#9b5e5e] text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-2">
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
                          className="min-h-[56px] rounded-xl bg-[var(--cor-salao)] text-white text-sm font-semibold disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-2">
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
                      className={`bg-white border rounded-2xl p-4 ${                         notificacao.lida                           ? 'border-[#e8e8e8]'                           : 'border-[#e6e6e6] shadow-sm'                       }`}
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
                          <div className="w-10 h-10 rounded-full flex items- center justify-center shrink-0 bg-[#f7f7f7] text-[var(--cor-salao)]">
                            <Bell size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-sm">
                                {
                                  notificacao.titulo
                                }
                              </p>
                              {!notificacao.lida && (
                                <span className="w-2 h-2 rounded-full bg- [var(--cor-salao)] shrink-0 mt-1.5" />
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
                      className="bg-white border border-[#e8e8e8] rounded-2xl p-4"
                    >
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#f7f7f7] text-gray-400 flex items-center justify-center shrink-0">
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
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cor-salao)]"
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items- center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded- 3xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#e8e8e8] flex items-center justify-between">
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
                className="w-9 h-9 rounded-full bg-[#f7f7f7] flex items-center justify-center text-gray-500"
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
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">
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
                        className="w-full h-11 rounded-xl border border- [#e2e2e2] px-3 text-sm outline-none"
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
                  className="h-11 rounded-xl border border-[#e2e2e2] text-sm font-semibold text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={
                    salvarSugestaoHorario
                  }
                  className="min-h-[56px] rounded-xl bg-[var(--cor-salao)] text-white text-sm font-semibold disabled:opacity-50"
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
          setCoberturas={
            setCoberturas
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
          tevePacoteAnterior={
            tevePacoteAnterior
          }
          respostaNovoPacote={
            respostaNovoPacote
          }
          setRespostaNovoPacote={
            setRespostaNovoPacote
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
      className={`flex-1 min-w-[110px] rounded-xl px-3 py-2.5 text-sm font- medium transition ${         ativo           ? 'bg-[var(--cor-salao)] text-white shadow-sm'           : 'text-gray-600 hover:bg-[#f7f7f7]'       }`}
    >
      <span className="flex items-center justify-center gap-2">
        {icon}
        {label}
        {quantidade > 0 && (
          <span
            className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] flex items- center justify-center ${               ativo                 ? 'bg-white/20 text-white'                 : 'bg-[#f5f5f5] text-[var(--cor-salao)]'             }`}
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
    <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text- center">
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
  setCoberturas,
  carregandoCoberturas,
  sessaoJaRegistradaNoPacote,
  possuiPacoteDisponivel,
  tevePacoteAnterior,
  respostaNovoPacote,
  setRespostaNovoPacote,
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

  function selecionarPacote(coberturaIndex: number, pacoteId: string) {
    if (typeof coberturaIndex !== 'number') return
    if (!Array.isArray(coberturas)) return
    const cobertura = coberturas[coberturaIndex]
    if (!cobertura) return
    const atualizada = coberturas.map(
      (item: CoberturaServico, index: number) =>
        index === coberturaIndex
          ? {
              ...item,
              clientePacoteIdSelecionado: pacoteId
            }
          : item
    )
    // O estado é mantido no componente pai por meio do setter recebido em
    // setCoberturas; quando disponível, ele atualiza a seleção do pacote.
    if (typeof setCoberturas === 'function') {
      setCoberturas(atualizada)
    }
  }
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
  ) {
    setAvisouComAntecedencia(
      avisou
    )
    if (avisou) {
      setDescontarPacote(false)
      setJustificativa('')
      onNaoComparecimento(
        modalConfirmar.agendamento,
        false,
        ''
      )
      return
    }
    setEtapaNaoCompareceu(
      'pergunta_pacote'
    )
  }
  function selecionarDesconto(
    descontar: boolean
  ) {
    setDescontarPacote(
      descontar
    )
    if (!descontar) {
      onNaoComparecimento(
        modalConfirmar.agendamento,
        false,
        ''
      )
      return
    }
    setEtapaNaoCompareceu(
      'justificativa'
    )
  }
  function confirmarJustificativa() {
    const texto =
      justificativa.trim()
    if (!texto) {
      alert(
        'Escreva uma justificativa antes de descontar as sessões do pacote.'
      )
      return
    }
    onNaoComparecimento(
      modalConfirmar.agendamento,
      true,
      texto
    )
  }
  return (
    <div className="fixed inset-0 z-[60] bg-black/45 flex items-end sm:items- center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* CABEÇALHO */}
        <div className="p-5 border-b border-[#e8e8e8] flex items-start justify- between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">
              {isNaoComparecimento
                ? 'Registrar não comparecimento'
                : 'Confirmar atendimento'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {agendamento?.clientes?.nome ||
                'Cliente'}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={salvando}
            className="w-9 h-9 rounded-full bg-[#f7f7f7] flex items-center justify-center text-gray-500 shrink-0 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {/* ───────────────── CONFIRMAR ───────────────── */}
          {!isNaoComparecimento ? (
            <div>
              <div className="rounded-2xl bg-[#f8f8f8] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Serviço realizado
                </p>
                <input
                  type="text"
                  value={servicoRealizado}
                  onChange={e =>
                    setServicoRealizado(
                      e.target.value
                    )
                  }
                  className="w-full mt-2 h-11 rounded-xl border border-[#e2e2e2] bg-white px-3 text-sm outline-none"
                  placeholder="Nome do serviço"
                />
              </div>
              {verificandoPacoteConfirmacao ? (
                <div className="mt-5 rounded-2xl bg-[#f8f8f8] p-5 text-center">
                  <div className="w-7 h-7 rounded-full border-4 border-gray-200 border-t-[var(--cor-salao)] animate-spin mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">
                    Verificando o histórico do pacote...
                  </p>
                </div>
              ) : sessaoJaRegistradaNoPacote ? (
                /* CASO ESPECIAL:
                   a sessão já foi lançada anteriormente */
                <div className="mt-5">
                  <div className="rounded-2xl bg-[#fff5fb] border border- [#cfe2d1] p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#fde6f2] text- [var(--cor-salao)] flex items-center justify-center shrink-0">
                        <Check size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--cor-salao)]">
                          Sessão já registrada no pacote
                        </p>
                        <p className="text-xs text-[var(--cor-salao)] mt-1">
                          Esta sessão já foi lançada anteriormente no histórico 
do pacote. O sistema não fará uma nova baixa.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-[#e6e6e6] p-4">
                    <p className="text-sm text-gray-600">
                      Você pode apenas confirmar o atendimento para concluir 
este agendamento.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => {
                      setOpcaoConfirmacaoPacote(
                        'apenas_confirmar'
                      )
                      onConfirmar()
                    }}
                    className="w-full h-12 mt-5 rounded-xl bg-[var(--cor-salao)] text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {salvando
                      ? 'Salvando...'
                      : 'Apenas confirmar atendimento'}
                  </button>
                </div>
              ) : tevePacoteAnterior ? (
                /* PACOTE ANTERIOR ENCERRADO: PERGUNTA SOBRE RENOVAÇÃO */
                <div className="mt-5">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    Como deseja registrar o atendimento?
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() =>
                        setOpcaoConfirmacaoPacote(
                          'dar_baixa'
                        )
                      }
                      className={`text-left rounded-2xl border-2 p-4 transition ${                         opcaoConfirmacaoPacote ===                         'dar_baixa'                           ? 'border-[var(--cor-salao)] bg-[#fff5fb]'                           : 'border-[#e6e6e6] bg-white'                       }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${                             opcaoConfirmacaoPacote ===                             'dar_baixa'                               ? 'bg-[var(--cor-salao)] text-white'                               : 'bg-[#faf7f9] text-[var(--cor-salao)]'                           }`}
                        >
                          <Check size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Dar baixa no pacote
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Registrar a sessão realizada e descontar do pacote.
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() =>
                        setOpcaoConfirmacaoPacote(
                          'apenas_confirmar'
                        )
                      }
                      className={`text-left rounded-2xl border-2 p-4 transition ${                         opcaoConfirmacaoPacote ===                         'apenas_confirmar'                           ? 'border-[var(--cor-salao)] bg-[#fff5fb]'                           : 'border-[#e6e6e6] bg-white'                       }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${                             opcaoConfirmacaoPacote ===                             'apenas_confirmar'                               ? 'bg-[var(--cor-salao)] text-white'                               : 'bg-[#faf7f9] text-[var(--cor-salao)]'                           }`}
                        >
                          <Check size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Apenas confirmar atendimento
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Concluir o atendimento sem alterar o pacote.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                  {opcaoConfirmacaoPacote ===
                    'dar_baixa' && (
                    <div className="mt-4 rounded-2xl bg-[#f8f8f8] p-4">
                      <p className="text-xs font-semibold text-[var(--cor-salao)] mb-3">
                        Sessões que serão descontadas
                      </p>
                      {carregandoCoberturas ? (
                        <p className="text-sm text-gray-500">
                          Verificando pacotes disponíveis...
                        </p>
                      ) : coberturas.length ===
                        0 ? (
                        <p className="text-sm text-gray-500">
                          Nenhuma cobertura de pacote encontrada.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {coberturas.map(
                            (
                              cobertura: CoberturaServico
                            ) => (
                              <div
                                key={
                                  cobertura.servicoId
                                }
                                className="flex items-center justify-between gap-3 bg-white rounded-xl p-3"
                              >
                                <span className="text-sm font-medium">
                                  {
                                    cobertura.servicoNome
                                  }
                                </span>
                                <span className="text-xs text-[var(--cor-salao)] font- semibold">
                                  {
                                    cobertura.sessoesEquivalentes
                                  }{' '}
                                  sessão(ões)
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={
                      salvando ||
                      carregandoCoberturas ||
                      opcaoConfirmacaoPacote ===
                        'perguntar'
                    }
                    onClick={onConfirmar}
                    className="w-full h-12 mt-5 rounded-xl bg-[var(--cor-salao)] text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {salvando
                      ? 'Salvando...'
                      : opcaoConfirmacaoPacote ===
                        'dar_baixa'
                        ? 'Dar baixa e confirmar atendimento'
                        : 'Apenas confirmar atendimento'}
                  </button>
                </div>
              ) : tevePacoteAnterior ? (
                /* PACOTE ANTERIOR ENCERRADO: PERGUNTA SOBRE RENOVAÇÃO */
                <div className="mt-5">
                  {respostaNovoPacote === 'perguntar' && (
                    <>
                      <div className="rounded-2xl bg-[#fff5fb] border border-[#f2d2e4] p-4">
                        <p className="text-sm font-semibold text-gray-800">
                          A cliente fez ou renovou um novo pacote?
                        </p>
                        <p className="text-xs text-gray-500 mt-1.5">
                          Ela já teve um pacote que terminou. Se fez outro, você poderá escolher qual pacote será usado neste atendimento.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 mt-4">
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() => {
                            setRespostaNovoPacote('sim')
                            if (coberturas.length > 0) {
                              setOpcaoConfirmacaoPacote('dar_baixa')
                            }
                          }}
                          className="min-h-14 rounded-2xl border-2 border-[var(--cor-salao)] bg-[#fff5fb] text-[var(--cor-salao)] font-semibold text-sm px-4"
                        >
                          Sim, fez/renovou um pacote
                        </button>
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() => {
                            setRespostaNovoPacote('nao')
                            setOpcaoConfirmacaoPacote('apenas_confirmar')
                          }}
                          className="min-h-14 rounded-2xl border border-[#e6e6e6] bg-white text-gray-700 font-semibold text-sm px-4"
                        >
                          Não, não fez novo pacote
                        </button>
                      </div>
                    </>
                  )}

                  {respostaNovoPacote === 'sim' && (
                    <>
                      <div className="rounded-2xl bg-[#f8f8f8] p-4">
                        <p className="text-sm font-semibold text-gray-800">
                          Qual pacote foi renovado?
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Selecione o pacote que deve receber a baixa desta sessão.
                        </p>
                      </div>
                      {coberturas.length === 0 ? (
                        <div className="mt-4 rounded-2xl bg-[#fff8ec] p-4">
                          <p className="text-sm font-semibold text-[#765d29]">
                            Nenhum pacote ativo foi encontrado
                          </p>
                          <p className="text-xs text-[#8c7441] mt-1">
                            Cadastre/renove o pacote da cliente antes de dar baixa nesta sessão.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {coberturas.map((cobertura: CoberturaServico, index: number) => (
                            <div key={cobertura.servicoId} className="rounded-2xl border border-[#e6e6e6] p-4">
                              <p className="text-xs uppercase tracking-wide text-gray-400">
                                {cobertura.servicoNome}
                              </p>
                              <div className="mt-3 space-y-2">
                                {cobertura.pacotesDisponiveis.map((pacote: PacoteOpcao) => {
                                  const selecionado = cobertura.clientePacoteIdSelecionado === pacote.clientePacoteId
                                  return (
                                    <button
                                      key={pacote.clientePacoteId}
                                      type="button"
                                      disabled={salvando}
                                      onClick={() => selecionarPacote(index, pacote.clientePacoteId)}
                                      className={`w-full min-h-14 rounded-xl border-2 px-3 py-3 text-left transition ${
                                        selecionado
                                          ? 'border-[var(--cor-salao)] bg-[#fff5fb]'
                                          : 'border-[#e6e6e6] bg-white'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-gray-800">
                                            {pacote.nome}
                                          </p>
                                          <p className="text-xs text-gray-500 mt-0.5">
                                            {pacote.sessoesRestantes} sessão(ões) restante(s)
                                          </p>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                          selecionado
                                            ? 'border-[var(--cor-salao)] bg-[var(--cor-salao)] text-white'
                                            : 'border-gray-300'
                                        }`}>
                                          {selecionado && <Check size={14} />}
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-5 grid grid-cols-1 gap-3">
                        <button
                          type="button"
                          disabled={salvando || coberturas.length === 0 || coberturas.some((c: CoberturaServico) => !c.clientePacoteIdSelecionado)}
                          onClick={onConfirmar}
                          className="w-full min-h-14 rounded-2xl bg-[var(--cor-salao)] text-white font-semibold text-sm disabled:opacity-50"
                        >
                          {salvando ? 'Salvando...' : 'Dar baixa no pacote e confirmar'}
                        </button>
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() => setRespostaNovoPacote('perguntar')}
                          className="w-full min-h-12 rounded-xl border border-[#e6e6e6] text-gray-600 font-semibold text-sm"
                        >
                          Voltar
                        </button>
                      </div>
                    </>
                  )}

                  {respostaNovoPacote === 'nao' && (
                    <div className="mt-4">
                      <div className="rounded-2xl border border-[#e6e6e6] p-4">
                        <p className="text-sm font-semibold text-gray-700">
                          Sem novo pacote para este atendimento
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          O atendimento será confirmado sem alterar o pacote anterior.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={onConfirmar}
                        className="w-full min-h-14 mt-5 rounded-2xl bg-[var(--cor-salao)] text-white font-semibold text-sm disabled:opacity-50"
                      >
                        {salvando ? 'Salvando...' : 'Confirmar atendimento'}
                      </button>
                    </div>
                  )}
                </div>
              ) : possuiPacoteDisponivel ? (
                /* EXISTE PACOTE, MAS A SESSÃO AINDA NÃO FOI LANÇADA */
                <div className="mt-5">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    Como deseja registrar o atendimento?
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() =>
                        setOpcaoConfirmacaoPacote('dar_baixa')
                      }
                      className={`w-full min-h-14 text-left rounded-2xl border-2 p-4 transition ${
                        opcaoConfirmacaoPacote === 'dar_baixa'
                          ? 'border-[var(--cor-salao)] bg-[#fff5fb]'
                          : 'border-[#e6e6e6] bg-white'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-800">
                        Dar baixa no pacote
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Registrar a sessão realizada e descontar do pacote.
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() =>
                        setOpcaoConfirmacaoPacote('apenas_confirmar')
                      }
                      className={`w-full min-h-14 text-left rounded-2xl border-2 p-4 transition ${
                        opcaoConfirmacaoPacote === 'apenas_confirmar'
                          ? 'border-[var(--cor-salao)] bg-[#fff5fb]'
                          : 'border-[#e6e6e6] bg-white'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-800">
                        Apenas confirmar atendimento
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Concluir o atendimento sem alterar o pacote.
                      </p>
                    </button>
                  </div>
                  {opcaoConfirmacaoPacote === 'dar_baixa' && (
                    <div className="mt-4 rounded-2xl bg-[#f8f8f8] p-4">
                      <p className="text-xs font-semibold text-[var(--cor-salao)] mb-3">
                        Sessões que serão descontadas
                      </p>
                      {coberturas.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Nenhuma cobertura de pacote encontrada.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {coberturas.map((cobertura: CoberturaServico) => (
                            <div key={cobertura.servicoId} className="flex items-center justify-between gap-3 bg-white rounded-xl p-3">
                              <span className="text-sm font-medium">{cobertura.servicoNome}</span>
                              <span className="text-xs text-[var(--cor-salao)] font-semibold">
                                {cobertura.sessoesEquivalentes} sessão(ões)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={
                      salvando ||
                      carregandoCoberturas ||
                      opcaoConfirmacaoPacote === 'perguntar'
                    }
                    onClick={onConfirmar}
                    className="w-full min-h-14 mt-5 rounded-2xl bg-[var(--cor-salao)] text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {salvando
                      ? 'Salvando...'
                      : opcaoConfirmacaoPacote === 'dar_baixa'
                        ? 'Dar baixa e confirmar atendimento'
                        : 'Apenas confirmar atendimento'}
                  </button>
                </div>
              ) : (
                /* SEM PACOTE E SEM HISTÓRICO ANTERIOR */
                <div className="mt-5">
                  <div className="rounded-2xl border border-[#e6e6e6] p-4">
                    <p className="text-sm font-semibold text-gray-700">
                      Sem pacote ativo
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      O atendimento será apenas confirmado e concluído.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => {
                      setOpcaoConfirmacaoPacote('apenas_confirmar')
                      onConfirmar()
                    }}
                    className="w-full min-h-14 mt-5 rounded-2xl bg-[var(--cor-salao)] text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {salvando ? 'Salvando...' : 'Confirmar atendimento'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ───────────────── NÃO COMPARECIMENTO ───────────────── */
            <div>
              {etapaNaoCompareceu ===
                'pergunta_aviso' && (
                <div>
                  <div className="rounded-2xl bg-[#fff8ec] p-4 mb-5">
                    <p className="text-sm font-semibold text-[#765d29]">
                      A cliente avisou o salão sobre a falta com antecedência?
                    </p>
                    <p className="text-xs text-[#8c7441] mt-1.5">
                      Se avisou em cima da hora ou não avisou, considere como 
falta sem aviso prévio.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() =>
                        selecionarAviso(
                          true
                        )
                      }
                      className="min-h-12 rounded-xl border border-[#e5e5e5] bg- [#f8f8f8] text-[var(--cor-salao)] font-semibold text-sm"
                    >
                      Sim, avisou com antecedência
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() =>
                        selecionarAviso(
                          false
                        )
                      }
                      className="min-h-12 rounded-xl border border-[#eadada] bg- [#fff8f8] text-[#9b5e5e] font-semibold text-sm"
                    >
                      Não, não avisou / avisou em cima da hora
                    </button>
                  </div>
                </div>
              )}
              {etapaNaoCompareceu ===
                'pergunta_pacote' && (
                <div>
                  <div className="rounded-2xl bg-[#fff8ec] p-4 mb-5">
                    <p className="text-sm font-semibold text-[#765d29]">
                      Deseja descontar a falta do pacote da cliente?
                    </p>
                    <p className="text-xs text-[#8c7441] mt-1.5">
                      O sistema considerará todos os serviços do agendamento e 
suas respectivas sessões equivalentes.
                    </p>
                  </div>
                  {coberturas.length >
                    0 && (
                    <div className="mb-5 space-y-2">
                      {coberturas.map(
                        (
                          cobertura: CoberturaServico
                        ) => (
                          <div
                            key={
                              cobertura.servicoId
                            }
                            className="rounded-xl bg-[#f8f8f8] p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">
                                {
                                  cobertura.servicoNome
                                }
                              </span>
                              <span className="text-xs text-gray-500">
                                {
                                  cobertura.sessoesEquivalentes
                                }{' '}
                                sessão(ões)
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {carregandoCoberturas && (
                    <p className="text-sm text-gray-500 mb-4">
                      Verificando os pacotes disponíveis...
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={
                        salvando ||
                        carregandoCoberturas
                      }
                      onClick={() =>
                        selecionarDesconto(
                          false
                        )
                      }
                      className="h-12 rounded-xl border border-[#e2e2e2] text- gray-600 font-semibold text-sm disabled:opacity-50"
                    >
                      Não descontar
                    </button>
                    <button
                      type="button"
                      disabled={
                        salvando ||
                        carregandoCoberturas
                      }
                      onClick={() =>
                        selecionarDesconto(
                          true
                        )
                      }
                      className="h-12 rounded-xl bg-[var(--cor-salao)] text-white font- semibold text-sm disabled:opacity-50"
                    >
                      Sim, descontar
                    </button>
                  </div>
                </div>
              )}
              {etapaNaoCompareceu ===
                'justificativa' && (
                <div>
                  <div className="rounded-2xl bg-[#fff8ec] p-4 mb-5">
                    <p className="text-sm font-semibold text-[#765d29]">
                      Justificativa do desconto
                    </p>
                    <p className="text-xs text-[#8c7441] mt-1.5">
                      Escreva o motivo pelo qual as sessões serão descontadas. 
Essa justificativa ficará registrada no histórico do pacote.
                    </p>
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500">
                      Justificativa
                    </span>
                    <textarea
                      value={justificativa}
                      onChange={e =>
                        setJustificativa(
                          e.target.value
                        )
                      }
                      rows={5}
                      placeholder="Ex.: Cliente não compareceu e não avisou o salão com antecedência."
                      className="w-full mt-2 rounded-xl border border-[#e2e2e2] px-3 py-3 text-sm outline-none resize-none"
                    />
                  </label>
                  <div className="mt-4 rounded-xl bg-[#f8f8f8] p-3">
                    <p className="text-xs text-gray-500">
                      Serviços que serão considerados:
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {coberturas.map(
                        (
                          cobertura: CoberturaServico
                        ) => (
                          <div
                            key={
                              cobertura.servicoId
                            }
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span>
                              {
                                cobertura.servicoNome
                              }
                            </span>
                            <span className="font-medium text-[var(--cor-salao)]">
                              {
                                cobertura.sessoesEquivalentes
                              }{' '}
                              sessão(ões)
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={
                      confirmarJustificativa
                    }
                    className="w-full h-12 mt-5 rounded-xl bg-[var(--cor-salao)] text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {salvando
                      ? 'Salvando...'
                      : 'Registrar falta e descontar pacote'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}