'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Camera,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart
} from 'lucide-react'

type EvolucaoRegistro = {
  id: string
  categoria?: string | null
  subcategoria?: string | null
  servico_nome?: string | null
  foto_antes?: string | null
  foto_depois?: string | null
  observacoes?: string | null
  data_registro?: string | null
  created_at?: string | null
  visivel_cliente?: boolean | null
  profiles?: {
    nome?: string | null
  } | null
}

export default function EvolucaoClientePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [evolucoes, setEvolucoes] = useState<EvolucaoRegistro[]>([])

  const [indexAtivo, setIndexAtivo] = useState(0)

  const [ladoAtivo, setLadoAtivo] = useState<
    Record<string, 'antes' | 'depois'>
  >({})

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    carregarEvolucao()
  }, [loading, profile])

  async function carregarEvolucao() {
    if (!profile?.id) return

    setCarregando(true)
    setErro('')

    try {
      // =====================================================
      // 1. DESCOBRIR A CLIENTE LIGADA AO PERFIL LOGADO
      // =====================================================

      const {
        data: cli,
        error: erroCliente
      } = await supabase
        .from('clientes')
        .select('*')
        .eq('profile_id', profile.id)
        .single()

      if (erroCliente || !cli) {
        console.error(
          'Erro ao localizar cliente:',
          erroCliente?.message
        )

        setCliente(null)
        setEvolucoes([])

        setErro(
          'Não foi possível localizar seu cadastro de cliente.'
        )

        return
      }

      setCliente(cli)

      // =====================================================
      // 2. CARREGAR O SALÃO
      // =====================================================

      if (cli.salao_id) {
        const {
          data: sal,
          error: erroSalao
        } = await supabase
          .from('saloes')
          .select('*')
          .eq('id', cli.salao_id)
          .single()

        if (!erroSalao) {
          setSalao(sal)
        }
      } else if (profile.salao_id) {
        const {
          data: sal,
          error: erroSalao
        } = await supabase
          .from('saloes')
          .select('*')
          .eq('id', profile.salao_id)
          .single()

        if (!erroSalao) {
          setSalao(sal)
        }
      }

      // =====================================================
      // 3. BUSCAR EVOLUÇÕES DA CLIENTE
      // =====================================================

      const {
        data: registros,
        error: erroEvolucao
      } = await supabase
        .from('evolucao_registros')
        .select(`
          id,
          categoria,
          subcategoria,
          servico_nome,
          foto_antes,
          foto_depois,
          observacoes,
          data_registro,
          created_at,
          visivel_cliente,
          profiles(nome)
        `)
        .eq('cliente_id', cli.id)
        .eq('visivel_cliente', true)
        .order('data_registro', {
          ascending: false
        })

      if (erroEvolucao) {
        console.error(
          'Erro ao carregar evolução:',
          erroEvolucao.message
        )

        setErro(
          'Não foi possível carregar sua evolução.'
        )

        setEvolucoes([])
        return
      }

      setEvolucoes(
        (registros || []) as EvolucaoRegistro[]
      )

      setIndexAtivo(0)
    } catch (error) {
      console.error(
        'Erro inesperado ao carregar evolução:',
        error
      )

      setErro(
        'Ocorreu um erro ao carregar sua evolução.'
      )
    } finally {
      setCarregando(false)
    }
  }

  const cor =
    salao?.cor_primaria || '#E91E8C'

  // =========================================================
  // LOADING
  // =========================================================

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{
            borderColor: cor,
            borderTopColor: 'transparent'
          }}
        />
      </div>
    )
  }

  // =========================================================
  // CLIENTE NÃO ENCONTRADA
  // =========================================================

  if (!cliente) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-5">
        <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100 max-w-sm w-full">

          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              backgroundColor: `${cor}15`
            }}
          >
            <Sparkles
              size={26}
              style={{
                color: cor
              }}
            />
          </div>

          <h2 className="font-bold text-gray-800">
            Minha Evolução
          </h2>

          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            {erro ||
              'Não foi possível localizar seu cadastro.'}
          </p>

          <button
            onClick={() => router.back()}
            className="mt-5 px-5 py-3 rounded-xl text-white text-sm font-semibold"
            style={{
              backgroundColor: cor
            }}
          >
            Voltar
          </button>

        </div>
      </div>
    )
  }

  // =========================================================
  // REGISTRO ATUAL
  // =========================================================

  const registroAtual =
    evolucoes[indexAtivo]

  const lado = registroAtual
    ? ladoAtivo[registroAtual.id] ||
      (registroAtual.foto_depois
        ? 'depois'
        : 'antes')
    : 'depois'

  const urlAtiva =
    registroAtual
      ? lado === 'antes'
        ? registroAtual.foto_antes
        : registroAtual.foto_depois
      : null

  const temAmbos =
    registroAtual
      ? !!(
          registroAtual.foto_antes &&
          registroAtual.foto_depois
        )
      : false

  const dataRegistro =
    registroAtual?.data_registro ||
    registroAtual?.created_at

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">

        <div className="flex items-center gap-3">

          <button
            onClick={() => router.back()}
            className="p-1"
          >
            <ArrowLeft
              size={22}
              className="text-gray-700"
            />
          </button>

          <div className="flex items-center gap-2">

            <Sparkles
              size={20}
              style={{
                color: cor
              }}
            />

            <h1 className="font-bold text-gray-900 text-lg">
              Minha Evolução
            </h1>

          </div>

        </div>

      </div>

      <div className="p-4 max-w-md mx-auto space-y-5">

        {/* ===================================================
            ERRO
        =================================================== */}

        {erro && cliente && (
          <div className="bg-red-50 border border-red-100 text-red-600 rounded-2xl px-4 py-3 text-xs">
            {erro}
          </div>
        )}

        {/* ===================================================
            BANNER
        =================================================== */}

        <div
          className="p-5 rounded-3xl text-white shadow-sm space-y-1"
          style={{
            background:
              `linear-gradient(135deg, ${cor}, #F48BAE)`
          }}
        >

          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-90">
            <Heart size={14} />
            Seus Resultados
          </div>

          <h2 className="text-lg font-bold">
            Acompanhe sua transformação
          </h2>

          <p className="text-xs opacity-90 leading-relaxed">
            Confira o histórico de resultados e fotos registradas pela nossa equipe.
          </p>

        </div>

        {/* ===================================================
            SEM EVOLUÇÕES
        =================================================== */}

        {evolucoes.length === 0 ? (

          <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center space-y-3 shadow-sm">

            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
              style={{
                backgroundColor: `${cor}15`,
                color: cor
              }}
            >
              <Camera size={24} />
            </div>

            <h3 className="font-bold text-gray-800 text-sm">
              Nenhum registro disponível
            </h3>

            <p className="text-xs text-gray-400">
              Assim que o profissional registrar suas fotos e liberar o acesso, elas aparecerão aqui!
            </p>

          </div>

        ) : (

          <>

            {/* =================================================
                MINIATURAS
            ================================================= */}

            {evolucoes.length > 1 && (

              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">

                <p className="text-xs font-semibold text-gray-400 mb-2">
                  Histórico de Atendimentos
                </p>

                <div className="flex gap-2 overflow-x-auto pb-1">

                  {evolucoes.map(
                    (item, i) => {

                      const url =
                        item.foto_depois ||
                        item.foto_antes

                      const selecionado =
                        i === indexAtivo

                      const data =
                        item.data_registro ||
                        item.created_at

                      return (
                        <button
                          key={item.id}
                          onClick={() =>
                            setIndexAtivo(i)
                          }
                          className="shrink-0 flex flex-col items-center gap-1"
                        >

                          <div
                            className={
                              `w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                                selecionado
                                  ? 'scale-105'
                                  : 'opacity-40'
                              }`
                            }
                            style={{
                              borderColor:
                                selecionado
                                  ? cor
                                  : 'transparent'
                            }}
                          >

                            {url ? (

                              <img
                                src={url}
                                alt=""
                                className="w-full h-full object-cover"
                              />

                            ) : (

                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <Camera
                                  size={18}
                                  className="text-gray-300"
                                />
                              </div>

                            )}

                          </div>

                          <span className="text-[10px] text-gray-400">
                            {data
                              ? new Date(
                                  data
                                ).toLocaleDateString(
                                  'pt-BR',
                                  {
                                    day: '2-digit',
                                    month: 'short'
                                  }
                                )
                              : ''}
                          </span>

                        </button>
                      )
                    }
                  )}

                </div>

              </div>

            )}

            {/* =================================================
                REGISTRO PRINCIPAL
            ================================================= */}

            {registroAtual && (

              <div className="space-y-3">

                {/* DATA + PROCEDIMENTO */}

                <div className="space-y-1">

                  {dataRegistro && (

                    <p className="text-xs font-bold text-gray-500 flex items-center gap-1">

                      <Calendar
                        size={14}
                        style={{
                          color: cor
                        }}
                      />

                      {new Date(
                        dataRegistro
                      ).toLocaleDateString(
                        'pt-BR',
                        {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        }
                      )}

                    </p>

                  )}

                  {(registroAtual.subcategoria ||
                    registroAtual.servico_nome ||
                    registroAtual.categoria) && (

                    <div className="pt-1">

                      <p className="font-bold text-gray-800 text-base">
                        {registroAtual.subcategoria ||
                          registroAtual.servico_nome ||
                          registroAtual.categoria}
                      </p>

                      {registroAtual.categoria &&
                        registroAtual.subcategoria && (

                          <p className="text-xs text-gray-400 mt-0.5">
                            {registroAtual.categoria}
                            {' • '}
                            {registroAtual.subcategoria}
                          </p>

                        )}

                    </div>

                  )}

                </div>

                {/* =================================================
                    FOTO
                ================================================= */}

                <div className="relative bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">

                  {urlAtiva ? (

                    <img
                      src={urlAtiva}
                      alt={
                        lado === 'antes'
                          ? 'Foto antes'
                          : 'Foto depois'
                      }
                      className="w-full aspect-square object-cover"
                    />

                  ) : (

                    <div className="w-full aspect-square bg-gray-100 flex flex-col items-center justify-center gap-2">

                      <Camera
                        size={32}
                        className="text-gray-300"
                      />

                      <p className="text-xs text-gray-400">
                        Foto {lado} não disponível
                      </p>

                    </div>

                  )}

                  <div className="absolute top-3 left-3">

                    <span
                      className="px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-md"
                      style={{
                        backgroundColor:
                          lado === 'antes'
                            ? '#6b7280'
                            : cor
                      }}
                    >
                      {lado === 'antes'
                        ? '📷 Antes'
                        : '✨ Depois'}
                    </span>

                  </div>

                </div>

                {/* =================================================
                    BOTÕES ANTES / DEPOIS
                ================================================= */}

                {temAmbos && (

                  <div className="flex gap-2">

                    <button
                      onClick={() =>
                        setLadoAtivo(prev => ({
                          ...prev,
                          [registroAtual.id]: 'antes'
                        }))
                      }
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                      style={
                        lado === 'antes'
                          ? {
                              backgroundColor: '#6b7280',
                              color: 'white'
                            }
                          : {
                              backgroundColor: 'white',
                              color: '#9ca3af'
                            }
                      }
                    >
                      📷 Fotos Antes
                    </button>

                    <button
                      onClick={() =>
                        setLadoAtivo(prev => ({
                          ...prev,
                          [registroAtual.id]: 'depois'
                        }))
                      }
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                      style={
                        lado === 'depois'
                          ? {
                              backgroundColor: cor,
                              color: 'white'
                            }
                          : {
                              backgroundColor: 'white',
                              color: '#9ca3af'
                            }
                      }
                    >
                      ✨ Fotos Depois
                    </button>

                  </div>

                )}

                {/* =================================================
                    OBSERVAÇÕES
                ================================================= */}

                {registroAtual.observacoes && (

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">

                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Observação do Profissional
                    </p>

                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                      {registroAtual.observacoes}
                    </p>

                  </div>

                )}

                {/* =================================================
                    PROFISSIONAL
                ================================================= */}

                {registroAtual.profiles?.nome && (

                  <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">

                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Profissional
                    </p>

                    <p className="text-xs text-gray-600 mt-1">
                      {registroAtual.profiles.nome}
                    </p>

                  </div>

                )}

                {/* =================================================
                    NAVEGAÇÃO
                ================================================= */}

                {evolucoes.length > 1 && (

                  <div className="flex gap-2 pt-1">

                    <button
                      onClick={() =>
                        setIndexAtivo(
                          Math.max(
                            0,
                            indexAtivo - 1
                          )
                        )
                      }
                      disabled={
                        indexAtivo === 0
                      }
                      className="flex-1 py-2.5 rounded-xl bg-white text-xs font-bold text-gray-600 flex items-center justify-center gap-1 disabled:opacity-30 shadow-sm border border-gray-100"
                    >
                      <ChevronLeft size={16} />
                      Anterior
                    </button>

                    <button
                      onClick={() =>
                        setIndexAtivo(
                          Math.min(
                            evolucoes.length - 1,
                            indexAtivo + 1
                          )
                        )
                      }
                      disabled={
                        indexAtivo ===
                        evolucoes.length - 1
                      }
                      className="flex-1 py-2.5 rounded-xl bg-white text-xs font-bold text-gray-600 flex items-center justify-center gap-1 disabled:opacity-30 shadow-sm border border-gray-100"
                    >
                      Próximo
                      <ChevronRight size={16} />
                    </button>

                  </div>

                )}

              </div>

            )}

          </>

        )}

      </div>

    </div>
  )
}