'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'

import {
  Calendar,
  Scissors,
  Package,
  ClipboardList,
  Star,
  Clock,
  LogOut,
  Bell,
  Heart,
  ChevronRight,
  Sparkles,
  FileText,
  Wallet,
  X
} from 'lucide-react'

import {
  registrarPush,
  verificarPushAtivo,
  obterPermissaoPush,
  verificarSuportePush
} from '@/lib/push-client'

export default function ClientePage() {

  const {
    profile,
    loading,
    signOut
  } = useAuth()

  const router = useRouter()

  const [salao, setSalao] =
    useState<any>(null)

  const [cliente, setCliente] =
    useState<any>(null)

  const [agendamentos, setAgendamentos] =
    useState<any[]>([])

  const [pacotesAtivos, setPacotesAtivos] =
    useState(0)

  const [notifCount, setNotifCount] =
    useState(0)

  const [contratosCount, setContratosCount] =
    useState(0)

  const [contasCount, setContasCount] =
    useState(0)

  const [modalPushLembrete, setModalPushLembrete] =
    useState(false)

  const [ativandoPush, setAtivandoPush] =
    useState(false)

  const [erroPush, setErroPush] =
    useState('')

  const [carregandoDados, setCarregandoDados] =
    useState(true)

  // ============================================================
  // AUTH
  // ============================================================

  useEffect(() => {

    if (!loading && !profile) {
      router.push('/login')
      return
    }

    if (profile) {
      carregarDados()
    }

  }, [loading, profile])

  // ============================================================
  // VERIFICAR PUSH
  // ============================================================

  async function verificarStatusPush() {

    if (!profile?.id) {
      return
    }

    try {

      console.log(
        '[CLIENTE] ================================='
      )

      console.log(
        '[CLIENTE] Verificando Push da página do cliente'
      )

      const suporte =
        verificarSuportePush()

      const permissao =
        obterPermissaoPush()

      console.log(
        '[CLIENTE] Suporte:',
        suporte
      )

      console.log(
        '[CLIENTE] Permissão:',
        permissao
      )

      if (!suporte) {

        console.log(
          '[CLIENTE] Este navegador não suporta Push'
        )

        setModalPushLembrete(false)

        return
      }

      const pushAtivo =
        await verificarPushAtivo(
          profile.id
        )

      console.log(
        '[CLIENTE] Push ativo neste dispositivo:',
        pushAtivo
      )

      if (pushAtivo) {

        setModalPushLembrete(false)
        setErroPush('')

      } else {

        setModalPushLembrete(true)

      }

      console.log(
        '[CLIENTE] ================================='
      )

    } catch (error) {

      console.error(
        '[CLIENTE] Erro ao verificar Push:',
        error
      )

      setModalPushLembrete(true)
    }
  }

  // ============================================================
  // CARREGAR DADOS
  // ============================================================

  async function carregarDados() {

    if (!profile) return

    setCarregandoDados(true)

    try {

      // ========================================================
      // CLIENTE
      // ========================================================

      const {
        data: cli,
        error: errCli
      } = await supabase
        .from('clientes')
        .select('*, saloes(*)')
        .eq(
          'profile_id',
          profile.id
        )
        .maybeSingle()

      if (errCli) {

        console.error(
          'Erro ao buscar cliente:',
          errCli.message
        )
      }

      setCliente(cli)

      // ========================================================
      // SALÃO
      // ========================================================

      let salaoEncontrado =
        cli?.saloes

      if (
        !salaoEncontrado &&
        profile.salao_id
      ) {

        const {
          data: sal
        } = await supabase
          .from('saloes')
          .select('*')
          .eq(
            'id',
            profile.salao_id
          )
          .maybeSingle()

        salaoEncontrado = sal
      }

      setSalao(
        salaoEncontrado
      )

      // ========================================================
      // DADOS DEPENDENTES DO CLIENTE
      // ========================================================

      if (cli?.id) {

        // ======================================================
        // AGENDAMENTOS
        // ======================================================

        try {

          const {
            data: ags,
            error: erroAgendamentos
          } = await supabase
            .from('agendamentos')
            .select(
              '*, servicos(nome, preco), profiles!agendamentos_profissional_id_fkey(nome)'
            )
            .eq(
              'cliente_id',
              cli.id
            )
            .order(
              'data_hora',
              {
                ascending: false
              }
            )
            .limit(10)

          if (erroAgendamentos) {

            console.error(
              '[CLIENTE] Erro ao buscar agendamentos:',
              erroAgendamentos
            )

          }

          setAgendamentos(
            ags || []
          )

        } catch (error) {

          console.error(
            '[CLIENTE] Erro nos agendamentos:',
            error
          )

          setAgendamentos([])
        }

        // ======================================================
        // PACOTES
        //
        // A estrutura atual do sistema usa:
        // pacotes_clientes_resumo
        //
        // O vínculo é feito pelo nome do cliente.
        // ======================================================

        try {

          const {
            data: pacotesCliente,
            error: erroPacotes
          } = await supabase
            .from('pacotes_clientes_resumo')
            .select(
              'id, cliente_nome, servico, sessoes_total, sessoes_restantes, status'
            )
            .eq(
              'cliente_nome',
              cli.nome
            )

          if (erroPacotes) {

            console.error(
              '[CLIENTE] Erro ao buscar pacotes:',
              erroPacotes
            )

            setPacotesAtivos(0)

          } else {

            const ativos =
              (pacotesCliente || []).filter(
                (p: any) =>
                  p.status === 'ativo'
              )

            console.log(
              '[CLIENTE] Pacotes encontrados:',
              pacotesCliente?.length || 0
            )

            console.log(
              '[CLIENTE] Pacotes ativos:',
              ativos.length
            )

            setPacotesAtivos(
              ativos.length
            )
          }

        } catch (error) {

          console.error(
            '[CLIENTE] Erro ao carregar pacotes:',
            error
          )

          setPacotesAtivos(0)
        }

        // ======================================================
        // NOTIFICAÇÕES
        // ======================================================

        try {

          const {
            count: notifs,
            error: erroNotificacoes
          } = await supabase
            .from('notificacoes')
            .select(
              '*',
              {
                count: 'exact',
                head: true
              }
            )
            .eq(
              'destinatario_id',
              profile.id
            )
            .eq(
              'lida',
              false
            )

          if (erroNotificacoes) {

            console.error(
              '[CLIENTE] Erro ao buscar notificações:',
              erroNotificacoes
            )

          }

          setNotifCount(
            notifs || 0
          )

        } catch {

          setNotifCount(0)
        }

        // ======================================================
        // CONTRATOS
        // ======================================================

        try {

          const {
            count: contratos,
            error: erroContratos
          } = await supabase
            .from('contratos')
            .select(
              '*',
              {
                count: 'exact',
                head: true
              }
            )
            .eq(
              'cliente_id',
              cli.id
            )

          if (erroContratos) {

            console.error(
              '[CLIENTE] Erro ao buscar contratos:',
              erroContratos
            )

          }

          setContratosCount(
            contratos || 0
          )

        } catch {

          setContratosCount(0)
        }

        // ======================================================
        // CONTAS
        // ======================================================

        try {

          const {
            count: contas,
            error: erroContas
          } = await supabase
            .from('contas_clientes')
            .select(
              '*',
              {
                count: 'exact',
                head: true
              }
            )
            .eq(
              'cliente_id',
              cli.id
            )

          if (erroContas) {

            console.error(
              '[CLIENTE] Erro ao buscar contas:',
              erroContas
            )

          }

          setContasCount(
            contas || 0
          )

        } catch {

          setContasCount(0)
        }

        // ======================================================
        // PUSH
        // ======================================================

        await verificarStatusPush()
      }

    } catch (err) {

      console.error(
        'Erro geral no carregamento:',
        err
      )

    } finally {

      setCarregandoDados(false)
    }
  }

  // ============================================================
  // ATIVAR PUSH AGORA
  // ============================================================

  async function ativarPushAgora() {

    if (!profile?.id) {

      setErroPush(
        'Não foi possível identificar sua conta.'
      )

      return
    }

    if (ativandoPush) {
      return
    }

    setAtivandoPush(true)
    setErroPush('')

    try {

      console.log(
        '[CLIENTE] ================================='
      )

      console.log(
        '[CLIENTE] Iniciando ativação do Push'
      )

      // ========================================================
      // SUPORTE
      // ========================================================

      if (!verificarSuportePush()) {

        setErroPush(
          'Este navegador ou dispositivo não oferece suporte a notificações Push.'
        )

        return
      }

      // ========================================================
      // PERMISSÃO ANTES
      // ========================================================

      let permissao =
        obterPermissaoPush()

      console.log(
        '[CLIENTE] Permissão antes:',
        permissao
      )

      // ========================================================
      // SE BLOQUEADO
      // ========================================================

      if (permissao === 'denied') {

        setErroPush(
          'As notificações estão bloqueadas neste dispositivo. Ative as notificações do Organiza Salão nas configurações do navegador/iPhone e depois tente novamente.'
        )

        return
      }

      // ========================================================
      // REGISTRAR PUSH
      // ========================================================

      const resultado =
        await registrarPush(
          profile.id
        )

      console.log(
        '[CLIENTE] Resultado da ativação:',
        resultado
      )

      // ========================================================
      // SUCESSO
      // ========================================================

      if (resultado) {

        setErroPush('')

        const ativo =
          await verificarPushAtivo(
            profile.id
          )

        console.log(
          '[CLIENTE] Push confirmado:',
          ativo
        )

        if (ativo) {

          setModalPushLembrete(false)

          return
        }

        setErroPush(
          'A permissão foi concedida, mas não conseguimos confirmar a inscrição deste dispositivo. Tente novamente.'
        )

        return
      }

      // ========================================================
      // VERIFICAR PERMISSÃO DEPOIS
      // ========================================================

      permissao =
        obterPermissaoPush()

      console.log(
        '[CLIENTE] Permissão depois:',
        permissao
      )

      if (permissao === 'denied') {

        setErroPush(
          'As notificações foram bloqueadas. Para ativá-las, permita as notificações do Organiza Salão nas configurações do navegador/iPhone.'
        )

        return
      }

      if (permissao === 'default') {

        setErroPush(
          'A permissão para notificações ainda não foi concedida. Toque novamente em "Ativar notificações".'
        )

        return
      }

      setErroPush(
        'Não foi possível ativar as notificações. Verifique as permissões do navegador e tente novamente.'
      )

    } catch (err: any) {

      console.error(
        '[CLIENTE] Erro ao ativar Push:',
        err
      )

      console.error(
        '[CLIENTE] Mensagem:',
        err?.message
      )

      setErroPush(
        'Ocorreu um erro ao ativar as notificações. Tente novamente.'
      )

    } finally {

      setAtivandoPush(false)

      console.log(
        '[CLIENTE] ================================='
      )
    }
  }

  // ============================================================
  // CORES / CONFIGURAÇÕES
  // ============================================================

  const cor =
    salao?.cor_primaria ||
    '#E91E8C'

  const partes =
    salao?.nome?.split(' - ')

  const nomePrincipal =
    partes?.[0] ||
    'Espaço de Beleza'

  const nomeSecundario =
    partes?.[1]

  const mostrarPacotes =
    salao?.mostrar_pacotes !== false

  const mostrarQuestionarios =
    salao?.mostrar_questionarios !== false

  const mostrarAvaliacoes =
    salao?.mostrar_avaliacoes !== false

  const mostrarQuemSomos =
    salao?.mostrar_quem_somos !== false

  // ============================================================
  // AGENDAMENTOS
  // ============================================================

  const proximos =
    agendamentos.filter(
      a =>
        new Date(a.data_hora) >=
          new Date() &&
        a.status !== 'cancelado'
    )

  const historico =
    agendamentos.filter(
      a =>
        new Date(a.data_hora) <
          new Date() &&
        a.status === 'concluido'
    )

  const hora =
    new Date().getHours()

  const saudacao =
    hora < 12
      ? 'Bom dia'
      : hora < 18
        ? 'Boa tarde'
        : 'Boa noite'

  // ============================================================
  // MENU
  // ============================================================

  const menuItems = [

    {
      icon: Calendar,
      label: 'Agendamentos',
      sub: 'Meus horários',
      href: '/cliente/agendamentos',
      badge:
        proximos.length > 0
          ? proximos.length
          : null
    },

    {
      icon: Scissors,
      label: 'Serviços',
      sub: 'Valores e opções',
      href: '/cliente/servicos',
      badge: null
    },

    mostrarPacotes
      ? {
          icon: Package,
          label: 'Meus pacotes',
          sub: 'Datas e sessões',
          href: '/cliente/pacotes',
          badge:
            pacotesAtivos > 0
              ? pacotesAtivos
              : null
        }
      : null,

    // ========================================================
    // MINHA EVOLUÇÃO
    // ========================================================

    {
      icon: Sparkles,
      label: 'Minha evolução',
      sub: 'Acompanhe seus procedimentos',
      href: '/cliente/evolucao',
      badge: null
    },

    mostrarQuestionarios
      ? {
          icon: ClipboardList,
          label: 'Questionários',
          sub: 'Dados de saúde',
          href: '/cliente/anamnese',
          badge: null
        }
      : null,

    {
      icon: Clock,
      label: 'Horários',
      sub: 'Vagas e funcionamento',
      href: '/cliente/horarios',
      badge: null
    }

  ].filter(Boolean) as any[]

  // ============================================================
  // LOADING
  // ============================================================

  if (loading && !profile) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">

        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />

      </div>
    )
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (

    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#f0f0f5'
      }}
    >

      <link
        href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap"
        rel="stylesheet"
      />

      {/* ====================================================== */}
      {/* CABEÇALHO */}
      {/* ====================================================== */}

      <div
        className="relative overflow-hidden"
        style={{
          backgroundColor: cor,
          minHeight: 240
        }}
      >

        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10 bg-white" />

        <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full opacity-10 bg-white" />

        <div className="absolute top-20 right-8 w-16 h-16 rounded-full opacity-10 bg-white" />

        <div className="relative flex items-center justify-between px-5 pt-12 pb-2">

          <div>

            <p className="text-white/70 text-sm font-medium tracking-wide">
              {saudacao} ✨
            </p>

            <h1 className="text-white text-3xl font-bold mt-0.5 leading-tight">
              {profile?.nome?.split(' ')[0] || 'Cliente'}!
            </h1>

          </div>

          <div className="flex items-center gap-2">

            <button
              onClick={() =>
                router.push(
                  '/cliente/notificacoes'
                )
              }
              className="relative w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center"
            >

              <Bell
                size={18}
                className="text-white"
              />

              {notifCount > 0 && (

                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-400 text-white text-[10px] flex items-center justify-center font-bold border-2 border-white">

                  {notifCount}

                </span>
              )}

            </button>

            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-base">

              {profile?.nome
                ?.charAt(0)
                .toUpperCase() || 'C'}

            </div>

          </div>

        </div>

        <div className="relative px-5 pb-8 mt-3">

          <p className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-medium mb-1">
            Bem-vinda ao ambiente
          </p>

          <p
            className="text-white leading-tight"
            style={{
              fontFamily:
                "'Dancing Script', cursive",
              fontSize: '2rem',
              fontWeight: 700,
              textShadow:
                '0 2px 12px rgba(0,0,0,0.15)',
              lineHeight: 1.2
            }}
          >
            {nomePrincipal}
          </p>

          {nomeSecundario && (

            <p className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-medium mt-2">
              {nomeSecundario}
            </p>

          )}

          {salao?.descricao && (

            <p className="text-white/60 text-[10px] uppercase tracking-[0.15em] font-medium mt-2">
              {salao.descricao}
            </p>

          )}

        </div>

      </div>

      {/* ====================================================== */}
      {/* PRÓXIMO AGENDAMENTO */}
      {/* ====================================================== */}

      {proximos.length > 0 && (

        <div className="px-4 -mt-5 relative z-10 mb-3">

          <button
            onClick={() =>
              router.push(
                '/cliente/agendamentos'
              )
            }
            className="w-full bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-md active:scale-[0.98] transition-all text-left"
          >

            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${cor}18`
              }}
            >

              <Clock
                size={18}
                style={{
                  color: cor
                }}
              />

            </div>

            <div className="flex-1 min-w-0">

              <p className="text-xs text-gray-400 font-medium">
                Próximo agendamento
              </p>

              <p className="text-sm font-bold text-gray-900 truncate">
                {proximos[0].servicos?.nome}
              </p>

              <p className="text-xs text-gray-400 mt-0.5">

                {new Date(
                  proximos[0].data_hora
                ).toLocaleDateString(
                  'pt-BR',
                  {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                  }
                )}

                {' · '}

                {new Date(
                  proximos[0].data_hora
                ).toLocaleTimeString(
                  'pt-BR',
                  {
                    hour: '2-digit',
                    minute: '2-digit'
                  }
                )}

              </p>

            </div>

            <ChevronRight
              size={16}
              className="text-gray-300 shrink-0"
            />

          </button>

        </div>
      )}

      {/* ====================================================== */}
      {/* CONTEÚDO */}
      {/* ====================================================== */}

      <div
        className="px-4 flex flex-col gap-4 pb-10"
        style={{
          marginTop:
            proximos.length > 0
              ? 0
              : -20
        }}
      >

        {proximos.length === 0 && (
          <div className="h-5" />
        )}

        {/* ==================================================== */}
        {/* MENU */}
        {/* ==================================================== */}

        <div className="grid grid-cols-2 gap-3">

          {menuItems.map(
            ({
              icon: Icon,
              label,
              sub,
              href,
              badge
            }: any) => (

              <button
                key={href}
                onClick={() =>
                  router.push(href)
                }
                className="bg-white rounded-3xl p-4 flex flex-col gap-3 active:scale-95 transition-all shadow-sm text-left relative overflow-hidden"
              >

                <div
                  className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-5"
                  style={{
                    backgroundColor: cor
                  }}
                />

                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${cor}15`
                  }}
                >

                  <Icon
                    size={20}
                    style={{
                      color: cor
                    }}
                  />

                </div>

                <div>

                  <p className="font-bold text-gray-900 text-sm leading-tight">
                    {label}
                  </p>

                  <p className="text-gray-400 text-xs mt-0.5 leading-tight">
                    {sub}
                  </p>

                </div>

                {badge && (

                  <div
                    className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      backgroundColor: cor
                    }}
                  >
                    {badge}
                  </div>
                )}

              </button>
            )
          )}

        </div>

        {/* ==================================================== */}
        {/* QUEM SOMOS */}
        {/* ==================================================== */}

        {mostrarQuemSomos && (

          <button
            onClick={() =>
              router.push(
                '/cliente/quem-somos'
              )
            }
            className="bg-white rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-all text-left"
          >

            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${cor}15`
              }}
            >

              <Heart
                size={20}
                style={{
                  color: cor
                }}
              />

            </div>

            <div className="flex-1">

              <p className="font-bold text-gray-900 text-sm">
                {salao?.titulo_quem_somos ||
                  'Quem somos'}
              </p>

              <p className="text-gray-400 text-xs mt-0.5">
                Nossa história e valores
              </p>

            </div>

            <ChevronRight
              size={16}
              className="text-gray-300 shrink-0"
            />

          </button>
        )}

        {/* ==================================================== */}
        {/* CONTRATOS */}
        {/* ==================================================== */}

        {contratosCount > 0 && (

          <button
            onClick={() =>
              router.push(
                '/cliente/contratos'
              )
            }
            className="bg-white rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-all text-left"
          >

            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${cor}15`
              }}
            >

              <FileText
                size={20}
                style={{
                  color: cor
                }}
              />

            </div>

            <div className="flex-1">

              <p className="font-bold text-gray-900 text-sm">
                Contratos e termos
              </p>

              <p className="text-gray-400 text-xs mt-0.5">
                Documentos para assinar
              </p>

            </div>

            <ChevronRight
              size={16}
              className="text-gray-300 shrink-0"
            />

          </button>
        )}

        {/* ==================================================== */}
        {/* CONTAS */}
        {/* ==================================================== */}

        {contasCount > 0 && (

          <button
            onClick={() =>
              router.push(
                '/cliente/contas'
              )
            }
            className="bg-white rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-all text-left"
          >

            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${cor}15`
              }}
            >

              <Wallet
                size={20}
                style={{
                  color: cor
                }}
              />

            </div>

            <div className="flex-1">

              <p className="font-bold text-gray-900 text-sm">
                Minhas Contas
              </p>

              <p className="text-gray-400 text-xs mt-0.5">
                Débitos e créditos com o salão
              </p>

            </div>

            <ChevronRight
              size={16}
              className="text-gray-300 shrink-0"
            />

          </button>
        )}

        {/* ==================================================== */}
        {/* HISTÓRICO */}
        {/* ==================================================== */}

        {historico.length > 0 && (

          <div>

            <div className="flex items-center justify-between mb-3">

              <p className="font-bold text-gray-900 text-sm">
                Últimas visitas
              </p>

              <button
                onClick={() =>
                  router.push(
                    '/cliente/agendamentos'
                  )
                }
                className="text-xs font-semibold"
                style={{
                  color: cor
                }}
              >
                Ver todas
              </button>

            </div>

            <div className="flex flex-col gap-2">

              {historico
                .slice(0, 3)
                .map((ag: any) => (

                  <div
                    key={ag.id}
                    className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm"
                  >

                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${cor}12`
                      }}
                    >

                      <Scissors
                        size={16}
                        style={{
                          color: cor
                        }}
                      />

                    </div>

                    <div className="flex-1 min-w-0">

                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {ag.servicos?.nome}
                      </p>

                      <p className="text-xs text-gray-400">

                        {new Date(
                          ag.data_hora
                        ).toLocaleDateString(
                          'pt-BR',
                          {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }
                        )}

                      </p>

                    </div>

                    {ag.valor && (

                      <p
                        className="text-sm font-bold shrink-0"
                        style={{
                          color: cor
                        }}
                      >
                        R$ {Number(
                          ag.valor
                        )
                          .toFixed(2)
                          .replace('.', ',')}
                      </p>
                    )}

                  </div>
                ))}

            </div>

          </div>
        )}

        {/* ==================================================== */}
        {/* AVALIAÇÃO */}
        {/* ==================================================== */}

        {mostrarAvaliacoes && (

          <button
            onClick={() =>
              router.push(
                '/cliente/avaliacoes'
              )
            }
            className="relative overflow-hidden rounded-3xl px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-all text-left"
            style={{
              background:
                `linear-gradient(135deg, ${cor} 0%, ${cor}bb 100%)`
            }}
          >

            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />

            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">

              <Star
                size={20}
                className="text-white"
              />

            </div>

            <div className="flex-1">

              <p className="font-bold text-white text-sm">
                Deixe sua avaliação
              </p>

              <p className="text-white/70 text-xs mt-0.5">
                Compartilhe sua experiência ✨
              </p>

            </div>

            <Sparkles
              size={18}
              className="text-white/60 shrink-0"
            />

          </button>
        )}

        {/* ==================================================== */}
        {/* SAIR */}
        {/* ==================================================== */}

        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 text-gray-400 text-sm py-2"
        >

          <LogOut size={15} />

          Sair da conta

        </button>

      </div>

      {/* ====================================================== */}
      {/* MODAL PUSH */}
      {/* ====================================================== */}

      {modalPushLembrete && (

        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end">

          <div className="bg-white w-full rounded-t-3xl overflow-hidden flex flex-col">

            <div
              className="relative px-6 pt-8 pb-9 overflow-hidden shrink-0"
              style={{
                background:
                  `linear-gradient(135deg, ${cor}, ${cor}bb)`
              }}
            >

              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 bg-white" />

              <button
                onClick={() =>
                  setModalPushLembrete(false)
                }
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
              >

                <X
                  size={16}
                  className="text-white"
                />

              </button>

              <div className="relative flex flex-col items-center text-center gap-3 pt-2">

                <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center">

                  <Bell
                    size={30}
                    className="text-white"
                  />

                </div>

                <h3 className="text-white font-bold text-xl leading-snug px-4">

                  Ative suas notificações!

                </h3>

                <p className="text-white/80 text-sm px-6 leading-relaxed">

                  Sem elas, você pode perder avisos de horários confirmados, lembretes de agendamento e novidades do salão.

                </p>

              </div>

            </div>

            <div className="px-6 py-6 flex flex-col gap-3">

              {erroPush && (

                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">

                  <p className="text-red-600 text-sm">

                    {erroPush}

                  </p>

                </div>
              )}

              {/* ================================================= */}
              {/* BOTÃO ATIVAR */}
              {/* ================================================= */}

              <button
                onClick={ativarPushAgora}
                disabled={ativandoPush}
                className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{
                  backgroundColor: cor
                }}
              >

                {ativandoPush ? (

                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />

                ) : (

                  <>
                    <Bell size={16} />

                    {obterPermissaoPush() === 'denied'
                      ? 'Ver como ativar notificações'
                      : 'Ativar notificações agora'}
                  </>

                )}

              </button>

              {/* ================================================= */}
              {/* AGORA NÃO */}
              {/* ================================================= */}

              <button
                onClick={() =>
                  setModalPushLembrete(false)
                }
                className="w-full py-3 text-gray-400 text-sm font-medium"
              >

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}