// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Clock,
  Plus,
  Trash2,
  Check,
  ChevronUp,
  Calendar,
  Megaphone,
  UserRound,
  Timer,
  BriefcaseBusiness,
} from 'lucide-react'

const PADRAO = {
  Domingo: false,
  'Segunda-feira': true,
  'Terça-feira': true,
  'Quarta-feira': true,
  'Quinta-feira': true,
  'Sexta-feira': true,
  'Sábado': true,
}

export default function SalaoHorariosPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)

  const [salao, setSalao] = useState<any>(null)
  const [funcionamento, setFuncionamento] = useState<any>(PADRAO)

  const [horarios, setHorarios] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false)

  const [formVago, setFormVago] = useState({
    data: '',
    hora: '',
    duracao_minutos: 60,
    profissional_id: '',
    servico_id: '',
    observacao: '',
  })

  const [salvandoHorario, setSalvandoHorario] =
    useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!profile) {
      router.push('/login')
      return
    }

    carregarDados()
  }, [profile, authLoading])

  const carregarDados = async () => {
    if (!profile?.salao_id) return

    try {
      setCarregando(true)

      const [
        salaoResponse,
        funcionamentoResponse,
        horariosResponse,
        profissionaisResponse,
        servicosResponse,
      ] = await Promise.all([
        supabase
          .from('saloes')
          .select('*')
          .eq('id', profile.salao_id)
          .maybeSingle(),

        supabase
          .from('saloes')
          .select('horarios_funcionamento')
          .eq('id', profile.salao_id)
          .maybeSingle(),

        /*
         * Agora buscamos também o serviço relacionado
         * através do servico_id.
         */
        supabase
          .from('horarios_vagos')
          .select(`
            *,
            servicos:servico_id(id, nome),
            profiles:profissional_id(id, nome),
            clientes:cliente_id(id, nome)
          `)
          .eq('salao_id', profile.salao_id)
          .order('data_hora', {
            ascending: true,
          }),

        supabase
          .from('profiles')
          .select('id, nome')
          .eq('salao_id', profile.salao_id)
          .order('nome'),

        supabase
          .from('servicos')
          .select('*')
          .eq('salao_id', profile.salao_id)
          .order('nome'),
      ])

      if (salaoResponse.error) {
        console.error(
          'Erro ao carregar salão:',
          salaoResponse.error
        )
      }

      if (funcionamentoResponse.error) {
        console.error(
          'Erro ao carregar funcionamento:',
          funcionamentoResponse.error
        )
      }

      if (horariosResponse.error) {
        console.error(
          'Erro ao carregar horários:',
          horariosResponse.error
        )
      }

      if (profissionaisResponse.error) {
        console.error(
          'Erro ao carregar profissionais:',
          profissionaisResponse.error
        )
      }

      if (servicosResponse.error) {
        console.error(
          'Erro ao carregar serviços:',
          servicosResponse.error
        )
      }

      setSalao(salaoResponse.data || null)

      const funcionamentoSalvo =
        funcionamentoResponse.data
          ?.horarios_funcionamento

      if (funcionamentoSalvo) {
        try {
          const valor =
            typeof funcionamentoSalvo === 'string'
              ? JSON.parse(funcionamentoSalvo)
              : funcionamentoSalvo

          setFuncionamento({
            ...PADRAO,
            ...valor,
          })
        } catch {
          setFuncionamento(PADRAO)
        }
      }

      setHorarios(horariosResponse.data || [])
      setProfissionais(
        profissionaisResponse.data || []
      )
      setServicos(servicosResponse.data || [])
    } catch (error) {
      console.error(
        'Erro ao carregar página:',
        error
      )
    } finally {
      setCarregando(false)
    }
  }

  const obterDuracaoServico = (servico: any) => {
    if (!servico) return 60

    const campos = [
      'duracao_minutos',
      'duracao',
      'tempo_minutos',
      'tempo',
      'duracao_estimada',
      'tempo_estimado',
    ]

    for (const campo of campos) {
      const valor = Number(servico?.[campo])

      if (
        Number.isFinite(valor) &&
        valor > 0
      ) {
        return valor
      }
    }

    return 60
  }

  const selecionarServico = (
    servicoId: string
  ) => {
    const servico = servicos.find(
      (item) => item.id === servicoId
    )

    setFormVago((anterior) => ({
      ...anterior,
      servico_id: servicoId,
      duracao_minutos:
        obterDuracaoServico(servico),
    }))
  }

  const liberarHorario = async () => {
    if (!profile?.salao_id) return

    if (!formVago.data) {
      alert('Selecione a data do horário.')
      return
    }

    if (!formVago.hora) {
      alert('Selecione o horário.')
      return
    }

    if (!formVago.servico_id) {
      alert('Selecione o procedimento.')
      return
    }

    setSalvandoHorario(true)

    try {
      /*
       * A data e hora digitadas representam o horário
       * local do salão.
       *
       * Não adicionar "Z" manualmente.
       */
      const dataHoraBanco = new Date(
        `${formVago.data}T${formVago.hora}:00`
      ).toISOString()

      const duracao =
        Number(formVago.duracao_minutos) > 0
          ? Number(formVago.duracao_minutos)
          : 60

      const { data, error } = await supabase
        .from('horarios_vagos')
        .insert({
          salao_id: profile.salao_id,
          data_hora: dataHoraBanco,

          /*
           * NOVO:
           * agora a vaga realmente guarda
           * qual procedimento será realizado.
           */
          servico_id: formVago.servico_id,

          duracao_minutos: duracao,

          profissional_id:
            formVago.profissional_id || null,

          observacao:
            formVago.observacao || null,
        })
        .select(`
          *,
          servicos:servico_id(id, nome),
          profiles:profissional_id(id, nome),
          clientes:cliente_id(id, nome)
        `)
        .single()

      if (error) {
        console.error(
          'Erro ao liberar horário:',
          error
        )

        alert(error.message)
        return
      }

      setHorarios((anteriores) =>
        [...anteriores, data].sort(
          (a, b) =>
            new Date(
              a.data_hora
            ).getTime() -
            new Date(
              b.data_hora
            ).getTime()
        )
      )

      setFormVago({
        data: '',
        hora: '',
        duracao_minutos: 60,
        profissional_id: '',
        servico_id: '',
        observacao: '',
      })

      setMostrarFormulario(false)
    } catch (error: any) {
      console.error(
        'Erro ao liberar horário:',
        error
      )

      alert(
        error?.message ||
          'Não foi possível liberar o horário.'
      )
    } finally {
      setSalvandoHorario(false)
    }
  }

  const excluirHorario = async (
    id: string
  ) => {
    const confirmar = window.confirm(
      'Deseja realmente excluir este horário?'
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('horarios_vagos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(
        'Erro ao excluir horário:',
        error
      )

      alert(error.message)
      return
    }

    setHorarios((anteriores) =>
      anteriores.filter(
        (horario) => horario.id !== id
      )
    )
  }

  const formatarDataCompleta = (
    valor: string
  ) => {
    if (!valor) return ''

    const data = new Date(valor)

    return data.toLocaleDateString(
      'pt-BR',
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }
    )
  }

  const formatarDataCurta = (
    valor: string
  ) => {
    if (!valor) return ''

    const data = new Date(valor)

    return data.toLocaleDateString(
      'pt-BR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }
    )
  }

  const formatarHora = (
    valor: string
  ) => {
    if (!valor) return ''

    const data = new Date(valor)

    return data.toLocaleTimeString(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    )
  }

  const abrirStudio = () => {
    router.push('/salao/studio')
  }

  if (
    authLoading ||
    carregando
  ) {
    return (
      <main className="min-h-screen bg-[#faf7f8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-pink-100 border-t-pink-500 animate-spin mx-auto mb-4" />

          <p className="text-sm text-gray-500">
            Carregando horários...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#faf7f8] pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">

        {/* CABEÇALHO */}
        <header className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-600 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
              Horários vagos
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Gerencie as vagas disponíveis para agendamento.
            </p>
          </div>
        </header>

        {/* DESTAQUE STUDIO */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#fff5f7] via-white to-[#f8f1f4] rounded-3xl border border-pink-100 shadow-sm p-5 mb-5">
          <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-pink-100/60" />
          <div className="absolute -left-8 -bottom-12 w-28 h-28 rounded-full bg-[#e9d9df]/40" />

          <div className="relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white border border-pink-100 shadow-sm flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-6 h-6 text-[#d98fa5]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-gray-800">
                    Organiza Studio
                  </h2>

                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-pink-100 text-pink-600">
                    Novo
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  Transforme seus horários, serviços e novidades em conteúdos prontos para divulgar.
                </p>

                <button
                  type="button"
                  onClick={abrirStudio}
                  className="mt-4 rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] text-white px-4 py-3 text-sm font-medium inline-flex items-center gap-2 transition"
                >
                  <Megaphone className="w-4 h-4" />
                  Criar conteúdo
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* CADASTRO */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-pink-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-pink-500" />
              </div>

              <div>
                <h2 className="font-semibold text-gray-800">
                  Horários disponíveis
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Cadastre horários que ainda podem ser agendados.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setMostrarFormulario(
                  (valor) => !valor
                )
              }
              className="rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] text-white px-4 py-3 font-medium flex items-center justify-center gap-2 transition"
            >
              {mostrarFormulario ? (
                <>
                  <ChevronUp className="w-5 h-5" />
                  Fechar
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Liberar horário
                </>
              )}
            </button>
          </div>

          {mostrarFormulario && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* DATA */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>

                  <input
                    type="date"
                    value={formVago.data}
                    onChange={(e) =>
                      setFormVago(
                        (anterior) => ({
                          ...anterior,
                          data: e.target.value,
                        })
                      )
                    }
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  />
                </div>

                {/* HORA */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Horário
                  </label>

                  <input
                    type="time"
                    value={formVago.hora}
                    onChange={(e) =>
                      setFormVago(
                        (anterior) => ({
                          ...anterior,
                          hora: e.target.value,
                        })
                      )
                    }
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  />
                </div>

                {/* PROCEDIMENTO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Procedimento
                  </label>

                  <div className="relative">
                    <BriefcaseBusiness className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                    <select
                      value={formVago.servico_id}
                      onChange={(e) =>
                        selecionarServico(
                          e.target.value
                        )
                      }
                      className="w-full appearance-none rounded-2xl border border-gray-200 pl-11 pr-4 py-3 bg-white outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                    >
                      <option value="">
                        Selecione o procedimento
                      </option>

                      {servicos.map(
                        (servico) => (
                          <option
                            key={servico.id}
                            value={servico.id}
                          >
                            {servico.nome}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                {/* PROFISSIONAL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profissional
                  </label>

                  <div className="relative">
                    <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                    <select
                      value={
                        formVago.profissional_id
                      }
                      onChange={(e) =>
                        setFormVago(
                          (anterior) => ({
                            ...anterior,
                            profissional_id:
                              e.target.value,
                          })
                        )
                      }
                      className="w-full appearance-none rounded-2xl border border-gray-200 pl-11 pr-4 py-3 bg-white outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                    >
                      <option value="">
                        Qualquer profissional
                      </option>

                      {profissionais.map(
                        (profissional) => (
                          <option
                            key={
                              profissional.id
                            }
                            value={
                              profissional.id
                            }
                          >
                            {profissional.nome}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                {/* DURAÇÃO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duração
                  </label>

                  <div className="relative">
                    <Timer className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={
                        formVago.duracao_minutos
                      }
                      onChange={(e) =>
                        setFormVago(
                          (anterior) => ({
                            ...anterior,
                            duracao_minutos:
                              Number(
                                e.target.value
                              ),
                          })
                        )
                      }
                      className="w-full rounded-2xl border border-gray-200 pl-11 pr-4 py-3 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                    />
                  </div>
                </div>

                {/* OBSERVAÇÃO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observação
                  </label>

                  <input
                    type="text"
                    value={
                      formVago.observacao
                    }
                    onChange={(e) =>
                      setFormVago(
                        (anterior) => ({
                          ...anterior,
                          observacao:
                            e.target.value,
                        })
                      )
                    }
                    placeholder="Ex.: encaixe, última vaga..."
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  />
                </div>
              </div>

              {/* RESUMO */}
              {formVago.data &&
                formVago.hora &&
                formVago.servico_id && (
                  <div className="mt-5 rounded-2xl bg-[#fff7f9] border border-pink-100 p-4">
                    <p className="text-xs font-medium text-pink-500 uppercase tracking-wide mb-2">
                      Resumo da vaga
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
                      <span className="font-semibold">
                        {formVago.hora}
                      </span>

                      <span className="text-gray-300">
                        •
                      </span>

                      <span className="font-medium">
                        {
                          servicos.find(
                            (servico) =>
                              servico.id ===
                              formVago.servico_id
                          )?.nome
                        }
                      </span>

                      {formVago.profissional_id && (
                        <>
                          <span className="text-gray-300">
                            •
                          </span>

                          <span className="text-gray-500">
                            {
                              profissionais.find(
                                (profissional) =>
                                  profissional.id ===
                                  formVago.profissional_id
                              )?.nome
                            }
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <button
                  type="button"
                  onClick={liberarHorario}
                  disabled={
                    salvandoHorario
                  }
                  className="flex-1 rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] disabled:opacity-60 text-white py-3.5 font-medium flex items-center justify-center gap-2 transition"
                >
                  <Check className="w-5 h-5" />

                  {salvandoHorario
                    ? 'Salvando...'
                    : 'Liberar horário'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* LISTAGEM */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-pink-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-pink-500" />
              </div>

              <div>
                <h2 className="font-semibold text-gray-800">
                  Vagas cadastradas
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  {horarios.length}{' '}
                  {horarios.length === 1
                    ? 'horário disponível'
                    : 'horários disponíveis'}
                </p>
              </div>
            </div>
          </div>

          {horarios.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 rounded-3xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-7 h-7 text-gray-300" />
              </div>

              <p className="text-gray-600 font-medium">
                Nenhum horário vago cadastrado.
              </p>

              <p className="text-sm text-gray-400 mt-1">
                Libere seu primeiro horário acima.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {horarios.map(
                (horario) => {
                  const data = new Date(
                    horario.data_hora
                  )

                  const servico =
                    horario?.servicos?.nome ||
                    'Procedimento não informado'

                  const profissional =
                    horario?.profiles?.nome

                  return (
                    <div
                      key={horario.id}
                      className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 hover:border-pink-100 transition"
                    >
                      <div className="flex items-start gap-4">
                        {/* HORÁRIO */}
                        <div className="w-14 h-14 rounded-2xl bg-[#fff2f5] flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-[#c87891] leading-none">
                            {formatarHora(
                              horario.data_hora
                            )}
                          </span>

                          <span className="text-[9px] text-pink-400 mt-1 uppercase tracking-wide">
                            horário
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* DATA */}
                          <p className="text-xs text-gray-400 mb-1 capitalize">
                            {formatarDataCompleta(
                              horario.data_hora
                            )}
                          </p>

                          {/* PROCEDIMENTO — PRINCIPAL */}
                          <h3 className="text-base sm:text-lg font-semibold text-gray-800 leading-snug">
                            {servico}
                          </h3>

                          {/* INFORMAÇÕES SECUNDÁRIAS */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
                            {profissional && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                                <UserRound className="w-3.5 h-3.5" />
                                {profissional}
                              </span>
                            )}

                            {horario.duracao_minutos && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                                <Timer className="w-3.5 h-3.5" />
                                {
                                  horario.duracao_minutos
                                }{' '}
                                min
                              </span>
                            )}
                          </div>

                          {horario.observacao && (
                            <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2">
                              <p className="text-xs text-gray-500">
                                {horario.observacao}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* EXCLUIR */}
                        <button
                          type="button"
                          onClick={() =>
                            excluirHorario(
                              horario.id
                            )
                          }
                          className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0 hover:bg-red-100 transition"
                          title="Excluir horário"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* AÇÃO DE DIVULGAÇÃO */}
                      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-400">
                            Quer preencher esta vaga?
                          </p>

                          <p className="text-xs text-gray-500 mt-0.5">
                            Crie uma arte personalizada no Studio.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={abrirStudio}
                          className="rounded-xl bg-[#fff2f5] text-[#c87891] px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-pink-100 transition"
                        >
                          <Megaphone className="w-4 h-4" />
                          Divulgar
                        </button>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}