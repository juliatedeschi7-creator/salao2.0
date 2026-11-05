'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import ConversaSolicitacaoAgendamento from '@/components/ConversaSolicitacaoAgendamento'

export default function ClienteNotificacoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set())
  const [erroConfirmacao, setErroConfirmacao] = useState('')

  useEffect(() => {
    if (!loading && profile) {
      carregarDados()
    }
  }, [loading, profile])

  async function carregarDados() {
    if (!profile?.id) return

    const { data: cli, error: erroCliente } = await supabase
      .from('clientes')
      .select('*, saloes(*)')
      .eq('profile_id', profile.id)
      .maybeSingle()

    if (erroCliente) {
      console.error('Erro ao carregar cliente:', erroCliente)
    }

    setCliente(cli)
    setSalao(cli?.saloes || null)

    const { data: notifs, error: erroNotificacoes } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('destinatario_id', profile.id)
      .eq('excluida', false)
      .order('created_at', { ascending: false })

    if (erroNotificacoes) {
      console.error('Erro ao carregar notificações:', erroNotificacoes)
    }

    setNotificacoes(notifs || [])

    if (cli?.id) {
      const { data: sols, error: erroSolicitacoes } = await supabase
        .from('solicitacoes_agendamento')
        .select('*, servicos(nome, duracao_minutos)')
        .eq('cliente_id', cli.id)
        .eq('status', 'horario_sugerido')
        .order('created_at', { ascending: false })

      if (erroSolicitacoes) {
        console.error('Erro ao carregar solicitações:', erroSolicitacoes)
      }

      setSolicitacoes(sols || [])
    } else {
      setSolicitacoes([])
    }

    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('destinatario_id', profile.id)
      .eq('lida', false)
  }

  async function registrarMensagemEscolha(
    solicitacao: any,
    horario: string
  ) {
    if (!profile?.id) return

    const horarioFormatado = new Date(horario).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const { error } = await supabase
      .from('solicitacoes_agendamento_mensagens')
      .insert({
        solicitacao_id: solicitacao.id,
        remetente_id: profile.id,
        remetente_tipo: 'cliente',
        tipo: 'horario_escolhido',
        mensagem: `A cliente escolheu o horário de ${horarioFormatado}.`,
        horarios_propostos: [horario]
      })

    if (error) {
      console.error('Erro ao registrar escolha na conversa:', error)
    }
  }

  async function confirmarHorario(
    solicitacao: any,
    horario: string
  ) {
    if (!profile?.id || !cliente?.id || confirmando) return

    setConfirmando(solicitacao.id + horario)
    setErroConfirmacao('')

    try {
      const dataHoraAgendamento = new Date(horario).toISOString()

      // Verifica se já existe agendamento para esta solicitação,
      // evitando duplicidade caso a cliente toque novamente.
      const { data: existente, error: erroBusca } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('salao_id', solicitacao.salao_id)
        .eq('cliente_id', solicitacao.cliente_id)
        .eq('servico_id', solicitacao.servico_id)
        .eq('data_hora', dataHoraAgendamento)
        .maybeSingle()

      if (erroBusca) {
        throw erroBusca
      }

      if (!existente) {
        const { error: erroInsercao } = await supabase
          .from('agendamentos')
          .insert({
            salao_id: solicitacao.salao_id,
            cliente_id: solicitacao.cliente_id,
            servico_id: solicitacao.servico_id,
            profissional_id: solicitacao.profissional_id,
            data_hora: dataHoraAgendamento,
            duracao_minutos:
              solicitacao.servicos?.duracao_minutos || 60,
            status: 'confirmado'
          })

        if (erroInsercao) {
          throw erroInsercao
        }
      }

      const { error: erroAtualizacao } = await supabase
        .from('solicitacoes_agendamento')
        .update({
          status: 'confirmado',
          horario_escolhido: horario
        })
        .eq('id', solicitacao.id)
        .eq('status', 'horario_sugerido')

      if (erroAtualizacao) {
        throw erroAtualizacao
      }

      await registrarMensagemEscolha(solicitacao, horario)

      const { data: sal, error: erroSalao } = await supabase
        .from('saloes')
        .select('dono_id')
        .eq('id', solicitacao.salao_id)
        .maybeSingle()

      if (erroSalao) {
        console.error('Erro ao localizar responsável do salão:', erroSalao)
      }

      if (sal?.dono_id) {
        const dataFormatada = new Date(horario).toLocaleString('pt-BR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })

        const { error: erroNotificacao } = await supabase
          .from('notificacoes')
          .insert({
            salao_id: solicitacao.salao_id,
            remetente_id: profile.id,
            destinatario_id: sal.dono_id,
            titulo: 'Horário escolhido pela cliente',
            mensagem:
              `${cliente?.nome || 'A cliente'} escolheu o horário para ` +
              `${solicitacao.servicos?.nome || 'o atendimento'}: ${dataFormatada}.`,
            tipo: 'agendamento',
            url: '/salao/notificacoes'
          })

        if (erroNotificacao) {
          console.error('Erro ao notificar salão:', erroNotificacao)
        }
      }

      setConfirmados(prev => new Set([...Array.from(prev), solicitacao.id]))

      await carregarDados()
    } catch (error: any) {
      console.error('Erro ao confirmar horário:', error)
      setErroConfirmacao(
        error?.message ||
          'Não foi possível confirmar o horário. Tente novamente.'
      )
    } finally {
      setConfirmando(null)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div
        className="px-4 pt-12 pb-6 flex items-center gap-3"
        style={{ backgroundColor: cor }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} className="text-white" />
        </button>

        <h1 className="font-bold text-white text-lg">
          Notificações
        </h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {erroConfirmacao && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700">
              {erroConfirmacao}
            </p>
          </div>
        )}

        {solicitacoes.map(sol => {
          const jaConfirmou = confirmados.has(sol.id)
          const horarios = Array.isArray(sol.horarios_sugeridos)
            ? sol.horarios_sugeridos
            : []

          return (
            <div
              key={sol.id}
              className="card flex flex-col gap-3 border-2"
              style={{
                borderColor: jaConfirmou ? '#22c55e' : cor
              }}
            >
              <div className="flex items-center gap-2">
                <Calendar
                  size={18}
                  style={{
                    color: jaConfirmou ? '#22c55e' : cor
                  }}
                />

                <p className="font-bold text-gray-900">
                  {jaConfirmou
                    ? 'Horário confirmado!'
                    : 'Escolha seu horário'}
                </p>
              </div>

              <p className="text-sm text-gray-500">
                {sol.servicos?.nome}
              </p>

              <ConversaSolicitacaoAgendamento
                solicitacaoId={sol.id}
                profileId={profile!.id}
                remetenteTipo="cliente"
                cor={cor}
              />

              {jaConfirmou ? (
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-sm text-green-700 font-medium">
                    Agendamento confirmado! Verifique em Meus Agendamentos.
                  </p>
                </div>
              ) : horarios.length === 0 ? (
                <div className="bg-red-50 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle
                    size={16}
                    className="text-red-400 shrink-0"
                  />

                  <p className="text-sm text-red-600">
                    Nenhum horário disponível no momento. O salão enviará
                    novas opções em breve.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-400">
                    {horarios.length === 1
                      ? 'Horário disponível:'
                      : `${horarios.length} horários disponíveis — escolha um:`}
                  </p>

                  {horarios.map((h: string) => {
                    const esteConfirmando =
                      confirmando === sol.id + h

                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => confirmarHorario(sol, h)}
                        disabled={!!confirmando}
                        className="w-full py-3 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        style={{
                          borderColor: cor,
                          color: cor
                        }}
                      >
                        {esteConfirmando ? (
                          <div
                            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: cor }}
                          />
                        ) : (
                          <>
                            <CheckCircle size={16} />

                            {new Date(h).toLocaleDateString('pt-BR', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long'
                            })}

                            {' às '}

                            {new Date(h).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {notificacoes.length === 0 && solicitacoes.length === 0 ? (
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
          notificacoes.map(n => (
            <div
              key={n.id}
              className={
                'card flex flex-col gap-1 ' +
                (!n.lida ? 'border-l-4' : '')
              }
              style={
                !n.lida
                  ? { borderLeftColor: cor }
                  : {}
              }
            >
              <div className="flex justify-between items-start gap-2">
                <p className="font-semibold text-gray-900 text-sm">
                  {n.titulo}
                </p>

                <p className="text-xs text-gray-400 shrink-0">
                  {new Date(n.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short'
                  })}
                </p>
              </div>

              <p className="text-sm text-gray-500">
                {n.mensagem}
              </p>

              {n.tipo === 'horario_sugerido' && n.referencia_id && (
                <button
                  type="button"
                  onClick={() => router.push('/cliente/notificacoes')}
                  className="text-xs font-semibold mt-1 self-start"
                  style={{ color: cor }}
                >
                  Ver horários disponíveis ↑
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}