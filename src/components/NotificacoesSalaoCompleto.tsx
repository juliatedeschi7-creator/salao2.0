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

    // Confirmações
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)

    const { data: ags } = await supabase
      .from('agendamentos')
      .select(
        '*, clientes(id, nome, telefone), servicos(nome, id), confirmacoes_atendimento(*)'
      )
      .eq('salao_id', profile.salao_id)
      .eq('status', 'confirmado')
      .gte('data_hora', ontem.toISOString())
      .lte('data_hora', new Date().toISOString())
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

  // ─── Abrir confirmação ─────────────────────────────────────────────────

  async function abrirModalConfirmar(
    ag: any
  ) {
    setModalConfirmar(ag)

    setServicoRealizado(
      ag.servicos?.nome || ''
    )

    setCarregandoCoberturas(true)

    const covs =
      await montarCoberturas(ag)

    setCoberturas(covs)

    setCarregandoCoberturas(false)
  }

  // ─── Alterar pacote escolhido ──────────────────────────────────────────

  function alterarPacoteServico(
    servicoId: string,
    clientePacoteId: string | null
  ) {
    setCoberturas(prev =>
      prev.map(c =>
        c.servicoId === servicoId
          ? {
              ...c,
              clientePacoteIdSelecionado:
                clientePacoteId
            }
          : c
      )
    )
  }

  // ─── Confirmar atendimento ─────────────────────────────────────────────

  async function confirmarAtendimento() {
    if (
      !servicoRealizado ||
      !modalConfirmar ||
      !profile?.salao_id
    ) {
      return
    }

    setSalvando(true)

    try {
      const {
        error: confirmacaoError
      } = await supabase
        .from(
          'confirmacoes_atendimento'
        )
        .insert({
          agendamento_id:
            modalConfirmar.id,
          salao_id:
            profile.salao_id,
          confirmado_por:
            profile.id,
          servico_realizado:
            servicoRealizado
        })

      if (confirmacaoError) {
        console.error(
          'Erro ao registrar confirmação:',
          confirmacaoError
        )
        throw confirmacaoError
      }

      const {
        error: agendamentoError
      } = await supabase
        .from('agendamentos')
        .update({
          status: 'concluido'
        })
        .eq(
          'id',
          modalConfirmar.id
        )

      if (agendamentoError) {
        console.error(
          'Erro ao concluir agendamento:',
          agendamentoError
        )
        throw agendamentoError
      }

      const descontos: Record<
        string,
        {
          nome: string
          peso: number
        }[]
      > = {}

      for (const cob of coberturas) {
        if (
          !cob.clientePacoteIdSelecionado
        ) {
          continue
        }

        if (
          !descontos[
            cob.clientePacoteIdSelecionado
          ]
        ) {
          descontos[
            cob.clientePacoteIdSelecionado
          ] = []
        }

        descontos[
          cob.clientePacoteIdSelecionado
        ].push({
          nome:
            cob.servicoNome,
          peso:
            cob.sessoesEquivalentes
        })
      }

      const hoje =
        new Date()
          .toISOString()
          .slice(0, 10)

      let totalDescontados = 0

      for (
        const [
          pacoteId,
          itens
        ] of Object.entries(
          descontos
        )
      ) {
        const totalPeso =
          itens.reduce(
            (
              acc,
              item
            ) =>
              acc +
              item.peso,
            0
          )

        const {
          data: pacote,
          error: pacoteError
        } = await supabase
          .from(
            'pacotes_clientes_resumo'
          )
          .select(
            'id, cliente_nome, servico, sessoes_total, sessoes_restantes, status, historico_sessoes'
          )
          .eq(
            'id',
            pacoteId
          )
          .single()

        if (
          pacoteError ||
          !pacote
        ) {
          console.error(
            'Erro ao buscar pacote:',
            pacoteError
          )
          continue
        }

        const sessoesRestantesAtuais =
          Number(
            pacote.sessoes_restantes ??
              0
          )

        const sessoesRestantesNovas =
          Math.max(
            0,
            sessoesRestantesAtuais -
              totalPeso
          )

        const novoStatus =
          sessoesRestantesNovas <=
          0
            ? 'concluido'
            : 'ativo'

        let historico =
          Array.isArray(
            pacote.historico_sessoes
          )
            ? [
                ...pacote.historico_sessoes
              ]
            : []

        for (const item of itens) {
          for (
            let i = 0;
            i < item.peso;
            i++
          ) {
            historico.push({
              id:
                typeof crypto !==
                  'undefined' &&
                crypto.randomUUID
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()
                      .toString(36)
                      .substring(
                        2,
                        9
                      )}`,
              data: hoje,
              servico:
                item.peso > 1
                  ? `${item.nome} (${i + 1}/${item.peso})`
                  : item.nome
            })
          }
        }

        const {
          error: updateError
        } = await supabase
          .from(
            'pacotes_clientes_resumo'
          )
          .update({
            sessoes_restantes:
              sessoesRestantesNovas,
            status:
              novoStatus,
            data_sessao:
              hoje,
            historico_sessoes:
              historico
          })
          .eq(
            'id',
            pacoteId
          )

        if (updateError) {
          console.error(
            'Erro ao atualizar pacote:',
            updateError
          )
          throw updateError
        }

        totalDescontados +=
          totalPeso
      }

      const nenhumPacoteUsado =
        coberturas.every(
          cob =>
            !cob.clientePacoteIdSelecionado
        )

      if (nenhumPacoteUsado) {
        const venderNovo =
          window.confirm(
            'Este atendimento está sem sessões no pacote. Deseja vender novo pacote?'
          )

        if (venderNovo) {
          router.push(
            `/salao/pacotes/clientes?cliente_id=${modalConfirmar.cliente_id}&novo=true`
          )
          return
        }
      }

      const {
        data: clienteInfo
      } = await supabase
        .from('clientes')
        .select(
          'profile_id'
        )
        .eq(
          'id',
          modalConfirmar.cliente_id
        )
        .single()

      if (
        clienteInfo?.profile_id
      ) {
        await notificar({
          salaoId:
            profile.salao_id,
          remetenteId:
            profile.id,
          destinatarioId:
            clienteInfo.profile_id,
          titulo:
            '✅ Atendimento confirmado!',
          mensagem:
            totalDescontados >
            0
              ? `Seu atendimento foi confirmado. ${totalDescontados} sessão(ões) descontada(s) do pacote.`
              : 'Seu atendimento foi registrado com sucesso!',
          tipo:
            'confirmacao',
          url:
            '/cliente/pacotes'
        })
      }

      setModalConfirmar(
        null
      )
      setServicoRealizado(
        ''
      )
      setCoberturas([])

      await carregarDados()
    } catch (error: any) {
      console.error(
        'Erro ao confirmar atendimento:',
        error
      )

      alert(
        'Erro detalhado: ' +
          (
            error?.message ||
            JSON.stringify(
              error
            )
          )
      )
    } finally {
      setSalvando(false)
    }
  }

  // ─── Sugestão de horários ──────────────────────────────────────────────

  async function sugerirHorarios(
    solicitacao: any
  ) {
    const horarios =
      horariosLivres.filter(
        h => h
      )

    if (!horarios.length)
      return

    setSalvando(true)

    await supabase
      .from(
        'solicitacoes_agendamento'
      )
      .update({
        status:
          'horario_sugerido',
        horarios_sugeridos:
          horarios,
        profissional_id:
          profile!.id
      })
      .eq(
        'id',
        solicitacao.id
      )

    const {
      data: cp
    } = await supabase
      .from('clientes')
      .select(
        'profile_id'
      )
      .eq(
        'id',
        solicitacao.cliente_id
      )
      .single()

    if (cp?.profile_id) {
      await notificar({
        salaoId:
          profile!.salao_id,
        remetenteId:
          profile!.id,
        destinatarioId:
          cp.profile_id,
        titulo:
          '📅 Horários disponíveis para você!',
        mensagem:
          `${salao?.nome} sugeriu horários para ${solicitacao.servicos?.nome}. Escolha o melhor para você!`,
        tipo:
          'horario_sugerido',
        url:
          '/cliente/agendamentos'
      })
    }

    setModalSugestao(
      null
    )

    setHorariosLivres([
      '',
      '',
      ''
    ])

    setSalvando(false)

    carregarDados()
  }

  async function cancelarSugestao(
    solicitacao: any
  ) {
    await supabase
      .from(
        'solicitacoes_agendamento'
      )
      .update({
        status:
          'pendente',
        horarios_sugeridos:
          null,
        profissional_id:
          null
      })
      .eq(
        'id',
        solicitacao.id
      )

    carregarDados()
  }

  async function recusarSolicitacao(
    solicitacao: any
  ) {
    await supabase
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

    carregarDados()
  }

  function enviarWhatsAppHorarios(
    solicitacao: any
  ) {
    const telefone =
      solicitacao.clientes?.telefone
        ? solicitacao.clientes.telefone.replace(
            /\D/g,
            ''
          )
        : ''

    const listaHorarios =
      (
        solicitacao.horarios_sugeridos ||
        []
      )
        .map(
          (
            h: string,
            index: number
          ) =>
            `*Opção ${index + 1}:* ${new Date(
              h
            ).toLocaleDateString(
              'pt-BR',
              {
                day: '2-digit',
                month: 'short'
              }
            )} às ${new Date(
              h
            ).toLocaleTimeString(
              'pt-BR',
              {
                hour: '2-digit',
                minute: '2-digit'
              }
            )}`
        )
        .join('\n')

    const modeloSalvo =
      salao?.mensagem_sugestao_horarios ||
      'Olá {cliente}, tudo bem? Sugerimos pelo aplicativo estes horários, caso não tenha checado por lá, estamos enviando por aqui para lembra-la!'

    const textoFinal =
      modeloSalvo
        .replace(
          /{cliente}/g,
          solicitacao.clientes?.nome ||
            'Cliente'
        )
        .replace(
          /{servico}/g,
          solicitacao.servicos?.nome ||
            'Atendimento'
        ) +
      `\n\n${listaHorarios}\n\nQual destas opções fica melhor para você?`

    const texto =
      encodeURIComponent(
        textoFinal
      )

    if (telefone) {
      window.open(
        `https://api.whatsapp.com/send?phone=55${telefone}&text=${texto}`,
        '_blank'
      )
    } else {
      window.open(
        `https://api.whatsapp.com/send?text=${texto}`,
        '_blank'
      )
    }
  }

  function enviarWhatsAppCancelamento(
    solicitacao: any
  ) {
    const telefone =
      solicitacao.clientes?.telefone
        ? solicitacao.clientes.telefone.replace(
            /\D/g,
            ''
          )
        : ''

    const texto =
      encodeURIComponent(
        `Olá, ${solicitacao.clientes?.nome}! Aqui é do *${salao?.nome || 'Salão'}*. Infelizmente este horário já não temos mais disponível, mas estamos aguardando seu retorno para verificarmos outra data ideal para você!`
      )

    if (telefone) {
      window.open(
        `https://api.whatsapp.com/send?phone=55${telefone}&text=${texto}`,
        '_blank'
      )
    } else {
      window.open(
        `https://api.whatsapp.com/send?text=${texto}`,
        '_blank'
      )
    }
  }

  async function removerHorarioIndividual(
    solicitacao: any,
    horarioRemover: string
  ) {
    const novos =
      solicitacao.horarios_sugeridos.filter(
        (h: string) =>
          h !==
          horarioRemover
      )

    if (
      novos.length === 0
    ) {
      cancelarSugestao(
        solicitacao
      )
      return
    }

    await supabase
      .from(
        'solicitacoes_agendamento'
      )
      .update({
        horarios_sugeridos:
          novos
      })
      .eq(
        'id',
        solicitacao.id
      )

    carregarDados()
  }

  async function excluirNotificacao(
    id: string
  ) {
    await supabase
      .from('notificacoes')
      .update({
        excluida: true
      })
      .eq(
        'id',
        id
      )

    carregarDados()
  }

  async function restaurarNotificacao(
    id: string
  ) {
    await supabase
      .from('notificacoes')
      .update({
        excluida: false
      })
      .eq(
        'id',
        id
      )

    carregarDados()
  }

  const cor =
    salao?.cor_primaria ||
    '#E91E8C'

  const badges = {
    pedidos:
      solicitacoes.length,
    confirmacoes:
      confirmacoes.length,
    notificacoes:
      notificacoes.filter(
        n => !n.lida
      ).length,
    excluidas:
      0
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button
          onClick={() =>
            router.back()
          }
        >
          <ArrowLeft
            size={22}
            className="text-gray-700"
          />
        </button>

        <h1 className="font-bold text-gray-900 text-lg flex-1">
          Central de Atendimento
        </h1>
      </div>

      <div className="flex bg-white border-b border-gray-100 overflow-x-auto">
        {(
          [
            {
              key: 'pedidos',
              label: 'Pedidos'
            },
            {
              key: 'confirmacoes',
              label: 'Confirmar'
            },
            {
              key: 'notificacoes',
              label: 'Notificações'
            },
            {
              key: 'excluidas',
              label: 'Excluídas'
            }
          ] as const
        ).map(t => (
          <button
            key={t.key}
            onClick={() =>
              setAba(t.key)
            }
            className={
              'relative flex-1 py-3 text-xs font-medium whitespace-nowrap transition-all px-3 ' +
              (
                aba === t.key
                  ? 'border-b-2'
                  : 'text-gray-400'
              )
            }
            style={
              aba === t.key
                ? {
                    color: cor,
                    borderColor:
                      cor
                  }
                : {}
            }
          >
            {t.label}

            {badges[t.key] >
              0 && (
              <span
                className="absolute top-1.5 right-1 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
                style={{
                  backgroundColor:
                    cor
                }}
              >
                {badges[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {aba ===
          'pedidos' &&
          (
            solicitacoes.length ===
            0 ? (
              <div className="card text-center py-10">
                <Calendar
                  size={36}
                  className="text-gray-300 mx-auto mb-2"
                />
                <p className="text-gray-400">
                  Nenhuma solicitação pendente
                </p>
              </div>
            ) : (
              solicitacoes.map(
                s => {
                  const dataPreferida =
                    formatarDataPreferida(s)

                  const periodoPreferido =
                    formatarPeriodoPreferido(s)

                  return (
                  <div
                    key={s.id}
                    className="card flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-900">
                          {
                            s
                              .clientes
                              ?.nome
                          }
                        </p>

                        <p className="text-sm text-gray-500">
                          {
                            s
                              .servicos
                              ?.nome
                          }
                        </p>

                        {/* ─────────────────────────────────────
                            PREFERÊNCIA DA CLIENTE
                            Mostra novamente o dia e o período
                            escolhidos no pedido.
                           ───────────────────────────────────── */}
                        {(dataPreferida ||
                          periodoPreferido) && (
                          <div className="mt-2 bg-pink-50 rounded-xl px-3 py-2.5">
                            <p className="text-[11px] font-semibold text-pink-600 uppercase tracking-wide mb-1">
                              Preferência da cliente
                            </p>

                            {dataPreferida && (
                              <div className="flex items-center gap-1.5">
                                <Calendar
                                  size={13}
                                  className="text-pink-500 shrink-0"
                                />

                                <p className="text-xs text-pink-700 font-medium capitalize">
                                  {dataPreferida}
                                </p>
                              </div>
                            )}

                            {periodoPreferido && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Clock
                                  size={13}
                                  className="text-pink-500 shrink-0"
                                />

                                <p className="text-xs text-pink-700 font-medium">
                                  {periodoPreferido}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-gray-400 mt-2">
                          Pedido feito em{' '}
                          {new Date(
                            s.created_at
                          ).toLocaleDateString(
                            'pt-BR',
                            {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            }
                          )}
                        </p>
                      </div>

                      <span
                        className={
                          'text-xs px-2 py-0.5 rounded-full font-medium ' +
                          (
                            s.status ===
                            'horario_sugerido'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-yellow-50 text-yellow-600'
                          )
                        }
                      >
                        {
                          s.status ===
                          'horario_sugerido'
                            ? 'Horários enviados'
                            : 'Aguardando'
                        }
                      </span>
                    </div>

                    {s.status ===
                      'horario_sugerido' &&
                      s.horarios_sugeridos && (
                        <div className="bg-blue-50 rounded-xl p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-blue-700">
                              Horários sugeridos:
                            </p>

                            <button
                              onClick={() =>
                                enviarWhatsAppHorarios(
                                  s
                                )
                              }
                              className="bg-green-600 text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium"
                            >
                              <MessageCircle
                                size={
                                  13
                                }
                              />
                              Enviar WhatsApp
                            </button>
                          </div>

                          {s.horarios_sugeridos.map(
                            (
                              h: string,
                              i: number
                            ) => (
                              <div
                                key={
                                  i
                                }
                                className="flex items-center justify-between bg-white rounded-xl px-3 py-2"
                              >
                                <p className="text-xs text-blue-600 font-medium">
                                  {new Date(
                                    h
                                  ).toLocaleDateString(
                                    'pt-BR',
                                    {
                                      weekday:
                                        'short',
                                      day: 'numeric',
                                      month:
                                        'short',
                                      hour: '2-digit',
                                      minute:
                                        '2-digit'
                                    }
                                  )}
                                </p>

                                <button
                                  onClick={() =>
                                    removerHorarioIndividual(
                                      s,
                                      h
                                    )
                                  }
                                  className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center ml-2 shrink-0"
                                >
                                  <X
                                    size={
                                      12
                                    }
                                    className="text-red-500"
                                  />
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}

                    <div className="flex gap-2 flex-wrap">
                      {s.status ===
                        'pendente' && (
                        <>
                          <button
                            onClick={() => {
                              setModalSugestao(
                                s
                              )
                              setHorariosLivres(
                                [
                                  '',
                                  '',
                                  ''
                                ]
                              )
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-sm font-medium"
                            style={{
                              backgroundColor:
                                cor
                            }}
                          >
                            <Clock
                              size={
                                14
                              }
                            />
                            Sugerir horários
                          </button>

                          <button
                            onClick={() => {
                              recusarSolicitacao(
                                s
                              )
                              enviarWhatsAppCancelamento(
                                s
                              )
                            }}
                            className="px-4 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium flex items-center gap-1"
                          >
                            <X
                              size={
                                14
                              }
                            />
                            Recusar / Avisar
                          </button>
                        </>
                      )}

                      {s.status ===
                        'horario_sugerido' && (
                        <>
                          <button
                            onClick={() => {
                              setModalSugestao(
                                s
                              )
                              setHorariosLivres(
                                s.horarios_sugeridos ||
                                  [
                                    '',
                                    '',
                                    ''
                                  ]
                              )
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-medium"
                            style={{
                              borderColor:
                                cor,
                              color:
                                cor
                            }}
                          >
                            <Clock
                              size={
                                14
                              }
                            />
                            Alterar horários
                          </button>

                          <button
                            onClick={() => {
                              cancelarSugestao(
                                s
                              )
                              enviarWhatsAppCancelamento(
                                s
                              )
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium"
                          >
                            <RotateCcw
                              size={
                                14
                              }
                            />
                            Retirar oferta
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  )
                }
              )
            )
          )}

        {aba ===
          'confirmacoes' &&
          (
            confirmacoes.length ===
            0 ? (
              <div className="card text-center py-10">
                <Check
                  size={36}
                  className="text-gray-300 mx-auto mb-2"
                />
                <p className="text-gray-400">
                  Nenhum atendimento para confirmar
                </p>
              </div>
            ) : (
              confirmacoes.map(
                ag => (
                  <div
                    key={ag.id}
                    className="card flex flex-col gap-2"
                  >
                    <p className="font-bold text-gray-900">
                      {
                        ag
                          .clientes
                          ?.nome
                      }
                    </p>

                    <p className="text-sm text-gray-500">
                      {
                        ag
                          .servicos
                          ?.nome
                      }
                    </p>

                    <p className="text-xs text-gray-400">
                      {new Date(
                        ag.data_hora
                      ).toLocaleDateString(
                        'pt-BR',
                        {
                          weekday:
                            'long',
                          day: '2-digit',
                          month:
                            'short',
                          hour: '2-digit',
                          minute:
                            '2-digit'
                        }
                      )}
                    </p>

                    <button
                      onClick={() =>
                        abrirModalConfirmar(
                          ag
                        )
                      }
                      className="w-full py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-1.5"
                      style={{
                        backgroundColor:
                          cor
                      }}
                    >
                      <Check
                        size={
                          14
                        }
                      />
                      Confirmar atendimento
                    </button>
                  </div>
                )
              )
            )
          )}

        {aba ===
          'notificacoes' &&
          (
            notificacoes.length ===
            0 ? (
              <div className="card text-center py-10">
                <Bell
                  size={36}
                  className="text-gray-300 mx-auto mb-2"
                />
                <p className="text-gray-400">
                  Nenhuma notificação
                </p>
              </div>
            ) : (
              notificacoes.map(
                n => (
                  <div
                    key={n.id}
                    onClick={() =>
                      handleClicarNotificacao(
                        n
                      )
                    }
                    className={
                      'card flex flex-col gap-1 cursor-pointer transition-colors hover:bg-gray-50 ' +
                      (!n.lida
                        ? 'border-l-4'
                        : '')
                    }
                    style={
                      !n.lida
                        ? {
                            borderLeftColor:
                              cor
                          }
                        : {}
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">
                          {
                            n.titulo
                          }
                        </p>

                        <p className="text-sm text-gray-500 mt-0.5">
                          {
                            n.mensagem
                          }
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(
                            n.created_at
                          ).toLocaleDateString(
                            'pt-BR',
                            {
                              day: '2-digit',
                              month:
                                'short',
                              hour: '2-digit',
                              minute:
                                '2-digit'
                            }
                          )}
                        </p>
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation()
                          excluirNotificacao(
                            n.id
                          )
                        }}
                        className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
                      >
                        <Trash2
                          size={
                            13
                          }
                          className="text-gray-400"
                        />
                      </button>
                    </div>
                  </div>
                )
              )
            )
          )}

        {aba ===
          'excluidas' &&
          (
            notificacoesExcluidas.length ===
            0 ? (
              <div className="card text-center py-10">
                <Trash2
                  size={36}
                  className="text-gray-300 mx-auto mb-2"
                />
                <p className="text-gray-400">
                  Nenhuma notificação excluída
                </p>
              </div>
            ) : (
              notificacoesExcluidas.map(
                n => (
                  <div
                    key={n.id}
                    className="card flex flex-col gap-1 opacity-60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">
                          {
                            n.titulo
                          }
                        </p>

                        <p className="text-sm text-gray-500 mt-0.5">
                          {
                            n.mensagem
                          }
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          restaurarNotificacao(
                            n.id
                          )
                        }
                        className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
                      >
                        <RotateCcw
                          size={
                            13
                          }
                          className="text-gray-400"
                        />
                      </button>
                    </div>
                  </div>
                )
              )
            )
          )}
      </div>

      {modalSugestao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                {
                  modalSugestao.status ===
                  'horario_sugerido'
                    ? 'Alterar horários'
                    : 'Sugerir horários'
                }
              </h3>

              <button
                onClick={() =>
                  setModalSugestao(
                    null
                  )
                }
              >
                <X
                  size={
                    20
                  }
                  className="text-gray-400"
                />
              </button>
            </div>

            {horariosLivres.map(
              (
                h,
                i
              ) => (
                <div key={i}>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Opção {i + 1}
                  </label>

                  <input
                    type="datetime-local"
                    className="input-field"
                    value={h}
                    onChange={e => {
                      const n = [
                        ...horariosLivres
                      ]

                      n[i] =
                        e.target.value

                      setHorariosLivres(
                        n
                      )
                    }}
                    style={{
                      colorScheme:
                        'light'
                    }}
                  />
                </div>
              )
            )}

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setModalSugestao(
                    null
                  )
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={() =>
                  sugerirHorarios(
                    modalSugestao
                  )
                }
                disabled={
                  salvando ||
                  !horariosLivres[0]
                }
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-40"
                style={{
                  backgroundColor:
                    cor
                }}
              >
                {salvando
                  ? 'Enviando...'
                  : 'Enviar para cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalConfirmar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                Confirmar atendimento
              </h3>

              <button
                onClick={() => {
                  setModalConfirmar(
                    null
                  )
                  setCoberturas(
                    []
                  )
                }}
              >
                <X
                  size={
                    20
                  }
                  className="text-gray-400"
                />
              </button>
            </div>

            <p className="text-sm text-gray-600 font-medium">
              {
                modalConfirmar
                  .clientes
                  ?.nome
              }
            </p>

            {carregandoCoberturas ? (
              <div className="flex items-center gap-2 py-2">
                <div
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{
                    borderColor:
                      cor
                  }}
                />

                <p className="text-xs text-gray-400">
                  Verificando pacotes ativos...
                </p>
              </div>
            ) : coberturas.length >
              0 ? (
              <div className="flex flex-col gap-3">
                {coberturas.map(
                  cob => (
                    <div
                      key={
                        cob.servicoId
                      }
                      className="bg-gray-50 rounded-2xl p-3 flex flex-col gap-2"
                    >
                      <p className="font-semibold text-gray-900 text-sm">
                        {
                          cob.servicoNome
                        }
                      </p>

                      <select
                        className="input-field text-sm py-2"
                        value={
                          cob.clientePacoteIdSelecionado ||
                          ''
                        }
                        onChange={e =>
                          alterarPacoteServico(
                            cob.servicoId,
                            e.target.value ||
                              null
                          )
                        }
                      >
                        <option value="">
                          Não usar pacote / Sem pacote
                        </option>

                        {cob.pacotesDisponiveis.map(
                          op => (
                            <option
                              key={
                                op.clientePacoteId
                              }
                              value={
                                op.clientePacoteId
                              }
                            >
                              {
                                op.nome
                              }{' '}
                              —{' '}
                              {
                                op.sessoesRestantes
                              }{' '}
                              sessões restantes
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-xs text-red-500">
                Este cliente não possui pacotes ativos com sessões disponíveis.
              </p>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                O que foi realizado?
              </label>

              <input
                className="input-field"
                value={
                  servicoRealizado
                }
                onChange={e =>
                  setServicoRealizado(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalConfirmar(
                    null
                  )
                  setCoberturas(
                    []
                  )
                }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={
                  confirmarAtendimento
                }
                disabled={
                  salvando ||
                  !servicoRealizado
                }
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-40"
                style={{
                  backgroundColor:
                    cor
                }}
              >
                {salvando
                  ? 'Salvando...'
                  : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}