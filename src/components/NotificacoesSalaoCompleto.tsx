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
        '*, clientes(id, nome, email, telefone), servicos(nome, 
duracao_minutos)'
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
        '*, clientes(id, nome, telefone), servicos(nome, id), 
confirmacoes_atendimento(*)'
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
        'id, cliente_nome, servico, sessoes_total, sessoes_restantes, 
data_sessao, created_at, status, historico_sessoes'
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
      if (resultado.registrada) {
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
          'Este atendimento já foi confirmado anteriormente. Nenhuma nova baixa 
foi realizada.'
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
            'Este atendimento já havia sido confirmado. Nenhuma nova confirmação 
foi criada.'
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
        mensagem: `O atendimento de ${
          agendamento.clientes?.nome ||
          'cliente'
        } foi confirmado.`,
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
  // ─── NOTIFICAÇÃO EXCLUÍDA ─────────────────────────────────────────────
  async function excluirNotificacao(
    notificacao: any
  ) {
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
            profile?.salao_id
          )
      if (error) {
        throw error
      }
      setNotificacoes(prev =>
        prev.filter(
          item =>
            item.id !==
            notificacao.id
        )
      )
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
            profile?.salao_id
          )
      if (error) {
        throw error
      }
      setNotificacoesExcluidas(prev =>
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
  // ─── UTILITÁRIOS ──────────────────────────────────────────────────────
  function formatarDataHora(
    valor: string
  ) {
    if (!valor) return ''
    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) {
      return valor
    }
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
  function formatarHora(
    valor: string
  ) {
    if (!valor) return ''
    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) {
      return ''
    }
    return data.toLocaleTimeString(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    )
  }
  function formatarData(
    valor: string
  ) {
    if (!valor) return ''
    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) {
      return ''
    }
    return data.toLocaleDateString(
      'pt-BR',
      {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit'
      }
    )
  }
  function nomeCliente(
    item: any
  ) {
    return (
      item?.clientes?.nome ||
      item?.cliente_nome ||
      'Cliente'
    )
  }
  function telefoneCliente(
    item: any
  ) {
    return (
      item?.clientes?.telefone ||
      item?.telefone ||
      ''
    )
  }
  function nomeServico(
    item: any
  ) {
    return (
      item?.servicos?.nome ||
      item?.servico_nome ||
      'Atendimento'
    )
  }
  function abrirWhatsApp(
    telefone: string,
    mensagem: string
  ) {
    if (!telefone) {
      alert(
        'Esta cliente não possui telefone cadastrado.'
      )
      return
    }
    const numero = telefone.replace(
      /\D/g,
      ''
    )
    const numeroComDDI =
      numero.startsWith('55')
        ? numero
        : `55${numero}`
    const url =
      `https://wa.me/${numeroComDDI}` +
      `?text=${encodeURIComponent(mensagem)}`
    window.open(
      url,
      '_blank'
    )
  }
  function gerarMensagemConfirmacao(
    agendamento: any
  ) {
    const nome =
      nomeCliente(agendamento)
    const servico =
      nomeServico(agendamento)
    const data =
      agendamento?.data_hora
        ? formatarDataHora(
            agendamento.data_hora
          )
        : ''
    return `Olá, ${nome}! 💕 Estamos passando para confirmar seu atendimento de ${servico}${data ? ` no dia ${data}` : ''}. Podemos contar com você?`
  }
  function gerarMensagemNaoComparecimento(
    agendamento: any
  ) {
    const nome =
      nomeCliente(agendamento)
    const servico =
      nomeServico(agendamento)
    return `Olá, ${nome}! Notamos que você não compareceu ao atendimento de ${servico}. Se quiser, podemos ajudar a remarcar seu horário. 💕`
  }
  function quantidadePendencias() {
    return (
      solicitacoes.length +
      confirmacoes.length +
      notificacoes.filter(
        n => !n.lida
      ).length
    )
  }
  // ─── EFEITOS VISUAIS ─────────────────────────────────────────────────
  const corSalao =
    salao?.cor_primaria ||
    salao?.cor ||
    salao?.corPrimaria ||
    '#E91E8C'
  const estiloSalao = {
    '--cor-salao':
      corSalao
  } as React.CSSProperties
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#f8f8f8]"
        style={
          estiloSalao
        }
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-[var(--cor-salao)] border-t-transparent animate-spin"
          />
          <p className="text-sm text-gray-500">
            Carregando...
          </p>
        </div>
      </div>
    )
  }
  if (!profile) {
    return null
  }
  return (
    <div
      className="min-h-screen bg-[#f8f8f8] text-[#333]"
      style={
        estiloSalao
      }
    >
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() =>
              router.back()
            }
            className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm"
          >
            <ArrowLeft
              size={19}
              className="text-gray-600"
            />
          </button>

          <div className="text-center">
            <h1 className="text-lg font-semibold text-gray-800">
              Central de Atendimento
            </h1>
            <p className="text-xs text-gray-500">
              {salao?.nome ||
                'Salão'}
            </p>
          </div>

          <div className="relative w-10 h-10">
            <div
              className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm"
            >
              <Bell
                size={18}
                className="text-gray-600"
              />
            </div>
            {quantidadePendencias() >
              0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-[var(--cor-salao)] text-white text-[10px] font-bold flex items-center justify-center"
              >
                {quantidadePendencias() >
                99
                  ? '99+'
                  : quantidadePendencias()}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-1.5 mb-5 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            <TabButton
              ativo={
                aba === 'pedidos'
              }
              onClick={() =>
                setAba('pedidos')
              }
              label="Pedidos"
              contador={
                solicitacoes.length
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
              label="Confirmar"
              contador={
                confirmacoes.length
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
              label="Notificações"
              contador={
                notificacoes.filter(
                  n => !n.lida
                ).length
              }
              cor={corSalao}
            />
            <TabButton
              ativo={
                aba === 'excluidas'
              }
              onClick={() =>
                setAba('excluidas')
              }
              label="Excluídas"
              contador={
                notificacoesExcluidas.length
              }
              cor={corSalao}
            />
          </div>
        </div>

        {aba === 'pedidos' && (
          <div className="space-y-3">
            {solicitacoes.length ===
              0 ? (
              <EstadoVazio
                icone={
                  <Calendar
                    size={23}
                  />
                }
                titulo="Nenhum pedido pendente"
                descricao="Quando uma cliente solicitar um horário, ele aparecerá aqui."
              />
            ) : (
              solicitacoes.map(
                solicitacao => (
                  <div
                    key={
                      solicitacao.id
                    }
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-gray-800 truncate">
                          {nomeCliente(
                            solicitacao
                          )}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          {nomeServico(
                            solicitacao
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium">
                        Pendente
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {formatarDataPreferida(
                        solicitacao
                      ) && (
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <p className="text-[11px] text-gray-400">
                            Data desejada
                          </p>
                          <p className="text-sm text-gray-700 mt-0.5">
                            {formatarDataPreferida(
                              solicitacao
                            )}
                          </p>
                        </div>
                      )}

                      {formatarPeriodoPreferido(
                        solicitacao
                      ) && (
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <p className="text-[11px] text-gray-400">
                            Período
                          </p>
                          <p className="text-sm text-gray-700 mt-0.5">
                            {formatarPeriodoPreferido(
                              solicitacao
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {solicitacao.observacoes && (
                      <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5">
                        <p className="text-[11px] text-gray-400 mb-1">
                          Observações
                        </p>
                        <p className="text-sm text-gray-600">
                          {
                            solicitacao.observacoes
                          }
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button
                        type="button"
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
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700"
                      >
                        Sugerir horário
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          aceitarSolicitacao(
                            solicitacao
                          )
                        }
                        disabled={
                          salvando
                        }
                        className="rounded-xl bg-[var(--cor-salao)] text-white px-3 py-2.5 text-sm font-medium disabled:opacity-50"
                      >
                        Aceitar
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        recusarSolicitacao(
                          solicitacao
                        )
                      }
                      disabled={
                        salvando
                      }
                      className="w-full mt-2 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Recusar solicitação
                    </button>
                  </div>
                )
              )
            )}
          </div>
        )}

        {aba === 'confirmacoes' && (
          <div className="space-y-3">
            {confirmacoes.length ===
              0 ? (
              <EstadoVazio
                icone={
                  <Check
                    size={23}
                  />
                }
                titulo="Tudo em dia"
                descricao="Não há atendimentos aguardando confirmação."
              />
            ) : (
              confirmacoes.map(
                agendamento => (
                  <div
                    key={
                      agendamento.id
                    }
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-gray-800 truncate">
                          {nomeCliente(
                            agendamento
                          )}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          {nomeServico(
                            agendamento
                          )}
                        </p>
                      </div>

                      <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium">
                        Aguardando
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <Calendar
                        size={15}
                      />
                      <span>
                        {formatarData(
                          agendamento.data_hora
                        )}
                      </span>
                      <Clock
                        size={15}
                        className="ml-2"
                      />
                      <span>
                        {formatarHora(
                          agendamento.data_hora
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          abrirModalConfirmar(
                            agendamento
                          )
                        }
                        className="rounded-xl bg-[var(--cor-salao)] text-white px-3 py-2.5 text-sm font-medium"
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
                        className="rounded-xl border border-red-200 bg-red-50 text-red-600 px-3 py-2.5 text-sm font-medium"
                      >
                        Não veio
                      </button>
                    </div>

                    {telefoneCliente(
                      agendamento
                    ) && (
                      <button
                        type="button"
                        onClick={() =>
                          abrirWhatsApp(
                            telefoneCliente(
                              agendamento
                            ),
                            gerarMensagemConfirmacao(
                              agendamento
                            )
                          )
                        }
                        className="w-full mt-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 flex items-center justify-center gap-2"
                      >
                        <MessageCircle
                          size={16}
                        />
                        Falar com a cliente
                      </button>
                    )}
                  </div>
                )
              )
            )}
          </div>
        )}

        {aba === 'notificacoes' && (
          <div className="space-y-3">
            {notificacoes.length ===
              0 ? (
              <EstadoVazio
                icone={
                  <Bell
                    size={23}
                  />
                }
                titulo="Nenhuma notificação"
                descricao="Você não possui novas notificações."
              />
            ) : (
              notificacoes.map(
                notificacao => (
                  <div
                    key={
                      notificacao.id
                    }
                    className={`bg-white rounded-2xl border shadow-sm p-4 ${
                      notificacao.lida
                        ? 'border-gray-200'
                        : 'border-[var(--cor-salao)]/30'
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
                        <div
                          className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center ${
                            notificacao.lida
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-[var(--cor-salao)]/10 text-[var(--cor-salao)]'
                          }`}
                        >
                          <Bell
                            size={18}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="font-medium text-gray-800">
                              {
                                notificacao.titulo
                              }
                            </h2>

                            {!notificacao.lida && (
                              <span className="w-2 h-2 rounded-full bg-[var(--cor-salao)] shrink-0 mt-1.5" />
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

                    <button
                      type="button"
                      onClick={() =>
                        excluirNotificacao(
                          notificacao
                        )
                      }
                      className="mt-3 text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                    >
                      <Trash2
                        size={13}
                      />
                      Excluir
                    </button>
                  </div>
                )
              )
            )}
          </div>
        )}

        {aba === 'excluidas' && (
          <div className="space-y-3">
            {notificacoesExcluidas.length ===
              0 ? (
              <EstadoVazio
                icone={
                  <Trash2
                    size={23}
                  />
                }
                titulo="Nenhuma notificação excluída"
                descricao="As notificações que você excluir aparecerão aqui."
              />
            ) : (
              notificacoesExcluidas.map(
                notificacao => (
                  <div
                    key={
                      notificacao.id
                    }
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
                  >
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 shrink-0 flex items-center justify-center">
                        <Trash2
                          size={18}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="font-medium text-gray-800">
                          {
                            notificacao.titulo
                          }
                        </h2>
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

                    <button
                      type="button"
                      onClick={() =>
                        restaurarNotificacao(
                          notificacao
                        )
                      }
                      className="mt-3 rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 flex items-center gap-1.5"
                    >
                      <RotateCcw
                        size={14}
                      />
                      Restaurar
                    </button>
                  </div>
                )
              )
            )}
          </div>
        )}

        {modalSugestao && (
          <ModalSugestaoHorario
            solicitacao={
              modalSugestao
            }
            horarios={
              horariosLivres
            }
            setHorarios={
              setHorariosLivres
            }
            onClose={() =>
              setModalSugestao(
                null
              )
            }
            onSave={
              salvarSugestaoHorario
            }
            salvando={
              salvando
            }
            cor={corSalao}
          />
        )}

        {modalConfirmar &&
          modalConfirmar.tipo !==
            'nao_compareceu' && (
            <ModalAtendimento
              agendamento={
                modalConfirmar
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
              salvando={
                salvando
              }
              onClose={() =>
                setModalConfirmar(
                  null
                )
              }
              onConfirm={
                confirmarAtendimento
              }
              onWhatsApp={() =>
                abrirWhatsApp(
                  telefoneCliente(
                    modalConfirmar
                  ),
                  gerarMensagemConfirmacao(
                    modalConfirmar
                  )
                )
              }
              cor={corSalao}
            />
          )}

        {modalConfirmar?.tipo ===
          'nao_compareceu' && (
          <ModalNaoComparecimento
            agendamento={
              modalConfirmar.agendamento
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
            salvando={
              salvando
            }
            onClose={() =>
              setModalConfirmar(
                null
              )
            }
            onConfirm={(
              descontar,
              justificativa
            ) =>
              registrarNaoComparecimento(
                modalConfirmar.agendamento,
                descontar,
                justificativa
              )
            }
            onWhatsApp={() =>
              abrirWhatsApp(
                telefoneCliente(
                  modalConfirmar.agendamento
                ),
                gerarMensagemNaoComparecimento(
                  modalConfirmar.agendamento
                )
              )
            }
            cor={corSalao}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({
  ativo,
  onClick,
  label,
  contador,
  cor
}: {
  ativo: boolean
  onClick: () => void
  label: string
  contador: number
  cor: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap"
      style={
        ativo
          ? {
              backgroundColor:
                cor,
              color: '#fff'
            }
          : {
              backgroundColor:
                'transparent',
              color: '#6b7280'
            }
      }
    >
      <span>{label}</span>
      {contador > 0 && (
        <span
          className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
          style={
            ativo
              ? {
                  backgroundColor:
                    'rgba(255,255,255,0.22)',
                  color: '#fff'
                }
              : {
                  backgroundColor:
                    '#f3f4f6',
                  color:
                    '#6b7280'
                }
          }
        >
          {contador}
        </span>
      )}
    </button>
  )
}

function EstadoVazio({
  icone,
  titulo,
  descricao
}: {
  icone: React.ReactNode
  titulo: string
  descricao: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-10 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
        {icone}
      </div>
      <h2 className="font-medium text-gray-800 mt-4">
        {titulo}
      </h2>
      <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
        {descricao}
      </p>
    </div>
  )
}

function ModalSugestaoHorario({
  solicitacao,
  horarios,
  setHorarios,
  onClose,
  onSave,
  salvando,
  cor
}: {
  solicitacao: any
  horarios: string[]
  setHorarios: React.Dispatch<
    React.SetStateAction<
      string[]
    >
  >
  onClose: () => void
  onSave: () => void
  salvando: boolean
  cor: string
}) {
  function alterarHorario(
    index: number,
    valor: string
  ) {
    setHorarios(prev =>
      prev.map(
        (item, i) =>
          i === index
            ? valor
            : item
      )
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">
              Sugerir horários
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {solicitacao?.clientes?.nome ||
                'Cliente'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X
              size={17}
              className="text-gray-600"
            />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-gray-600 mb-4">
            Informe até três opções de horário para a cliente.
          </p>

          <div className="space-y-3">
            {horarios.map(
              (horario, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2"
                >
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-medium flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>

                  <input
                    type="datetime-local"
                    value={
                      horario
                    }
                    onChange={e =>
                      alterarHorario(
                        index,
                        e.target
                          .value
                      )
                    }
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--cor-salao)]"
                    style={
                      {
                        '--cor-salao':
                          cor
                      } as React.CSSProperties
                    }
                  />
                </div>
              )
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={salvando}
              className="rounded-xl text-white px-4 py-3 text-sm font-medium disabled:opacity-50"
              style={{
                backgroundColor:
                  cor
              }}
            >
              {salvando
                ? 'Enviando...'
                : 'Enviar horários'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalAtendimento({
  agendamento,
  servicoRealizado,
  setServicoRealizado,
  coberturas,
  setCoberturas,
  sessaoJaRegistradaNoPacote,
  possuiPacoteDisponivel,
  opcaoConfirmacaoPacote,
  setOpcaoConfirmacaoPacote,
  verificandoPacoteConfirmacao,
  salvando,
  onClose,
  onConfirm,
  onWhatsApp,
  cor
}: {
  agendamento: any
  servicoRealizado: string
  setServicoRealizado: (
    valor: string
  ) => void
  coberturas: CoberturaServico[]
  setCoberturas: React.Dispatch<
    React.SetStateAction<
      CoberturaServico[]
    >
  >
  sessaoJaRegistradaNoPacote: boolean
  possuiPacoteDisponivel: boolean
  opcaoConfirmacaoPacote:
    | 'perguntar'
    | 'dar_baixa'
    | 'apenas_confirmar'
  setOpcaoConfirmacaoPacote: (
    valor:
      | 'perguntar'
      | 'dar_baixa'
      | 'apenas_confirmar'
  ) => void
  verificandoPacoteConfirmacao: boolean
  salvando: boolean
  onClose: () => void
  onConfirm: () => void
  onWhatsApp: () => void
  cor: string
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-800">
              Confirmar atendimento
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {agendamento?.clientes?.nome ||
                'Cliente'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X
              size={17}
              className="text-gray-600"
            />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar
                size={16}
              />
              <span>
                {formatarDataHoraLocal(
                  agendamento?.data_hora
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
              <Clock
                size={16}
              />
              <span>
                {formatarHoraLocal(
                  agendamento?.data_hora
                )}
              </span>
            </div>

            <p className="text-sm text-gray-700 mt-3">
              <span className="font-medium">
                Serviço:
              </span>{' '}
              {agendamento?.servicos?.nome ||
                agendamento?.servico_nome ||
                'Atendimento'}
            </p>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Serviço realizado
            </label>

            <input
              value={
                servicoRealizado
              }
              onChange={e =>
                setServicoRealizado(
                  e.target.value
                )
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--cor-salao)]"
              style={
                {
                  '--cor-salao':
                    cor
                } as React.CSSProperties
              }
            />
          </div>

          {verificandoPacoteConfirmacao ? (
            <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-5 text-center">
              <div
                className="w-6 h-6 rounded-full border-2 border-[var(--cor-salao)] border-t-transparent animate-spin mx-auto"
                style={
                  {
                    '--cor-salao':
                      cor
                  } as React.CSSProperties
                }
              />
              <p className="text-xs text-gray-500 mt-2">
                Verificando pacote da cliente...
              </p>
            </div>
          ) : (
            possuiPacoteDisponivel && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Pacote
                  </h3>
                  {sessaoJaRegistradaNoPacote && (
                    <span className="text-[11px] text-green-600 font-medium">
                      Sessão já registrada
                    </span>
                  )}
                </div>

                {sessaoJaRegistradaNoPacote ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600">
                      Esta sessão já foi lançada no pacote anteriormente. O atendimento será apenas confirmado.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-2">
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
                            : 'border-gray-200 bg-white'
                        }`}
                        style={
                          {
                            '--cor-salao':
                              cor
                          } as React.CSSProperties
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              Dar baixa no pacote
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Descontar a sessão realizada.
                            </p>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              opcaoConfirmacaoPacote ===
                              'dar_baixa'
                                ? 'border-[var(--cor-salao)]'
                                : 'border-gray-300'
                            }`}
                            style={
                              {
                                '--cor-salao':
                                  cor
                              } as React.CSSProperties
                            }
                          >
                            {opcaoConfirmacaoPacote ===
                              'dar_baixa' && (
                              <div
                                className="w-2.5 h-2.5 rounded-full bg-[var(--cor-salao)]"
                                style={
                                  {
                                    '--cor-salao':
                                      cor
                                  } as React.CSSProperties
                                }
                              />
                            )}
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
                            : 'border-gray-200 bg-white'
                        }`}
                        style={
                          {
                            '--cor-salao':
                              cor
                          } as React.CSSProperties
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              Apenas confirmar
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Não descontar uma sessão do pacote.
                            </p>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              opcaoConfirmacaoPacote ===
                              'apenas_confirmar'
                                ? 'border-[var(--cor-salao)]'
                                : 'border-gray-300'
                            }`}
                            style={
                              {
                                '--cor-salao':
                                  cor
                              } as React.CSSProperties
                            }
                          >
                            {opcaoConfirmacaoPacote ===
                              'apenas_confirmar' && (
                              <div
                                className="w-2.5 h-2.5 rounded-full bg-[var(--cor-salao)]"
                                style={
                                  {
                                    '--cor-salao':
                                      cor
                                  } as React.CSSProperties
                                }
                              />
                            )}
                          </div>
                        </div>
                      </button>
                    </div>

                    {opcaoConfirmacaoPacote ===
                      'dar_baixa' &&
                      coberturas.length >
                        0 && (
                        <div className="mt-3 space-y-2">
                          {coberturas.map(
                            (
                              cobertura,
                              index
                            ) => (
                              <div
                                key={`${cobertura.servicoId}-${index}`}
                                className="rounded-2xl border border-gray-200 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">
                                      {
                                        cobertura.servicoNome
                                      }
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {cobertura.sessoesEquivalentes}{' '}
                                      sessão(ões)
                                    </p>
                                  </div>
                                </div>

                                {cobertura.pacotesDisponiveis.length >
                                  0 && (
                                  <select
                                    value={
                                      cobertura.clientePacoteIdSelecionado ||
                                      ''
                                    }
                                    onChange={e =>
                                      setCoberturas(
                                        prev =>
                                          prev.map(
                                            (
                                              item,
                                              i
                                            ) =>
                                              i ===
                                              index
                                                ? {
                                                    ...item,
                                                    clientePacoteIdSelecionado:
                                                      e.target.value ||
                                                      null
                                                  }
                                                : item
                                          )
                                      )
                                    }
                                    className="w-full mt-3 rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white outline-none"
                                  >
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
                                          {
                                            pacote.nome
                                          }{' '}
                                          —{' '}
                                          {
                                            pacote.sessoesRestantes
                                          }{' '}
                                          restante(s)
                                        </option>
                                      )
                                    )}
                                  </select>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )}
                  </>
                )}
              </div>
            )
          )}

          <button
            type="button"
            onClick={onWhatsApp}
            className="w-full mt-5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 flex items-center justify-center gap-2"
          >
            <MessageCircle
              size={17}
            />
            Falar com a cliente
          </button>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={
                salvando ||
                verificandoPacoteConfirmacao
              }
              className="rounded-xl text-white px-4 py-3 text-sm font-medium disabled:opacity-50"
              style={{
                backgroundColor:
                  cor
              }}
            >
              {salvando
                ? 'Salvando...'
                : 'Confirmar atendimento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalNaoComparecimento({
  agendamento,
  coberturas,
  setCoberturas,
  carregandoCoberturas,
  salvando,
  onClose,
  onConfirm,
  onWhatsApp,
  cor
}: {
  agendamento: any
  coberturas: CoberturaServico[]
  setCoberturas: React.Dispatch<
    React.SetStateAction<
      CoberturaServico[]
    >
  >
  carregandoCoberturas: boolean
  salvando: boolean
  onClose: () => void
  onConfirm: (
    descontarPacote: boolean,
    justificativa: string
  ) => void
  onWhatsApp: () => void
  cor: string
}) {
  const [
    descontarPacote,
    setDescontarPacote
  ] = useState(false)
  const [
    justificativa,
    setJustificativa
  ] = useState('')

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">
              Não comparecimento
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {agendamento?.clientes?.nome ||
                'Cliente'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X
              size={17}
              className="text-gray-600"
            />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <X
                  size={17}
                />
              </div>

              <div>
                <p className="text-sm font-medium text-red-800">
                  A cliente não compareceu?
                </p>
                <p className="text-xs text-red-700/80 mt-1">
                  Ao confirmar, o atendimento será retirado da aba Confirmar.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 p-4 mt-4">
            <p className="text-sm text-gray-700">
              <span className="font-medium">
                Serviço:
              </span>{' '}
              {agendamento?.servicos?.nome ||
                agendamento?.servico_nome ||
                'Atendimento'}
            </p>

            <p className="text-sm text-gray-600 mt-2">
              <span className="font-medium">
                Data:
              </span>{' '}
              {formatarDataHoraLocal(
                agendamento?.data_hora
              )}
            </p>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
              placeholder="Ex.: não avisou, teve imprevisto, solicitou remarcar..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none outline-none focus:border-red-300"
            />
          </div>

          {carregandoCoberturas ? (
            <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-center">
              <div
                className="w-6 h-6 rounded-full border-2 border-gray-400 border-t-transparent animate-spin mx-auto"
              />
              <p className="text-xs text-gray-500 mt-2">
                Verificando pacote...
              </p>
            </div>
          ) : coberturas.length >
            0 ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() =>
                  setDescontarPacote(
                    prev => !prev
                  )
                }
                className={`w-full rounded-2xl border p-4 text-left ${
                  descontarPacote
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Descontar do pacote
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Registrar a falta como uma sessão utilizada.
                    </p>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      descontarPacote
                        ? 'bg-red-500 border-red-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {descontarPacote && (
                      <Check
                        size={13}
                        className="text-white"
                      />
                    )}
                  </div>
                </div>
              </button>

              {descontarPacote && (
                <div className="mt-3 space-y-2">
                  {coberturas.map(
                    (
                      cobertura,
                      index
                    ) => (
                      <div
                        key={`${cobertura.servicoId}-${index}`}
                        className="rounded-2xl border border-gray-200 p-3"
                      >
                        <p className="text-sm font-medium text-gray-800">
                          {
                            cobertura.servicoNome
                          }
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          {cobertura.sessoesEquivalentes}{' '}
                          sessão(ões)
                        </p>

                        {cobertura.pacotesDisponiveis.length >
                          0 && (
                          <select
                            value={
                              cobertura.clientePacoteIdSelecionado ||
                              ''
                            }
                            onChange={e =>
                              setCoberturas(
                                prev =>
                                  prev.map(
                                    (
                                      item,
                                      i
                                    ) =>
                                      i ===
                                      index
                                        ? {
                                            ...item,
                                            clientePacoteIdSelecionado:
                                              e.target.value ||
                                              null
                                          }
                                        : item
                                  )
                              )
                            }
                            className="w-full mt-3 rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white"
                          >
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
                                  {
                                    pacote.nome
                                  }{' '}
                                  —{' '}
                                  {
                                    pacote.sessoesRestantes
                                  }{' '}
                                  restante(s)
                                </option>
                              )
                            )}
                          </select>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">
                Esta cliente não possui pacote disponível para desconto.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onWhatsApp}
            className="w-full mt-5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 flex items-center justify-center gap-2"
          >
            <MessageCircle
              size={17}
            />
            Falar com a cliente
          </button>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() =>
                onConfirm(
                  descontarPacote,
                  justificativa
                )
              }
              disabled={salvando}
              className="rounded-xl bg-red-500 text-white px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {salvando
                ? 'Salvando...'
                : 'Marcar não veio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatarDataHoraLocal(
  valor: string
) {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) {
    return valor
  }
  return data.toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }
  )
}

function formatarHoraLocal(
  valor: string
) {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) {
    return ''
  }
  return data.toLocaleTimeString(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  )
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
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL CONFIRMAR ATENDIMENTO */}
      {modalConfirmar && (
        <ModalAtendimento
          agendamento={
            modalConfirmar
          }
          pacotesDisponiveis={
            pacotesConfirmacao
          }
          coberturaServicos={
            coberturaServicos
          }
          servicosSemCobertura={
            servicosSemCobertura
          }
          pacoteSelecionado={
            pacoteSelecionado
          }
          setPacoteSelecionado={
            setPacoteSelecionado
          }
          observacaoAtendimento={
            observacaoAtendimento
          }
          setObservacaoAtendimento={
            setObservacaoAtendimento
          }
          salvando={salvando}
          onClose={() => {
            if (!salvando) {
              setModalConfirmar(null)
              setPacoteSelecionado(null)
              setObservacaoAtendimento('')
            }
          }}
          onConfirmar={
            confirmarAtendimento
          }
        />
      )}
      {/* MODAL NÃO COMPARECIMENTO */}
      {modalNaoComparecimento && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-
center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-
3xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#e8e8e8] flex items-center 
justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  Não compareceu
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {obterNomeCliente(
                    modalNaoComparecimento
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setModalNaoComparecimento(
                    null
                  )
                }
                disabled={salvando}
                className="w-9 h-9 rounded-full bg-[#f7f7f7] flex items-center 
justify-center text-gray-500 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm text-gray-600">
                Tem certeza de que deseja registrar que a cliente não veio?
              </p>

              <div className="mt-4 rounded-xl bg-[#fff7f7] border border-
[#f0dddd] p-3">
                <p className="text-xs text-[#9b5e5e]">
                  O atendimento será retirado da lista de confirmações e ficará
                  registrado como não comparecimento.
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() =>
                    setModalNaoComparecimento(
                      null
                    )
                  }
                  className="h-11 rounded-xl border border-[#e2e2e2] text-sm 
font-semibold text-gray-600 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={salvando}
                  onClick={
                    registrarNaoComparecimento
                  }
                  className="h-11 rounded-xl bg-[#a45f5f] text-white text-sm 
font-semibold disabled:opacity-50"
                >
                  {salvando
                    ? 'Registrando...'
                    : 'Confirmar não veio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoBox({
  label,
  value
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-[#f8f8f8] p-3">
      <p className="text-[11px] text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-700 mt-1">
        {value}
      </p>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  text
}: {
  icon: React.ReactNode
  title: string
  text?: string
}) {
  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-[#f7f7f7] flex items-center 
justify-center text-gray-400">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-gray-700">
        {title}
      </h3>
      {text && (
        <p className="mt-1 text-sm text-gray-500">
          {text}
        </p>
      )}
    </div>
  )
}

function ModalAtendimento({
  agendamento,
  pacotesDisponiveis,
  coberturaServicos,
  servicosSemCobertura,
  pacoteSelecionado,
  setPacoteSelecionado,
  observacaoAtendimento,
  setObservacaoAtendimento,
  salvando,
  onClose,
  onConfirmar
}: {
  agendamento: any
  pacotesDisponiveis: any[]
  coberturaServicos: CoberturaServico[]
  servicosSemCobertura: any[]
  pacoteSelecionado: string | null
  setPacoteSelecionado: (
    id: string | null
  ) => void
  observacaoAtendimento: string
  setObservacaoAtendimento: (
    value: string
  ) => void
  salvando: boolean
  onClose: () => void
  onConfirmar: () => void
}) {
  const servicoNome =
    agendamento?.servicos?.nome ||
    agendamento?.servico_nome ||
    'Atendimento'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center 
justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl 
shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-[#e8e8e8] flex items-center 
justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-lg">
              Confirmar atendimento
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {agendamento?.clientes?.nome ||
                'Cliente'}
              {' • '}
              {servicoNome}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="w-9 h-9 rounded-full bg-[#f7f7f7] flex items-center justify-
center text-gray-500 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {pacotesDisponiveis.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700">
                Pacote
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Escolha o pacote que será utilizado neste atendimento.
              </p>

              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    setPacoteSelecionado(
                      null
                    )
                  }
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    pacoteSelecionado === null
                      ? 'border-[var(--cor-salao)] bg-[var(--cor-salao)]/5'
                      : 'border-[#e5e5e5] bg-white'
                  }`}
                >
                  <p className="text-sm font-medium">
                    Sem pacote
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Registrar atendimento normalmente
                  </p>
                </button>

                {pacotesDisponiveis.map(
                  (pacote: any) => (
                    <button
                      key={
                        pacote.id ||
                        pacote.clientePacoteId
                      }
                      type="button"
                      onClick={() =>
                        setPacoteSelecionado(
                          pacote.id ||
                            pacote.clientePacoteId
                        )
                      }
                      className={`w-full text-left rounded-xl border p-3 transition ${
                        pacoteSelecionado ===
                        (pacote.id ||
                          pacote.clientePacoteId)
                          ? 'border-[var(--cor-salao)] bg-[var(--cor-salao)]/5'
                          : 'border-[#e5e5e5] bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {pacote.nome ||
                              pacote.servico ||
                              'Pacote'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {pacote.sessoesRestantes ??
                              pacote.sessoes_restantes ??
                              0}{' '}
                            sessões restantes
                          </p>
                        </div>

                        {pacoteSelecionado ===
                          (pacote.id ||
                            pacote.clientePacoteId) && (
                          <div className="w-6 h-6 rounded-full bg-[var(--cor-salao)] 
text-white flex items-center justify-center shrink-0">
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {coberturaServicos.length > 0 && (
            <div className="mt-5">
              <h4 className="text-sm font-semibold text-gray-700">
                Cobertura do atendimento
              </h4>

              <div className="mt-3 space-y-2">
                {coberturaServicos.map(
                  cobertura => (
                    <div
                      key={
                        cobertura.servicoId
                      }
                      className="rounded-xl bg-[#f8f8f8] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-700">
                          {
                            cobertura.servicoNome
                          }
                        </p>
                        <span className="text-xs text-gray-500">
                          {cobertura.sessoesEquivalentes}{' '}
                          sessão
                          {cobertura.sessoesEquivalentes !==
                          1
                            ? 'ões'
                            : ''}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {servicosSemCobertura.length > 0 && (
            <div className="mt-5 rounded-xl bg-[#fff8e8] border border-[#f0e2b9] p-3">
              <p className="text-xs font-semibold text-[#8a6a1e]">
                Serviços sem cobertura de pacote
              </p>
              <p className="text-xs text-[#8a6a1e] mt-1">
                {servicosSemCobertura
                  .map(
                    (servico: any) =>
                      servico.nome ||
                      servico.servicoNome
                  )
                  .join(', ')}
              </p>
            </div>
          )}

          <div className="mt-5">
            <label className="text-sm font-semibold text-gray-700 block">
              Observação
            </label>
            <textarea
              value={
                observacaoAtendimento
              }
              onChange={e =>
                setObservacaoAtendimento(
                  e.target.value
                )
              }
              rows={4}
              placeholder="Alguma observação sobre este atendimento..."
              className="mt-2 w-full rounded-xl border border-[#e2e2e2] p-3 text-sm 
resize-none outline-none focus:border-[var(--cor-salao)]"
            />
          </div>
        </div>

        <div className="p-5 border-t border-[#e8e8e8] grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="h-11 rounded-xl border border-[#e2e2e2] text-sm font-semibold 
text-gray-600 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            disabled={salvando}
            className="h-11 rounded-xl bg-[var(--cor-salao)] text-white text-sm 
font-semibold disabled:opacity-50"
          >
            {salvando
              ? 'Confirmando...'
              : 'Confirmar atendimento'}
          </button>
        </div>
      </div>
    </div>
  )
}