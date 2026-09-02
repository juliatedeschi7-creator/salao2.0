'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Mail,
  Calendar,
  Package,
  ClipboardList,
  Check,
  X,
  Lock
} from 'lucide-react'

export default function ClientePerfilPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()

  const clienteId = Array.isArray(params?.id)
    ? params.id[0]
    : (params?.id as string)

  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [pacotes, setPacotes] = useState<any[]>([])
  const [anamneses, setAnamneses] = useState<any[]>([])
  const [aba, setAba] = useState<
    'resumo' | 'pacotes' | 'historico' | 'anamnese'
  >('resumo')

  const [carregando, setCarregando] = useState(true)
  const [editandoObs, setEditandoObs] = useState(false)
  const [obsText, setObsText] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    if (profile.salao_id && clienteId) {
      carregarDados()
    }
  }, [loading, profile, clienteId])

  async function carregarDados() {
    try {
      const { data: sal } = await supabase
        .from('saloes')
        .select('*')
        .eq('id', profile!.salao_id!)
        .single()

      setSalao(sal)

      const {
        data: cli,
        error: erroCli
      } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single()

      if (erroCli || !cli) {
        setCarregando(false)
        return
      }

      setCliente(cli)
      setObsText(cli?.observacoes_internas || '')

      // ============================================================
      // AGENDAMENTOS
      // ============================================================

      const { data: ags } = await supabase
        .from('agendamentos')
        .select(
          '*, servicos(nome, preco), profiles!agendamentos_profissional_id_fkey(nome)'
        )
        .eq('cliente_id', clienteId)
        .order('data_hora', { ascending: false })

      setAgendamentos(ags || [])

      // ============================================================
      // PACOTES
      //
      // A estrutura atual usada pelo sistema é:
      // pacotes_clientes_resumo
      //
      // O vínculo atual é pelo nome do cliente.
      // ============================================================

      const {
        data: pacs,
        error: erroPacotes
      } = await supabase
        .from('pacotes_clientes_resumo')
        .select('*')
        .eq('cliente_nome', cli.nome)
        .order('created_at', { ascending: false })

      if (erroPacotes) {
        console.error(
          'Erro ao carregar pacotes do cliente:',
          erroPacotes
        )
        setPacotes([])
      } else {
        setPacotes(pacs || [])
      }

      // ============================================================
      // ANAMNESES
      // ============================================================

      const { data: ans } = await supabase
        .from('respostas_anamnese')
        .select('*, fichas_anamnese(titulo)')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })

      setAnamneses(ans || [])

    } catch (err) {
      console.error(
        'Erro ao carregar dados do cliente:',
        err
      )
    } finally {
      setCarregando(false)
    }
  }

  async function salvarObservacoes() {
    setSalvandoObs(true)

    const { error } = await supabase
      .from('clientes')
      .update({
        observacoes_internas: obsText
      })
      .eq('id', clienteId)

    if (error) {
      console.error(
        'Erro ao salvar observações:',
        error
      )
      setSalvandoObs(false)
      return
    }

    setCliente((prev: any) => ({
      ...prev,
      observacoes_internas: obsText
    }))

    setSalvandoObs(false)
    setEditandoObs(false)
  }

  const cor =
    salao?.cor_primaria ||
    '#E91E8C'

  // ============================================================
  // ESTATÍSTICAS DOS PACOTES
  // ============================================================

  const pacotesAtivos =
    pacotes.filter(
      p => p.status === 'ativo'
    )

  const totalSessoes =
    pacotesAtivos.reduce(
      (acc, p) =>
        acc + Number(p.sessoes_restantes || 0),
      0
    )

  const totalPacotesAtivos =
    pacotesAtivos.length

  const statusCor: Record<string, string> = {
    confirmado:
      'bg-green-50 text-green-600',
    pendente:
      'bg-yellow-50 text-yellow-600',
    concluido:
      'bg-gray-100 text-gray-500',
    cancelado:
      'bg-red-50 text-red-400',
  }

  if (loading || carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{
            borderColor: cor
          }}
        />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4">
        <p className="text-gray-600 font-medium">
          Cliente não encontrado ou ID inválido.
        </p>

        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl text-white text-sm"
          style={{
            backgroundColor: cor
          }}
        >
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <div
        className="relative overflow-hidden px-4 pt-12 pb-20"
        style={{
          background:
            `linear-gradient(135deg, ${cor}, ${cor}bb)`
        }}
      >

        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10 bg-white" />
        <div className="absolute top-16 -left-8 w-24 h-24 rounded-full opacity-10 bg-white" />

        <button
          onClick={() => router.back()}
          className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-4"
        >
          <ArrowLeft
            size={18}
            className="text-white"
          />
        </button>

        <div className="relative flex items-center gap-4">

          <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white font-bold text-2xl shrink-0">
            {cliente?.nome
              ?.charAt(0)
              .toUpperCase()}
          </div>

          <div className="flex-1">

            <h1 className="text-white font-bold text-xl leading-tight">
              {cliente?.nome}
            </h1>

            {cliente?.email && (
              <div className="flex items-center gap-1.5 mt-1">

                <Mail
                  size={12}
                  className="text-white/70"
                />

                <p className="text-white/70 text-xs">
                  {cliente.email}
                </p>

              </div>
            )}

          </div>

        </div>

      </div>

      {/* ====================================================== */}
      {/* RESUMO */}
      {/* ====================================================== */}

      <div className="px-4 -mt-10 relative z-10 mb-4">

        <div className="bg-white rounded-2xl shadow-md grid grid-cols-3 divide-x divide-gray-100">

          <div className="flex flex-col items-center py-4 gap-0.5">

            <p className="text-2xl font-bold text-gray-900">
              {agendamentos.length}
            </p>

            <p className="text-xs text-gray-400">
              Atendimentos
            </p>

          </div>

          <div className="flex flex-col items-center py-4 gap-0.5">

            <p
              className="text-2xl font-bold"
              style={{
                color: cor
              }}
            >
              {totalPacotesAtivos}
            </p>

            <p className="text-xs text-gray-400">
              Pacotes ativos
            </p>

          </div>

          <div className="flex flex-col items-center py-4 gap-0.5">

            <p className="text-2xl font-bold text-gray-900">
              {totalSessoes}
            </p>

            <p className="text-xs text-gray-400 text-center leading-tight">
              Sessões restantes
            </p>

          </div>

        </div>

      </div>

      {/* ====================================================== */}
      {/* WHATSAPP */}
      {/* ====================================================== */}

      {cliente?.telefone && (

        <div className="px-4 mb-4">

          <a
            href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-medium text-sm"
            style={{
              backgroundColor: '#25D366'
            }}
          >

            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="white"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.198-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>

            Enviar mensagem no WhatsApp

          </a>

        </div>

      )}

      {/* ====================================================== */}
      {/* ABAS */}
      {/* ====================================================== */}

      <div className="px-4 mb-4">

        <div className="flex gap-1.5 bg-white rounded-2xl p-1 shadow-sm overflow-x-auto">

          {([
            {
              key: 'resumo',
              label: 'Resumo'
            },
            {
              key: 'historico',
              label: 'Histórico'
            },
            {
              key: 'pacotes',
              label: 'Pacotes'
            },
            {
              key: 'anamnese',
              label: 'Anamnese'
            }
          ] as const).map(t => (

            <button
              key={t.key}
              onClick={() => setAba(t.key)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
              style={
                aba === t.key
                  ? {
                      backgroundColor: cor,
                      color: 'white'
                    }
                  : {
                      color: '#9ca3af'
                    }
              }
            >
              {t.label}
            </button>

          ))}

        </div>

      </div>

      <div className="px-4 flex flex-col gap-3">

        {/* ====================================================== */}
        {/* RESUMO */}
        {/* ====================================================== */}

        {aba === 'resumo' && (
          <>

            <div className="card flex flex-col gap-2">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <Lock
                    size={14}
                    style={{
                      color: cor
                    }}
                  />

                  <p className="text-sm font-semibold text-gray-700">
                    Observações internas
                  </p>

                </div>

                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                  Gestão
                </span>

              </div>

              {editandoObs ? (

                <div className="flex flex-col gap-2">

                  <textarea
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                    rows={5}
                    placeholder="Ex: Tintura 7.1, alérgica a amônia..."
                    value={obsText}
                    onChange={e =>
                      setObsText(e.target.value)
                    }
                    autoFocus
                  />

                  <div className="flex gap-2">

                    <button
                      onClick={() => {
                        setObsText(
                          cliente?.observacoes_internas || ''
                        )
                        setEditandoObs(false)
                      }}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <X size={14} />
                      Cancelar
                    </button>

                    <button
                      onClick={salvarObservacoes}
                      disabled={salvandoObs}
                      className="flex-1 py-2 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-1"
                      style={{
                        backgroundColor: cor
                      }}
                    >
                      {salvandoObs
                        ? '...'
                        : (
                          <>
                            <Check size={14} />
                            Salvar
                          </>
                        )}
                    </button>

                  </div>

                </div>

              ) : (

                <button
                  onClick={() =>
                    setEditandoObs(true)
                  }
                  className="text-left w-full"
                >

                  {cliente?.observacoes_internas ? (

                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {cliente.observacoes_internas}
                    </p>

                  ) : (

                    <p className="text-sm text-gray-300 italic">
                      Toque para adicionar observações...
                    </p>

                  )}

                </button>

              )}

            </div>

            <div className="card flex flex-col gap-2">

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Dados pessoais
              </p>

              {cliente?.email && (

                <div className="flex items-center gap-2">

                  <Mail
                    size={14}
                    className="text-gray-400 shrink-0"
                  />

                  <p className="text-sm text-gray-700">
                    {cliente.email}
                  </p>

                </div>

              )}

              {cliente?.data_nascimento && (

                <div className="flex items-center gap-2">

                  <Calendar
                    size={14}
                    className="text-gray-400 shrink-0"
                  />

                  <p className="text-sm text-gray-700">
                    Nasc:{' '}
                    {new Date(
                      cliente.data_nascimento +
                      'T12:00'
                    ).toLocaleDateString(
                      'pt-BR'
                    )}
                  </p>

                </div>

              )}

            </div>

          </>
        )}

        {/* ====================================================== */}
        {/* HISTÓRICO */}
        {/* ====================================================== */}

        {aba === 'historico' && (

          agendamentos.length === 0 ? (

            <div className="card text-center py-8">

              <Calendar
                size={32}
                className="text-gray-300 mx-auto mb-2"
              />

              <p className="text-gray-400">
                Nenhum atendimento
              </p>

            </div>

          ) : (

            agendamentos.map(ag => (

              <div
                key={ag.id}
                className="card flex flex-col gap-1"
              >

                <div className="flex items-start justify-between">

                  <p className="font-semibold text-gray-900">
                    {ag.servicos?.nome}
                  </p>

                  <span
                    className={
                      'text-xs px-2 py-0.5 rounded-full ' +
                      (
                        statusCor[ag.status] ||
                        'bg-gray-100 text-gray-500'
                      )
                    }
                  >
                    {ag.status}
                  </span>

                </div>

                <p className="text-xs text-gray-400">
                  {new Date(
                    ag.data_hora
                  ).toLocaleDateString(
                    'pt-BR',
                    {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }
                  )}
                </p>

              </div>

            ))

          )

        )}

        {/* ====================================================== */}
        {/* PACOTES */}
        {/* ====================================================== */}

        {aba === 'pacotes' && (

          pacotes.length === 0 ? (

            <div className="card text-center py-8">

              <Package
                size={32}
                className="text-gray-300 mx-auto mb-2"
              />

              <p className="text-gray-400">
                Nenhum pacote
              </p>

            </div>

          ) : (

            pacotes.map(p => {

              const sessoesTotal =
                Number(
                  p.sessoes_total || 0
                )

              const sessoesRestantes =
                Number(
                  p.sessoes_restantes || 0
                )

              const sessoesUsadas =
                Math.max(
                  0,
                  sessoesTotal -
                    sessoesRestantes
                )

              const percentual =
                sessoesTotal > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (sessoesUsadas /
                          sessoesTotal) *
                          100
                      )
                    )
                  : 0

              const historicoSessoes =
                Array.isArray(
                  p.historico_sessoes
                )
                  ? p.historico_sessoes
                  : []

              return (

                <div
                  key={p.id}
                  className="card flex flex-col gap-3"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div>

                      <p className="font-bold text-gray-900">
                        {p.servico ||
                          'Pacote'}
                      </p>

                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.status === 'ativo'
                          ? 'Pacote ativo'
                          : 'Pacote concluído'}
                      </p>

                    </div>

                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        backgroundColor:
                          p.status === 'ativo'
                            ? `${cor}15`
                            : '#f3f4f6',
                        color:
                          p.status === 'ativo'
                            ? cor
                            : '#9ca3af'
                      }}
                    >
                      {p.status === 'ativo'
                        ? 'Ativo'
                        : 'Concluído'}
                    </span>

                  </div>

                  <div className="grid grid-cols-3 gap-2">

                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">

                      <p className="text-lg font-bold text-gray-900">
                        {sessoesTotal}
                      </p>

                      <p className="text-[10px] text-gray-400">
                        Total
                      </p>

                    </div>

                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">

                      <p className="text-lg font-bold text-gray-900">
                        {sessoesUsadas}
                      </p>

                      <p className="text-[10px] text-gray-400">
                        Usadas
                      </p>

                    </div>

                    <div
                      className="rounded-xl p-2.5 text-center"
                      style={{
                        backgroundColor:
                          `${cor}10`
                      }}
                    >

                      <p
                        className="text-lg font-bold"
                        style={{
                          color: cor
                        }}
                      >
                        {sessoesRestantes}
                      </p>

                      <p className="text-[10px] text-gray-400">
                        Restantes
                      </p>

                    </div>

                  </div>

                  <div>

                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">

                      <span>
                        Utilização
                      </span>

                      <span>
                        {percentual}%
                      </span>

                    </div>

                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">

                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width:
                            `${percentual}%`,
                          backgroundColor:
                            cor
                        }}
                      />

                    </div>

                  </div>

                  {historicoSessoes.length > 0 && (

                    <div className="border-t border-gray-100 pt-3">

                      <p className="text-xs font-semibold text-gray-500 mb-2">
                        Sessões realizadas
                      </p>

                      <div className="flex flex-col gap-1.5">

                        {historicoSessoes
                          .slice()
                          .reverse()
                          .slice(0, 5)
                          .map(
                            (
                              sessao: any,
                              index: number
                            ) => (

                              <div
                                key={
                                  sessao.id ||
                                  index
                                }
                                className="flex items-center justify-between text-xs"
                              >

                                <span className="text-gray-500">
                                  {sessao.data
                                    ? new Date(
                                        sessao.data
                                      ).toLocaleDateString(
                                        'pt-BR'
                                      )
                                    : `Sessão ${
                                        index + 1
                                      }`}
                                </span>

                                {sessao.servico && (

                                  <span className="text-gray-400">
                                    {sessao.servico}
                                  </span>

                                )}

                              </div>

                            )
                          )}

                      </div>

                    </div>

                  )}

                </div>

              )
            })

          )

        )}

        {/* ====================================================== */}
        {/* ANAMNESE */}
        {/* ====================================================== */}

        {aba === 'anamnese' && (

          anamneses.length === 0 ? (

            <div className="card text-center py-8">

              <ClipboardList
                size={32}
                className="text-gray-300 mx-auto mb-2"
              />

              <p className="text-gray-400">
                Nenhuma anamnese respondida
              </p>

            </div>

          ) : (

            anamneses.map(a => (

              <div
                key={a.id}
                className="card flex flex-col gap-2"
              >

                <p className="font-semibold text-gray-900">
                  {a.fichas_anamnese?.titulo}
                </p>

              </div>

            ))

          )

        )}

      </div>

    </div>
  )
}