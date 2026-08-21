'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Users,
  DollarSign,
  Bell,
  BookOpen,
  ChevronRight,
  X
} from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function FuncionarioDashboard() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)

  const [atendimentosHoje, setAtendimentosHoje] = useState(0)
  const [confirmadosHoje, setConfirmadosHoje] = useState(0)
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(0)

  const [novosGuias, setNovosGuias] = useState<any[]>([])
  const [fechandoGuia, setFechandoGuia] = useState(false)

  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    if (
      profile.role !== 'funcionario' &&
      profile.role !== 'dono_salao'
    ) {
      router.push('/login')
      return
    }

    carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    if (!profile?.salao_id) return

    setCarregando(true)

    try {
      const hojeStr = new Date().toISOString().split('T')[0]

      // ============================================================
      // DADOS DO SALÃO + AGENDA + GUIAS
      // ============================================================

      const [
        salRes,
        agendRes,
        guiasRes,
        visualizadosRes
      ] = await Promise.all([

        supabase
          .from('saloes')
          .select('*')
          .eq('id', profile.salao_id)
          .single(),

        supabase
          .from('agendamentos')
          .select('*')
          .eq('salao_id', profile.salao_id)
          .eq('profissional_id', profile.id)
          .gte('data_hora', `${hojeStr}T00:00:00`)
          .lte('data_hora', `${hojeStr}T23:59:59`),

        supabase
          .from('guias')
          .select(`
            id,
            salao_id,
            categoria,
            titulo,
            conteudo,
            imagem_url,
            created_at,
            updated_at
          `)
          .eq('salao_id', profile.salao_id)
          .order('updated_at', {
            ascending: false
          }),

        supabase
          .from('guias_visualizados')
          .select(`
            guia_id,
            visualizado_em
          `)
          .eq('profile_id', profile.id)
      ])

      // ============================================================
      // SALÃO
      // ============================================================

      setSalao(salRes.data)

      // ============================================================
      // AGENDA
      // ============================================================

      const lista = agendRes.data || []

      setAtendimentosHoje(lista.length)

      setConfirmadosHoje(
        lista.filter(
          (a: any) => a.status === 'confirmado'
        ).length
      )

      setAguardandoConfirmacao(
        lista.filter(
          (a: any) =>
            a.status === 'pendente' ||
            !a.status
        ).length
      )

      // ============================================================
      // GUIAS
      // ============================================================

      if (guiasRes.error) {
        console.error(
          'Erro ao buscar guias:',
          guiasRes.error
        )
        setNovosGuias([])
      } else {

        const guias = guiasRes.data || []
        const visualizados = visualizadosRes.data || []

        /*
          Transformamos os visualizados em um mapa:

          guia_id -> data em que foi visto
        */

        const mapaVisualizados: Record<string, string> = {}

        visualizados.forEach((item: any) => {
          mapaVisualizados[item.guia_id] =
            item.visualizado_em
        })

        /*
          Um guia aparece como "novo" quando:

          1. Nunca foi visualizado pelo funcionário

          OU

          2. Foi editado depois da última visualização
        */

        const pendentes = guias.filter((guia: any) => {

          const visualizadoEm =
            mapaVisualizados[guia.id]

          // Nunca viu
          if (!visualizadoEm) {
            return true
          }

          const ultimaAlteracao =
            guia.updated_at ||
            guia.created_at

          return (
            new Date(ultimaAlteracao).getTime() >
            new Date(visualizadoEm).getTime()
          )
        })

        /*
          Mostra no máximo 3 avisos na tela inicial.
        */

        setNovosGuias(
          pendentes.slice(0, 3)
        )
      }

    } catch (e) {
      console.error(
        'Erro ao carregar:',
        e
      )
    } finally {
      setCarregando(false)
    }
  }

  // ================================================================
  // MARCAR GUIA COMO VISUALIZADO
  // ================================================================

  async function abrirGuia(guia: any) {
    if (!profile?.id) return

    setFechandoGuia(true)

    try {

      /*
        upsert evita erro caso o registro já exista.

        Se o guia foi editado, o visualizado_em será
        atualizado para a nova data.
      */

      const { error } = await supabase
        .from('guias_visualizados')
        .upsert(
          {
            guia_id: guia.id,
            profile_id: profile.id,
            visualizado_em: new Date().toISOString()
          },
          {
            onConflict: 'guia_id,profile_id'
          }
        )

      if (error) {
        console.error(
          'Erro ao marcar guia como visualizado:',
          error
        )
      }

      /*
        Remove imediatamente da tela.
      */

      setNovosGuias(prev =>
        prev.filter(
          g => g.id !== guia.id
        )
      )

      /*
        Abre a página de Guias.
      */

      router.push('/salao/guia')

    } catch (error) {

      console.error(
        'Erro ao abrir guia:',
        error
      )

    } finally {
      setFechandoGuia(false)
    }
  }

  // ================================================================
  // IGNORAR AVISO
  // ================================================================

  async function ignorarGuia(guia: any) {
    if (!profile?.id) return

    try {

      /*
        Mesmo fechando o aviso, consideramos que ele foi visto.
      */

      await supabase
        .from('guias_visualizados')
        .upsert(
          {
            guia_id: guia.id,
            profile_id: profile.id,
            visualizado_em: new Date().toISOString()
          },
          {
            onConflict: 'guia_id,profile_id'
          }
        )

      setNovosGuias(prev =>
        prev.filter(
          g => g.id !== guia.id
        )
      )

    } catch (error) {

      console.error(
        'Erro ao fechar aviso do guia:',
        error
      )

    }
  }

  const cor =
    salao?.cor_primaria ||
    '#E91E8C'

  const horaAtual =
    new Date().getHours()

  const saudacao =
    horaAtual < 12
      ? 'Bom dia'
      : horaAtual < 18
        ? 'Boa tarde'
        : 'Boa noite'

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2"
          style={{ borderColor: cor }}
        />
      </div>
    )
  }

  // ================================================================
  // NAVEGAÇÃO
  // ================================================================

  const navItems =
    profile?.role === 'dono_salao'
      ? [
          {
            icon: Calendar,
            label: 'Início',
            href: '/funcionario'
          },
          {
            icon: Calendar,
            label: 'Agenda',
            href: '/funcionario/agenda'
          },
          {
            icon: Users,
            label: 'Clientes',
            href: '/salao/clientes'
          },
          {
            icon: DollarSign,
            label: 'Finanças',
            href: '/salao/financeiro'
          },
          {
            icon: Bell,
            label: 'Avisos',
            href: '/salao/notificacoes'
          }
        ]
      : [
          {
            icon: Calendar,
            label: 'Início',
            href: '/funcionario'
          },
          {
            icon: Calendar,
            label: 'Agenda',
            href: '/funcionario/agenda'
          }
        ]

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">

      {/* ============================================================
          HEADER
      ============================================================ */}

      <Header
        profile={profile}
        salaoNome={salao?.nome}
        corPrimaria={cor}
      />

      <div className="px-4 py-5 space-y-4 max-w-xl mx-auto">

        {/* ==========================================================
            SAUDAÇÃO
        ========================================================== */}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {saudacao},{' '}
            {profile?.nome?.split(' ')[0]}! ✨
          </h1>

          <p className="text-xs text-gray-500 capitalize mt-0.5">
            {new Date().toLocaleDateString(
              'pt-BR',
              {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              }
            )}
          </p>
        </div>


        {/* ==========================================================
            NOVOS GUIAS
        ========================================================== */}

        {novosGuias.length > 0 && (
          <div className="space-y-2">

            {novosGuias.map((guia: any) => (

              <div
                key={guia.id}
                className="bg-white rounded-2xl border shadow-sm overflow-hidden"
                style={{
                  borderColor: `${cor}35`
                }}
              >

                <div className="p-4">

                  <div className="flex items-start gap-3">

                    {/* ÍCONE */}

                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `${cor}15`,
                        color: cor
                      }}
                    >
                      <BookOpen size={20} />
                    </div>

                    {/* TEXTO */}

                    <div className="flex-1 min-w-0">

                      <div className="flex items-start justify-between gap-2">

                        <div>

                          <p
                            className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: cor }}
                          >
                            Novo guia
                          </p>

                          <h2 className="font-bold text-gray-900 text-sm mt-0.5">
                            {guia.titulo}
                          </h2>

                        </div>

                        <button
                          onClick={() =>
                            ignorarGuia(guia)
                          }
                          className="p-1 rounded-lg text-gray-300 hover:text-gray-500"
                          title="Fechar aviso"
                        >
                          <X size={16} />
                        </button>

                      </div>

                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {guia.conteudo}
                      </p>

                      <div className="flex items-center justify-between mt-3">

                        <span className="text-[10px] text-gray-400">
                          {guia.updated_at &&
                          guia.created_at &&
                          new Date(
                            guia.updated_at
                          ).getTime() >
                          new Date(
                            guia.created_at
                          ).getTime()
                            ? 'Guia atualizado'
                            : 'Novo procedimento'}
                        </span>

                        <button
                          onClick={() =>
                            abrirGuia(guia)
                          }
                          disabled={fechandoGuia}
                          className="flex items-center gap-1 text-xs font-bold"
                          style={{
                            color: cor
                          }}
                        >
                          Ver guia
                          <ChevronRight size={15} />
                        </button>

                      </div>

                    </div>

                  </div>

                </div>

              </div>

            ))}

          </div>
        )}


        {/* ==========================================================
            AVISOS DE AGENDAMENTO
        ========================================================== */}

        {aguardandoConfirmacao > 0 && (
          <div
            onClick={() =>
              router.push('/salao/notificacoes')
            }
            className="bg-amber-50 border border-amber-200/60 p-4 rounded-2xl flex items-center justify-between cursor-pointer shadow-sm"
          >

            <div className="flex items-center gap-3">

              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <Bell size={18} />
              </div>

              <div>

                <p className="text-xs font-bold text-amber-900">
                  {aguardandoConfirmacao}{' '}
                  atendimento(s)
                  aguardando confirmação
                </p>

                <p className="text-[11px] text-amber-700">
                  Toque para gerenciar os avisos
                </p>

              </div>

            </div>

          </div>
        )}


        {/* ==========================================================
            RESUMO DO DIA
        ========================================================== */}

        <div className="grid grid-cols-2 gap-3">

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">

            <p className="text-xs text-gray-400 font-medium">
              Atendimentos hoje
            </p>

            <p className="text-2xl font-bold text-gray-900 mt-1">
              {atendimentosHoje}
            </p>

          </div>


          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">

            <p className="text-xs text-gray-400 font-medium">
              Confirmados
            </p>

            <p
              className="text-2xl font-bold mt-1"
              style={{ color: cor }}
            >
              {confirmadosHoje}
            </p>

          </div>

        </div>


        {/* ==========================================================
            AGENDA DE HOJE
        ========================================================== */}

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">

          <div className="flex items-center justify-between">

            <h2 className="text-sm font-bold text-gray-900">
              Agenda de Hoje
            </h2>

            <button
              onClick={() =>
                router.push('/funcionario/agenda')
              }
              className="text-xs font-semibold"
              style={{ color: cor }}
            >
              Ver completa
            </button>

          </div>

          <div className="py-6 text-center flex flex-col items-center justify-center gap-2">

            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400">
              <Calendar size={22} />
            </div>

            <p className="text-xs text-gray-400">
              Nenhum agendamento para este horário
            </p>

            <button
              onClick={() =>
                router.push('/funcionario/agenda')
              }
              className="mt-2 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm"
              style={{
                backgroundColor: cor
              }}
            >
              + Ver Agenda
            </button>

          </div>

        </div>

      </div>

      <BottomNav
        items={navItems}
        corPrimaria={cor}
      />

    </div>
  )
}