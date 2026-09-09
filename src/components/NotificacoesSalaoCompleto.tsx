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

// ─── Tipos ────────────────────────────────────────────────────────────────
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
  console.log(
    '🚀 [TESTE] A página NotificacoesDonoPage foi renderizada!'
  )

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

  // ─── Inicialização ──────────────────────────────────────────────────────

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

  // ─── Push ───────────────────────────────────────────────────────────────

  async function registrarPushNotification() {
    console.log(
      '🔔 [PUSH] 1 - Iniciando registro de Push Notification...'
    )

    if (typeof window === 'undefined') {
      console.log(
        '🔔 [PUSH] X - Window não definido (SSR)'
      )
      return
    }

    if (!('serviceWorker' in navigator)) {
      console.log(
        '🔔 [PUSH] X - Service Worker não suportado neste navegador'
      )
      return
    }

    if (!('PushManager' in window)) {
      console.log(
        '🔔 [PUSH] X - PushManager não suportado neste navegador'
      )
      return
    }

    if (!profile?.id || !profile?.salao_id) {
      console.log(
        '🔔 [PUSH] X - Profile ainda não disponível'
      )
      return
    }

    try {
      console.log(
        '🔔 [PUSH] 2 - Aguardando serviceWorker.ready...'
      )

      const registration =
        await navigator.serviceWorker.ready

      console.log(
        '🔔 [PUSH] 3 - Service Worker pronto:',
        registration
      )

      const vapidKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      console.log(
        '🔔 [PUSH] 4 - VAPID Public Key presente?',
        !!vapidKey
      )

      if (!vapidKey) {
        console.error(
          '🔔 [PUSH] X - NEXT_PUBLIC_VAPID_PUBLIC_KEY não está definida!'
        )
        return
      }

      let subscription =
        await registration.pushManager.getSubscription()

      if (subscription) {
        console.log(
          '🔔 [PUSH] 5 - Subscription existente encontrada'
        )
      } else {
        console.log(
          '🔔 [PUSH] 5 - Nenhuma subscription existente. Criando nova...'
        )

        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              vapidKey,
          })

        console.log(
          '🔔 [PUSH] 6 - Nova subscription criada com sucesso'
        )
      }

      const subscriptionJson =
        subscription.toJSON()

      console.log(
        '🔔 [PUSH] Subscription:',
        {
          endpoint:
            subscriptionJson.endpoint,
          expirationTime:
            subscriptionJson.expirationTime,
          possuiP256dh:
            !!subscriptionJson.keys?.p256dh,
          possuiAuth:
            !!subscriptionJson.keys?.auth,
        }
      )

      if (
        !subscriptionJson.endpoint ||
        !subscriptionJson.keys?.p256dh ||
        !subscriptionJson.keys?.auth
      ) {
        console.error(
          '🔔 [PUSH] X - Subscription incompleta ou inválida'
        )
        return
      }

      console.log(
        '🔔 [PUSH] 7 - Salvando subscription no Supabase...'
      )

      const dadosSubscription = {
        profile_id: profile.id,
        user_id: profile.id,
        salao_id: profile.salao_id,
        subscription: subscriptionJson,
        updated_at: new Date().toISOString(),
      }

      const {
        data: subscriptionSalva,
        error: upsertError,
      } = await supabase
        .from('push_subscriptions')
        .upsert(
          dadosSubscription,
          {
            onConflict: 'user_id',
          }
        )
        .select(
          'id, profile_id, user_id, salao_id, subscription'
        )
        .single()

      if (upsertError) {
        console.error(
          '🔔 [PUSH] ERRO ao salvar subscription pelo user_id:',
          upsertError
        )

        const {
          data: existente,
          error: existenteError,
        } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq(
            'profile_id',
            profile.id
          )
          .maybeSingle()

        if (existenteError) {
          console.error(
            '🔔 [PUSH] Erro ao procurar subscription existente:',
            existenteError
          )
        }

        if (existente?.id) {
          const {
            error: updateError,
          } = await supabase
            .from('push_subscriptions')
            .update(
              dadosSubscription
            )
            .eq(
              'id',
              existente.id
            )

          if (updateError) {
            console.error(
              '🔔 [PUSH] ERRO no fallback de atualização:',
              updateError
            )
          } else {
            console.log(
              '🔔 [PUSH] Subscription atualizada pelo profile_id'
            )
          }
        } else {
          const {
            error: insertError,
          } = await supabase
            .from('push_subscriptions')
            .insert(
              dadosSubscription
            )

          if (insertError) {
            console.error(
              '🔔 [PUSH] ERRO ao inserir subscription no fallback:',
              insertError
            )
          } else {
            console.log(
              '🔔 [PUSH] Subscription criada pelo fallback'
            )
          }
        }

        return
      }

      console.log(
        '🔔 [PUSH] 8 - Subscription salva com sucesso:',
        subscriptionSalva
      )

      console.log(
        '🔔 [PUSH] Registro concluído com sucesso.'
      )
    } catch (err: any) {
      console.error(
        '🔔 [PUSH] ERRO crítico ao registrar push:',
        err
      )
    }
  }

  // ─── Carregar dados ─────────────────────────────────────────────────────

  async function carregarDados() {
    if (!profile?.salao_id) return

    const { data: sal } = await supabase
      .from('saloes')
      .select('*')
      .eq('id', profile.salao_id)
      .single()

    setSalao(sal)

    // Solicitações
    // Mantemos o select original (*) para não retirar nenhum campo
    // utilizado pela tela, incluindo data/período escolhidos pela cliente.
    const { data: sols } = await supabase
      .from('solicitacoes_agendamento')
      .select(
        '*, clientes(id, nome, email, telefone), servicos(nome, duracao_minutos)'
      )
      .eq('salao_id', profile.salao_id)
      .in('status', ['pendente', 'horario_sugerido'])
      .order('created_at', { ascending: false })

    setSolicitacoes(sols || [])

    // ─── CONFIRMAÇÕES ─────────────────────────────────────────────────────
    //
    // IMPORTANTE:
    // Não existe mais limite de data aqui.
    //
    // O atendimento permanece na aba "Confirmar" enquanto:
    //
    // 1. pertencer ao salão;
    // 2. estiver com status "confirmado";
    // 3. ainda não possuir registro em
    //    confirmacoes_atendimento.
    //
    // Portanto, se passar 1 dia, 1 semana ou mais,
    // ele continuará aparecendo até ser tratado.
    const { data: ags } = await supabase
      .from('agendamentos')
      .select(
        '*, clientes(id, nome, telefone), servicos(nome, id), confirmacoes_atendimento(*)'
      )
      .eq('salao_id', profile.salao_id)
      .eq('status', 'confirmado')
      .order('data_hora')

    setConfirmacoes(
      (ags || []).filter(
        (a: any) =>
          !a.confirmacoes_atendimento?.length
      )
    )

    // Notificações
    const { data: notifs } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('salao_id', profile.salao_id)
      .eq('destinatario_id', profile.id)
      .eq('excluida', false)
      .order('created_at', { ascending: false })

    setNotificacoes(notifs || [])

    // Notificações excluídas
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

  // ─── Formatação da preferência da cliente ──────────────────────────────

  function formatarDataPreferida(solicitacao: any) {
    const data =
      solicitacao?.data_preferida ??
      solicitacao?.data_desejada ??
      solicitacao?.data_solicitada ??
      solicitacao?.data

    if (!data) return null

    // Evita problemas de fuso quando o banco retorna somente YYYY-MM-DD.
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

  // ─── Notificações ──────────────────────────────────────────────────────

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

  // ─── PACOTES ────────────────────────────────────────────────────────────

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

    if (!clienteNome) {
      console.error(
        'Não foi possível identificar o nome do cliente.'
      )
      return []
    }

    const {
      data: pacotesData,
      error: pacotesError
    } = await supabase
      .from('pacotes_clientes_resumo')
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

    if (pacotesError) {
      console.error(
        'Erro ao consultar pacotes_clientes_resumo:',
        pacotesError
      )
    }

    const opcoesGerais: PacoteOpcao[] =
      (pacotesData || [])
        .map((pacote: any) => ({
          clientePacoteId:
            pacote.id,
          nome:
            pacote.servico ||
            'Pacote',
          sessoesRestantes:
            Number(
              pacote.sessoes_restantes ??
                0
            )
        }))
        .filter(
          pacote =>
            pacote.sessoesRestantes >
            0
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
            opcoesGerais.length > 0
              ? opcoesGerais[0]
                  .clientePacoteId
              : null,
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
            srv?.sessoes_equivalentes ??
              1
          ),
        clientePacoteIdSelecionado:
          opcoesGerais.length > 0
            ? opcoesGerais[0]
                .clientePacoteId
            : null,
        pacotesDisponiveis:
          opcoesGerais
      }
    })
  }
  // ─── CONFIRMAR ATENDIMENTO ──────────────────────────────────────────────

  async function abrirModalConfirmar(agendamento: any) {
    setModalConfirmar(agendamento)
    setServicoRealizado(
      agendamento.servicos?.nome ||
      agendamento.servico_nome ||
      ''
    )
  }

  async function confirmarAtendimento() {
    if (!modalConfirmar || !profile?.salao_id) return

    setSalvando(true)

    try {
      const agendamento = modalConfirmar

      const { error: erroConfirmacao } =
        await supabase
          .from('confirmacoes_atendimento')
          .insert({
            agendamento_id: agendamento.id,
            salao_id: profile.salao_id,
            confirmado_por: profile.id,
            confirmado_em:
              new Date().toISOString()
          })

      if (erroConfirmacao) {
        throw erroConfirmacao
      }

      const { error: erroAgendamento } =
        await supabase
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
        salao_id: profile.salao_id,
        tipo: 'atendimento_confirmado',
        titulo: 'Atendimento confirmado',
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

  // ─── NÃO COMPARECEU ────────────────────────────────────────────────────

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
      // Se a opção for descontar pacote,
      // primeiro processamos os descontos.
      if (descontarPacote) {
        await aplicarDescontosPacotes(
          agendamento,
          justificativa
        )
      }

      // O atendimento passa para
      // "nao_compareceu".
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
        salao_id: profile.salao_id,
        tipo: 'nao_compareceu',
        titulo: 'Atendimento não realizado',
        mensagem: `O atendimento de ${
          agendamento.clientes?.nome ||
          'cliente'
        } foi marcado como não comparecimento.`,
        destinatario_id:
          agendamento.cliente_id ||
          null,
        url: '/cliente/pacotes'
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

  // ─── DESCONTO DOS PACOTES ──────────────────────────────────────────────

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

    const { data: pacotes, error } =
      await supabase
        .from('pacotes_clientes_resumo')
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
      throw error
    }

    if (!pacotes?.length) {
      return
    }

    const coberturasAtuais =
      coberturas.length > 0
        ? coberturas
        : await montarCoberturas(
            agendamento
          )

    const dataRegistro =
      new Date().toISOString()

    // ────────────────────────────────────────────────────────────────────
    // Cada serviço do agendamento possui sua própria quantidade de
    // sessões equivalentes.
    //
    // Exemplo:
    // Manicure = 1 sessão
    // Massagem = 2 sessões
    //
    // O desconto precisa considerar TODOS os serviços agendados.
    // ────────────────────────────────────────────────────────────────────

    for (const cobertura of coberturasAtuais) {
      let quantidadeRestante =
        Number(
          cobertura.sessoesEquivalentes ||
            1
        )

      if (
        quantidadeRestante <= 0
      ) {
        continue
      }

      // Primeiro tenta usar o pacote escolhido para aquele serviço.
      let pacoteSelecionado =
        cobertura.clientePacoteIdSelecionado
          ? pacotes.find(
              (p: any) =>
                p.id ===
                cobertura.clientePacoteIdSelecionado
            )
          : null

      // Se não houver pacote selecionado,
      // usa o primeiro pacote compatível/disponível.
      if (
        !pacoteSelecionado
      ) {
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
                  p.sessoes_restantes ||
                    0
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
          restantesAntes -
          desconto

        let historico =
          Array.isArray(
            pacoteSelecionado.historico_sessoes
          )
            ? [
                ...pacoteSelecionado.historico_sessoes
              ]
            : []

        historico.push({
          tipo: 'nao_comparecimento',
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

        const { error: erroUpdate } =
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

        if (erroUpdate) {
          throw erroUpdate
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

  // ─── SOLICITAÇÕES ──────────────────────────────────────────────────────

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
        salao_id: profile.salao_id,
        tipo: 'solicitacao_aceita',
        titulo: 'Agendamento confirmado',
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

    const motivo = window.prompt(
      'Informe o motivo da recusa:'
    )

    if (
      motivo === null
    ) {
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
          status: 'recusado',
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
        salao_id: profile.salao_id,
        tipo: 'solicitacao_recusada',
        titulo: 'Solicitação recusada',
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

  // ─── SUGESTÃO DE HORÁRIOS ──────────────────────────────────────────────

  async function salvarSugestaoHorario() {
    if (
      !modalSugestao ||
      !profile?.salao_id
    ) {
      return
    }

    const horarios = horariosLivres.filter(
      h => h.trim()
    )

    if (
      horarios.length === 0
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
          status: 'horario_sugerido',
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
        salao_id: profile.salao_id,
        tipo: 'horarios_sugeridos',
        titulo: 'Novos horários disponíveis',
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

  // ─── EXCLUIR NOTIFICAÇÃO ───────────────────────────────────────────────

  async function excluirNotificacao(
    notificacao: any
  ) {
    try {
      const {
        error
      } = await supabase
        .from('notificacoes')
        .update({
          excluida: true
        })
        .eq(
          'id',
          notificacao.id
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

      setNotificacoesExcluidas(
        prev => [
          notificacao,
          ...prev
        ]
      )

    } catch (error: any) {
      console.error(
        'Erro ao excluir notificação:',
        error
      )
    }
  }

  async function restaurarNotificacao(
    notificacao: any
  ) {
    try {
      const {
        error
      } = await supabase
        .from('notificacoes')
        .update({
          excluida: false
        })
        .eq(
          'id',
          notificacao.id
        )

      if (error) {
        throw error
      }

      setNotificacoesExcluidas(
        prev =>
          prev.filter(
            item =>
              item.id !==
              notificacao.id
          )
      )

      setNotificacoes(prev => [
        notificacao,
        ...prev
      ])

    } catch (error: any) {
      console.error(
        'Erro ao restaurar notificação:',
        error
      )
    }
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-current animate-spin" />
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

  const cor =
    salao?.cor_primaria ||
    '#8FA88F'

  const quantidadeConfirmacoes =
    confirmacoes.length

  const quantidadeSolicitacoes =
    solicitacoes.length

  const quantidadeNotificacoes =
    notificacoes.filter(
      n => !n.lida
    ).length

  return (
    <div
      className="min-h-screen bg-gray-50 pb-24"
      style={
        {
          '--cor-salao': cor
        } as React.CSSProperties
      }
    >
      {/* CABEÇALHO */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50"
          >
            <ArrowLeft
              size={19}
              className="text-gray-600"
            />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900">
              Central de Atendimento
            </h1>

            <p className="text-xs text-gray-400">
              Gerencie solicitações e atendimentos
            </p>
          </div>

          <Bell
            size={21}
            style={{
              color: cor
            }}
          />
        </div>
      </header>

      {/* ABAS */}
      <div className="bg-white border-b border-gray-100 sticky top-[73px] z-20">
        <div className="max-w-xl mx-auto px-3">
          <div className="flex overflow-x-auto no-scrollbar">

            <button
              type="button"
              onClick={() =>
                setAba('pedidos')
              }
              className={`flex-1 min-w-[90px] py-3 text-xs font-semibold border-b-2 transition-colors ${
                aba === 'pedidos'
                  ? 'text-gray-900'
                  : 'text-gray-400 border-transparent'
              }`}
              style={
                aba === 'pedidos'
                  ? {
                      borderColor: cor,
                      color: cor
                    }
                  : {}
              }
            >
              Pedidos
              {quantidadeSolicitacoes >
                0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] text-white"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  {quantidadeSolicitacoes}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setAba('confirmacoes')
              }
              className={`flex-1 min-w-[90px] py-3 text-xs font-semibold border-b-2 transition-colors ${
                aba === 'confirmacoes'
                  ? 'text-gray-900'
                  : 'text-gray-400 border-transparent'
              }`}
              style={
                aba === 'confirmacoes'
                  ? {
                      borderColor: cor,
                      color: cor
                    }
                  : {}
              }
            >
              Confirmar
              {quantidadeConfirmacoes >
                0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] text-white"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  {quantidadeConfirmacoes}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setAba('notificacoes')
              }
              className={`flex-1 min-w-[90px] py-3 text-xs font-semibold border-b-2 transition-colors ${
                aba === 'notificacoes'
                  ? 'text-gray-900'
                  : 'text-gray-400 border-transparent'
              }`}
              style={
                aba === 'notificacoes'
                  ? {
                      borderColor: cor,
                      color: cor
                    }
                  : {}
              }
            >
              Notificações
              {quantidadeNotificacoes >
                0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] text-white"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  {quantidadeNotificacoes}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setAba('excluidas')
              }
              className={`flex-1 min-w-[90px] py-3 text-xs font-semibold border-b-2 transition-colors ${
                aba === 'excluidas'
                  ? 'text-gray-900'
                  : 'text-gray-400 border-transparent'
              }`}
              style={
                aba === 'excluidas'
                  ? {
                      borderColor: cor,
                      color: cor
                    }
                  : {}
              }
            >
              Excluídas
            </button>

          </div>
        </div>
      </div>
      {/* CONTEÚDO */}
      <main className="max-w-xl mx-auto px-4 py-5">

        {/* ─── PEDIDOS ──────────────────────────────────────────────── */}
        {aba === 'pedidos' && (
          <div className="space-y-3">

            {solicitacoes.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100">
                <Calendar
                  size={38}
                  className="mx-auto text-gray-300 mb-3"
                />

                <p className="font-semibold text-gray-700">
                  Nenhum pedido pendente
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  Quando uma cliente solicitar um agendamento,
                  ele aparecerá aqui.
                </p>
              </div>
            ) : (
              solicitacoes.map(
                (solicitacao: any) => (
                  <div
                    key={solicitacao.id}
                    className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-start gap-3">

                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                        style={{
                          backgroundColor: cor
                        }}
                      >
                        {(
                          solicitacao.clientes
                            ?.nome ||
                          'C'
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">
                          {solicitacao.clientes
                            ?.nome ||
                            'Cliente'}
                        </p>

                        {solicitacao.clientes
                          ?.telefone && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {
                              solicitacao
                                .clientes
                                .telefone
                            }
                          </p>
                        )}

                        <div className="mt-3 space-y-1.5">

                          {solicitacao.servicos
                            ?.nome && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Calendar
                                size={14}
                                className="shrink-0"
                                style={{
                                  color: cor
                                }}
                              />

                              <span>
                                {
                                  solicitacao
                                    .servicos
                                    .nome
                                }
                              </span>
                            </div>
                          )}

                          {formatarDataPreferida(
                            solicitacao
                          ) && (
                            <p className="text-xs text-gray-500">
                              <span className="font-semibold">
                                Data:
                              </span>{' '}
                              {formatarDataPreferida(
                                solicitacao
                              )}
                            </p>
                          )}

                          {formatarPeriodoPreferido(
                            solicitacao
                          ) && (
                            <p className="text-xs text-gray-500">
                              <span className="font-semibold">
                                Período:
                              </span>{' '}
                              {formatarPeriodoPreferido(
                                solicitacao
                              )}
                            </p>
                          )}

                          {solicitacao.observacoes && (
                            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 mt-2">
                              {solicitacao.observacoes}
                            </p>
                          )}

                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4">

                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() =>
                          recusarSolicitacao(
                            solicitacao
                          )
                        }
                        className="py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <X size={14} />
                        Recusar
                      </button>

                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => {
                          setModalSugestao(
                            solicitacao
                          )
                        }}
                        className="py-2.5 rounded-xl border text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                        style={{
                          borderColor: `${cor}55`,
                          color: cor
                        }}
                      >
                        <Clock size={14} />
                        Sugerir
                      </button>

                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() =>
                          aceitarSolicitacao(
                            solicitacao
                          )
                        }
                        className="py-2.5 rounded-xl text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                        style={{
                          backgroundColor: cor
                        }}
                      >
                        <Check size={14} />
                        Aceitar
                      </button>

                    </div>
                  </div>
                )
              )
            )}

          </div>
        )}

        {/* ─── CONFIRMAR ───────────────────────────────────────────── */}
        {aba === 'confirmacoes' && (
          <div className="space-y-3">

            {confirmacoes.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100">
                <Check
                  size={38}
                  className="mx-auto text-gray-300 mb-3"
                />

                <p className="font-semibold text-gray-700">
                  Tudo em dia
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  Não há atendimentos aguardando confirmação.
                </p>
              </div>
            ) : (
              confirmacoes.map(
                (agendamento: any) => {
                  const dataHora =
                    agendamento.data_hora
                      ? new Date(
                          agendamento.data_hora
                        )
                      : null

                  return (
                    <div
                      key={agendamento.id}
                      className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm"
                    >

                      <div className="flex items-start gap-3">

                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                          style={{
                            backgroundColor: cor
                          }}
                        >
                          {(
                            agendamento
                              .clientes
                              ?.nome ||
                            'C'
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">

                          <div className="flex items-start justify-between gap-2">

                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 truncate">
                                {agendamento.clientes
                                  ?.nome ||
                                  'Cliente'}
                              </p>

                              {agendamento.clientes
                                ?.telefone && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {
                                    agendamento
                                      .clientes
                                      .telefone
                                  }
                                </p>
                              )}
                            </div>

                            <span
                              className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full"
                              style={{
                                backgroundColor:
                                  `${cor}12`,
                                color: cor
                              }}
                            >
                              Aguardando
                            </span>

                          </div>

                          <div className="mt-3 space-y-1.5">

                            {agendamento.servicos
                              ?.nome && (
                              <p className="text-sm font-medium text-gray-700">
                                {
                                  agendamento
                                    .servicos
                                    .nome
                                }
                              </p>
                            )}

                            {dataHora && (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Calendar
                                  size={14}
                                  style={{
                                    color: cor
                                  }}
                                />

                                <span>
                                  {dataHora.toLocaleDateString(
                                    'pt-BR',
                                    {
                                      weekday:
                                        'short',
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric'
                                    }
                                  )}
                                </span>

                                <Clock
                                  size={14}
                                  className="ml-1"
                                  style={{
                                    color: cor
                                  }}
                                />

                                <span>
                                  {dataHora.toLocaleTimeString(
                                    'pt-BR',
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    }
                                  )}
                                </span>
                              </div>
                            )}

                          </div>
                        </div>
                      </div>

                      {/* AÇÕES DO ATENDIMENTO */}
                      <div className="grid grid-cols-2 gap-2 mt-4">

                        {/* NÃO VEIO */}
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() =>
                            iniciarNaoComparecimento(
                              agendamento
                            )
                          }
                          className="py-3 rounded-2xl border border-gray-200 text-gray-600 text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <X size={15} />
                          Não veio
                        </button>

                        {/* CONFIRMAR */}
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() =>
                            abrirModalConfirmar(
                              agendamento
                            )
                          }
                          className="py-3 rounded-2xl text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                          style={{
                            backgroundColor: cor
                          }}
                        >
                          <Check size={15} />
                          Confirmar atendimento
                        </button>

                      </div>

                    </div>
                  )
                }
              )
            )}

          </div>
        )}

        {/* ─── NOTIFICAÇÕES ────────────────────────────────────────── */}
        {aba === 'notificacoes' && (
          <div className="space-y-3">

            {notificacoes.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100">
                <Bell
                  size={38}
                  className="mx-auto text-gray-300 mb-3"
                />

                <p className="font-semibold text-gray-700">
                  Nenhuma notificação
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  Você está em dia.
                </p>
              </div>
            ) : (
              notificacoes.map(
                (notificacao: any) => (
                  <div
                    key={notificacao.id}
                    className={`bg-white rounded-3xl p-4 border shadow-sm ${
                      notificacao.lida
                        ? 'border-gray-100'
                        : 'border-gray-200'
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
                      <div className="flex items-start gap-3">

                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor:
                              `${cor}12`,
                            color: cor
                          }}
                        >
                          <Bell size={18} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm ${
                                notificacao.lida
                                  ? 'font-medium'
                                  : 'font-bold'
                              } text-gray-900`}
                            >
                              {notificacao.titulo ||
                                'Notificação'}
                            </p>

                            {!notificacao.lida && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                                style={{
                                  backgroundColor:
                                    cor
                                }}
                              />
                            )}
                          </div>

                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            {notificacao.mensagem}
                          </p>

                          {notificacao.created_at && (
                            <p className="text-[10px] text-gray-400 mt-2">
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

                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          excluirNotificacao(
                            notificacao
                          )
                        }
                        className="text-[10px] text-gray-400 flex items-center gap-1 px-2 py-1"
                      >
                        <Trash2 size={12} />
                        Excluir
                      </button>
                    </div>
                  </div>
                )
              )
            )}

          </div>
        )}

        {/* ─── EXCLUÍDAS ───────────────────────────────────────────── */}
        {aba === 'excluidas' && (
          <div className="space-y-3">

            {notificacoesExcluidas.length ===
            0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100">
                <Trash2
                  size={38}
                  className="mx-auto text-gray-300 mb-3"
                />

                <p className="font-semibold text-gray-700">
                  Nenhuma notificação excluída
                </p>
              </div>
            ) : (
              notificacoesExcluidas.map(
                (notificacao: any) => (
                  <div
                    key={notificacao.id}
                    className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-start gap-3">

                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <Bell
                          size={18}
                          className="text-gray-400"
                        />
                      </div>

                      <div className="flex-1 min-w-0">

                        <p className="text-sm font-semibold text-gray-800">
                          {notificacao.titulo ||
                            'Notificação'}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          {notificacao.mensagem}
                        </p>

                        {notificacao.created_at && (
                          <p className="text-[10px] text-gray-400 mt-2">
                            {new Date(
                              notificacao.created_at
                            ).toLocaleString(
                              'pt-BR'
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
                      className="w-full mt-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center gap-1.5"
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

      </main>
      {/* MODAL SUGERIR HORÁRIOS */}
      {modalSugestao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  Sugerir horários
                </h3>

                <p className="text-xs text-gray-400 mt-1">
                  {modalSugestao.clientes?.nome ||
                    'Cliente'}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalSugestao(null)
                }
                className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center"
              >
                <X
                  size={18}
                  className="text-gray-500"
                />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Informe até três horários disponíveis para a cliente.
            </p>

            <div className="space-y-3">
              {horariosLivres.map(
                (horario, index) => (
                  <div key={index}>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Opção {index + 1}
                    </label>

                    <input
                      type="datetime-local"
                      value={horario}
                      onChange={e => {
                        const novos =
                          [...horariosLivres]

                        novos[index] =
                          e.target.value

                        setHorariosLivres(
                          novos
                        )
                      }}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2"
                      style={
                        {
                          '--tw-ring-color': cor
                        } as React.CSSProperties
                      }
                    />
                  </div>
                )
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() =>
                  setModalSugestao(null)
                }
                disabled={salvando}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  salvarSugestaoHorario
                }
                disabled={salvando}
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: cor
                }}
              >
                {salvando ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <MessageCircle
                      size={16}
                    />
                    Enviar horários
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ATENDIMENTO */}
      {modalConfirmar &&
        modalConfirmar.tipo !==
          'nao_compareceu' && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">

              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">
                    Confirmar atendimento
                  </h3>

                  <p className="text-xs text-gray-400 mt-1">
                    Confirme que o atendimento realmente aconteceu.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setModalConfirmar(
                      null
                    )
                  }
                  className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center"
                >
                  <X
                    size={18}
                    className="text-gray-500"
                  />
                </button>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <p className="font-bold text-gray-900">
                  {modalConfirmar.clientes
                    ?.nome ||
                    'Cliente'}
                </p>

                {modalConfirmar.servicos
                  ?.nome && (
                  <p className="text-sm text-gray-600 mt-1">
                    {
                      modalConfirmar
                        .servicos
                        .nome
                    }
                  </p>
                )}

                {modalConfirmar.data_hora && (
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(
                      modalConfirmar.data_hora
                    ).toLocaleString(
                      'pt-BR'
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
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
                  placeholder="Nome do serviço"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() =>
                    setModalConfirmar(
                      null
                    )
                  }
                  disabled={salvando}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={
                    confirmarAtendimento
                  }
                  disabled={salvando}
                  className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  {salvando ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Confirmando...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Confirmar atendimento
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

      {/* MODAL NÃO COMPARECEU */}
      {modalConfirmar?.tipo ===
        'nao_compareceu' && (
        <NaoCompareceuModal
          agendamento={
            modalConfirmar.agendamento
          }
          cor={cor}
          salvando={salvando}
          coberturas={coberturas}
          carregandoCoberturas={
            carregandoCoberturas
          }
          onClose={() =>
            setModalConfirmar(null)
          }
          onConfirmar={(
            descontarPacote,
            justificativa
          ) =>
            registrarNaoComparecimento(
              modalConfirmar.agendamento,
              descontarPacote,
              justificativa
            )
          }
        />
      )}

    </div>
  )
}

// ─── MODAL DE NÃO COMPARECIMENTO ─────────────────────────────────────────

function NaoCompareceuModal({
  agendamento,
  cor,
  salvando,
  coberturas,
  carregandoCoberturas,
  onClose,
  onConfirmar
}: {
  agendamento: any
  cor: string
  salvando: boolean
  coberturas: CoberturaServico[]
  carregandoCoberturas: boolean
  onClose: () => void
  onConfirmar: (
    descontarPacote: boolean,
    justificativa: string
  ) => void
}) {
  const [etapa, setEtapa] = useState<
    'antecedencia' | 'desconto' | 'justificativa'
  >('antecedencia')

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

  function escolherAntecedencia(
    avisou: boolean
  ) {
    setAvisouComAntecedencia(
      avisou
    )

    if (avisou) {
      // Se avisou com antecedência,
      // não há desconto de pacote.
      setDescontarPacote(false)
      setEtapa(
        'justificativa'
      )
    } else {
      // Se não avisou com antecedência,
      // o salão decide se irá descontar.
      setEtapa('desconto')
    }
  }

  function escolherDesconto(
    descontar: boolean
  ) {
    setDescontarPacote(
      descontar
    )

    if (descontar) {
      // Para descontar, exigimos
      // uma justificativa escrita.
      setEtapa(
        'justificativa'
      )
    } else {
      // Sem desconto, não é necessária
      // justificativa para o pacote.
      onConfirmar(
        false,
        ''
      )
    }
  }

  function confirmarJustificativa() {
    if (
      descontarPacote &&
      !justificativa.trim()
    ) {
      alert(
        'Escreva uma justificativa antes de descontar a sessão do pacote.'
      )
      return
    }

    onConfirmar(
      Boolean(descontarPacote),
      justificativa.trim()
    )
  }

  const nomeCliente =
    agendamento?.clientes?.nome ||
    'Cliente'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl p-6 max-h-[92vh] overflow-y-auto">

        {/* CABEÇALHO */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              Não compareceu
            </h3>

            <p className="text-xs text-gray-400 mt-1">
              {nomeCliente}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            <X
              size={18}
              className="text-gray-500"
            />
          </button>
        </div>

        {/* ETAPA 1 — AVISOU? */}
        {etapa ===
          'antecedencia' && (
          <div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-5">
              <p className="text-sm font-semibold text-gray-800">
                A cliente avisou o salão sobre a falta com antecedência?
              </p>

              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Considere como "não" quando ela não avisou
                ou avisou em cima da hora.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">

              <button
                type="button"
                onClick={() =>
                  escolherAntecedencia(
                    true
                  )
                }
                className="py-3.5 rounded-2xl border-2 text-sm font-semibold"
                style={{
                  borderColor: cor,
                  color: cor
                }}
              >
                Sim, avisou
              </button>

              <button
                type="button"
                onClick={() =>
                  escolherAntecedencia(
                    false
                  )
                }
                className="py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold"
              >
                Não avisou
              </button>

            </div>
          </div>
        )}

        {/* ETAPA 2 — DESCONTO */}
        {etapa === 'desconto' && (
          <div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-5">
              <p className="text-sm font-semibold text-gray-800">
                Deseja descontar as sessões do pacote?
              </p>

              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Como a cliente não avisou com antecedência,
                você pode optar por descontar as sessões
                correspondentes aos serviços agendados.
              </p>
            </div>

            {carregandoCoberturas ? (
              <div className="py-6 text-center">
                <div
                  className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-current animate-spin mx-auto"
                  style={{
                    color: cor
                  }}
                />

                <p className="text-xs text-gray-400 mt-2">
                  Verificando pacotes...
                </p>
              </div>
            ) : (
              <>
                {coberturas.length >
                  0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl p-3 mb-4">
                    <p className="text-xs font-bold text-gray-700 mb-2">
                      Serviços deste atendimento
                    </p>

                    <div className="space-y-2">
                      {coberturas.map(
                        cobertura => (
                          <div
                            key={
                              cobertura.servicoId
                            }
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-xs text-gray-600">
                              {
                                cobertura.servicoNome
                              }
                            </span>

                            <span
                              className="text-xs font-semibold"
                              style={{
                                color: cor
                              }}
                            >
                              {cobertura.sessoesEquivalentes}{' '}
                              {cobertura.sessoesEquivalentes ===
                              1
                                ? 'sessão'
                                : 'sessões'}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">

                  <button
                    type="button"
                    disabled={
                      salvando
                    }
                    onClick={() =>
                      escolherDesconto(
                        false
                      )
                    }
                    className="py-3.5 rounded-2xl border border-gray-200 text-gray-700 text-sm font-semibold disabled:opacity-50"
                  >
                    Não descontar
                  </button>

                  <button
                    type="button"
                    disabled={
                      salvando
                    }
                    onClick={() =>
                      escolherDesconto(
                        true
                      )
                    }
                    className="py-3.5 rounded-2xl text-white text-sm font-semibold disabled:opacity-50"
                    style={{
                      backgroundColor:
                        cor
                    }}
                  >
                    Descontar
                  </button>

                </div>
              </>
            )}

          </div>
        )}

        {/* ETAPA 3 — JUSTIFICATIVA */}
        {etapa ===
          'justificativa' && (
          <div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-sm font-semibold text-gray-800">
                {descontarPacote
                  ? 'Justificativa do desconto'
                  : 'Registro do não comparecimento'}
              </p>

              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {descontarPacote
                  ? 'Escreva o motivo que ficará registrado no histórico do pacote e poderá ser consultado pela cliente.'
                  : avisouComAntecedencia
                    ? 'O atendimento será registrado como não comparecimento, sem desconto no pacote.'
                    : 'O atendimento será registrado como não comparecimento, sem desconto no pacote.'}
              </p>
            </div>

            {descontarPacote ? (
              <textarea
                value={justificativa}
                onChange={e =>
                  setJustificativa(
                    e.target.value
                  )
                }
                placeholder="Ex.: Cliente não compareceu ao horário agendado e não avisou o salão com antecedência."
                className="w-full h-28 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2"
              />
            ) : (
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500">
                  Nenhuma sessão será descontada do pacote.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-5">

              <button
                type="button"
                onClick={() => {
                  if (
                    avisouComAntecedencia ===
                    false
                  ) {
                    setEtapa(
                      'desconto'
                    )
                  } else {
                    setEtapa(
                      'antecedencia'
                    )
                  }
                }}
                disabled={salvando}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm disabled:opacity-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={
                  confirmarJustificativa
                }
                disabled={
                  salvando ||
                  (Boolean(
                    descontarPacote
                  ) &&
                    !justificativa.trim())
                }
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  backgroundColor:
                    cor
                }}
              >
                {salvando ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Registrar falta
                  </>
                )}
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}