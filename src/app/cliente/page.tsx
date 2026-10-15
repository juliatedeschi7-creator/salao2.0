'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  X,
  Phone,
  Save,
  RefreshCw
} from 'lucide-react'

import {
  registrarPush,
  verificarPushAtivo,
  verificarPushVinculadoAConta,
  vincularPushAConta,
  verificarPushDesativadoParaConta,
  obterPermissaoPush,
  verificarSuportePush,
  obterUltimoErroPush
} from '@/lib/push-client'

const TEMPO_LIMITE = 12000

function comTempoLimite<T>(
  operacao: PromiseLike<T>,
  mensagem = 'A operação demorou mais do que o esperado.'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const temporizador = setTimeout(
      () => reject(new Error(mensagem)),
      TEMPO_LIMITE
    )

    Promise.resolve(operacao).then(
      resultado => {
        clearTimeout(temporizador)
        resolve(resultado)
      },
      erro => {
        clearTimeout(temporizador)
        reject(erro)
      }
    )
  })
}

function formatarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, '').slice(0, 11)

  if (numeros.length <= 2) {
    return numeros.length ? `(${numeros}` : ''
  }

  if (numeros.length <= 6) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`
  }

  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`
}

function telefoneValido(valor: string) {
  const numeros = valor.replace(/\D/g, '')
  return numeros.length === 10 || numeros.length === 11
}

export default function ClientePage() {
  const { profile, loading, signOut } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [pacotesAtivos, setPacotesAtivos] = useState(0)
  const [notifCount, setNotifCount] = useState(0)
  const [contratosCount, setContratosCount] = useState(0)
  const [contasCount, setContasCount] = useState(0)

  const [modalPushLembrete, setModalPushLembrete] = useState(false)
  const [ativandoPush, setAtivandoPush] = useState(false)
  const [erroPush, setErroPush] = useState('')
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState('')

  const [pushAtivoConta, setPushAtivoConta] = useState(false)
  const [verificandoPush, setVerificandoPush] = useState(true)
  const [testandoPush, setTestandoPush] = useState(false)
  const [resultadoTestePush, setResultadoTestePush] = useState('')
  const [tentativaPush, setTentativaPush] = useState(0)

  const [telefone, setTelefone] = useState('')
  const [salvandoTelefone, setSalvandoTelefone] = useState(false)
  const [erroTelefone, setErroTelefone] = useState('')
  const [sucessoTelefone, setSucessoTelefone] = useState(false)

  // Identificadores impedem que operações antigas alterem uma sessão nova.
  const requisicaoDados = useRef(0)
  const requisicaoPush = useRef(0)
  const requisicaoTelefone = useRef(0)

  const precisaTelefone =
    !!cliente && !cliente.telefone?.replace(/\D/g, '')

  // ============================================================
  // AUTENTICAÇÃO
  // ============================================================

  useEffect(() => {
    if (!loading && !profile) {
      router.replace('/login')
    }
  }, [loading, profile?.id, router])

  // ============================================================
  // CONTADOR DE NOTIFICAÇÕES
  // ============================================================

  const carregarContadorNotificacoes = useCallback(async () => {
    if (!profile?.id) return

    const idConta = profile.id

    try {
      const { count, error } = await comTempoLimite(
        supabase
          .from('notificacoes')
          .select('*', { count: 'exact', head: true })
          .eq('destinatario_id', idConta)
          .eq('lida', false)
      )

      if (profile.id !== idConta) return

      if (error) {
        console.error(
          '[CLIENTE] Erro ao atualizar contador:',
          error
        )
        return
      }

      setNotifCount(count || 0)
    } catch (error) {
      console.error(
        '[CLIENTE] Erro ao carregar contador:',
        error
      )
    }
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return

    const idConta = profile.id

    const channel = supabase
      .channel(`cliente-notificacoes-${idConta}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
          filter: `destinatario_id=eq.${idConta}`
        },
        () => {
          if (profile?.id === idConta) {
            void carregarContadorNotificacoes()
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profile?.id, carregarContadorNotificacoes])

  // ============================================================
  // CARREGAMENTO PRINCIPAL
  // O painel NÃO espera a verificação do Push.
  // ============================================================

  const carregarDados = useCallback(async () => {
    if (!profile?.id) return

    const idConta = profile.id
    const idRequisicao = ++requisicaoDados.current

    const requisicaoAtual = () =>
      requisicaoDados.current === idRequisicao &&
      profile?.id === idConta

    setCarregandoDados(true)
    setErroCarregamento('')

    // Limpa os dados da sessão anterior.
    setCliente(null)
    setSalao(null)
    setAgendamentos([])
    setPacotesAtivos(0)
    setContratosCount(0)
    setContasCount(0)
    setTelefone('')
    setErroTelefone('')
    setSucessoTelefone(false)

    try {
      const { data: cli, error: errCli } = await comTempoLimite(
        supabase
          .from('clientes')
          .select('*, saloes(*)')
          .eq('profile_id', idConta)
          .maybeSingle(),
        'Não foi possível carregar seu cadastro. Verifique sua conexão e tente novamente.'
      )

      if (!requisicaoAtual()) return

      if (errCli) {
        console.error('[CLIENTE] Erro ao buscar cliente:', errCli)
        throw new Error(
          'Não foi possível consultar seu cadastro. Tente novamente.'
        )
      }

      setCliente(cli)
      setTelefone(cli?.telefone ? formatarTelefone(cli.telefone) : '')

      let salaoEncontrado = cli?.saloes || null

      if (!salaoEncontrado && profile.salao_id) {
        const { data: sal, error: erroSalao } = await comTempoLimite(
          supabase
            .from('saloes')
            .select('*')
            .eq('id', profile.salao_id)
            .maybeSingle()
        )

        if (!requisicaoAtual()) return

        if (erroSalao) {
          console.error(
            '[CLIENTE] Erro ao buscar salão:',
            erroSalao
          )
        } else {
          salaoEncontrado = sal
        }
      }

      if (!requisicaoAtual()) return

      setSalao(salaoEncontrado)

      // Se ainda não existe registro em clientes, não presumimos
      // que ele deva ser criado automaticamente.
      if (!cli?.id) {
        setErroCarregamento(
          'Não encontramos um cadastro de cliente vinculado a esta conta. Seus dados não foram alterados. Entre em contato com o salão para verificar seu cadastro.'
        )
        return
      }

      const tarefas = await Promise.allSettled([
        comTempoLimite(
          supabase
            .from('agendamentos')
            .select(
              '*, servicos(nome, preco), profiles!agendamentos_profissional_id_fkey(nome)'
            )
            .eq('cliente_id', cli.id)
            .order('data_hora', { ascending: false })
            .limit(10)
        ),

        comTempoLimite(
          supabase
            .from('pacotes_clientes_resumo')
            .select(
              'id, cliente_nome, servico, sessoes_total, sessoes_restantes, status'
            )
            .eq('cliente_nome', cli.nome)
        ),

        comTempoLimite(
          supabase
            .from('contratos')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', cli.id)
        ),

        comTempoLimite(
          supabase
            .from('contas_clientes')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', cli.id)
        ),

        comTempoLimite(
          supabase
            .from('notificacoes')
            .select('*', { count: 'exact', head: true })
            .eq('destinatario_id', idConta)
            .eq('lida', false)
        )
      ])

      if (!requisicaoAtual()) return

      const [ags, pacotes, contratos, contas, notificacoes] = tarefas

      if (ags.status === 'fulfilled' && !ags.value.error) {
        setAgendamentos(ags.value.data || [])
      } else {
        console.error(
          '[CLIENTE] Não foi possível carregar agendamentos:',
          ags.status === 'rejected'
            ? ags.reason
            : ags.value.error
        )
        setAgendamentos([])
      }

      if (pacotes.status === 'fulfilled' && !pacotes.value.error) {
        setPacotesAtivos(
          (pacotes.value.data || []).filter(
            (p: any) => p.status === 'ativo'
          ).length
        )
      } else {
        console.error(
          '[CLIENTE] Não foi possível carregar pacotes:',
          pacotes.status === 'rejected'
            ? pacotes.reason
            : pacotes.value.error
        )
        setPacotesAtivos(0)
      }

      if (
        contratos.status === 'fulfilled' &&
        !contratos.value.error
      ) {
        setContratosCount(contratos.value.count || 0)
      } else {
        setContratosCount(0)
      }

      if (contas.status === 'fulfilled' && !contas.value.error) {
        setContasCount(contas.value.count || 0)
      } else {
        setContasCount(0)
      }

      if (
        notificacoes.status === 'fulfilled' &&
        !notificacoes.value.error
      ) {
        setNotifCount(notificacoes.value.count || 0)
      }

    } catch (error: any) {
      if (!requisicaoAtual()) return

      console.error('[CLIENTE] Erro no carregamento:', error)

      setErroCarregamento(
        error?.message ||
          'Não foi possível carregar seus dados. Tente novamente.'
      )
    } finally {
      if (requisicaoAtual()) {
        setCarregandoDados(false)
      }
    }
  }, [profile?.id, profile?.salao_id])

  useEffect(() => {
    if (loading || !profile?.id) return

    void carregarDados()

    return () => {
      // Invalida consultas iniciadas pela sessão anterior.
      requisicaoDados.current += 1
    }
  }, [loading, profile?.id, carregarDados])

  // ============================================================
  // VERIFICAÇÃO DO PUSH EM PARALELO COM O PAINEL
  // ============================================================

  const verificarStatusPush = useCallback(async () => {
    const idConta = profile?.id

    if (!idConta) {
      setVerificandoPush(false)
      return
    }

    const idRequisicao = ++requisicaoPush.current

    const requisicaoAtual = () =>
      requisicaoPush.current === idRequisicao &&
      profile?.id === idConta

    setVerificandoPush(true)
    setErroPush('')

    try {
      const suporte = verificarSuportePush()

      if (!requisicaoAtual()) return

      if (!suporte) {
        setPushAtivoConta(false)
        setModalPushLembrete(false)
        return
      }

      if (verificarPushDesativadoParaConta(idConta)) {
        setPushAtivoConta(false)
        setModalPushLembrete(false)
        return
      }

      const pushAtivo = await comTempoLimite(
        verificarPushAtivo(),
        'A verificação das notificações demorou demais. Você pode tentar novamente.'
      )

      if (!requisicaoAtual()) return

      if (!pushAtivo) {
        setPushAtivoConta(false)
        setModalPushLembrete(true)
        return
      }

      const vinculado = await comTempoLimite(
        verificarPushVinculadoAConta(idConta),
        'Não foi possível confirmar o vínculo das notificações. Tente novamente.'
      )

      if (!requisicaoAtual()) return

      if (vinculado) {
        setPushAtivoConta(true)
        setModalPushLembrete(false)
        return
      }

      if (obterPermissaoPush() === 'granted') {
        const vinculacao = await comTempoLimite(
          vincularPushAConta(idConta),
          'Não foi possível vincular as notificações a esta conta.'
        )

        if (!requisicaoAtual()) return

        if (vinculacao) {
          const confirmado = await comTempoLimite(
            verificarPushVinculadoAConta(idConta),
            'Não foi possível confirmar o vínculo das notificações.'
          )

          if (!requisicaoAtual()) return

          if (confirmado) {
            setPushAtivoConta(true)
            setModalPushLembrete(false)
            return
          }
        }

        setPushAtivoConta(false)
        setErroPush(
          obterUltimoErroPush() ||
            'Não foi possível confirmar o vínculo das notificações com esta conta.'
        )
        setModalPushLembrete(true)
      } else {
        setPushAtivoConta(false)
        setModalPushLembrete(true)
      }
    } catch (error: any) {
      if (!requisicaoAtual()) return

      console.error('[CLIENTE] Erro ao verificar Push:', error)

      setPushAtivoConta(false)
      setErroPush(
        obterUltimoErroPush() ||
          error?.message ||
          'Não foi possível verificar as notificações.'
      )
      setModalPushLembrete(false)
    } finally {
      if (requisicaoAtual()) {
        setVerificandoPush(false)
      }
    }
  }, [profile?.id])

  useEffect(() => {
    if (loading || !profile?.id) return

    void verificarStatusPush()

    return () => {
      // Impede que uma verificação antiga altere a tela.
      requisicaoPush.current += 1
    }
  }, [loading, profile?.id, tentativaPush, verificarStatusPush])

  // ============================================================
  // TESTE DE NOTIFICAÇÃO
  // ============================================================

  async function testarPushCliente() {
    if (!profile?.id) {
      setResultadoTestePush('Não foi possível identificar sua conta.')
      return
    }

    if (testandoPush) return

    setTestandoPush(true)
    setResultadoTestePush('')

    try {
      const resposta = await comTempoLimite(
        fetch('/api/notificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salaoId: profile.salao_id || null,
            remetenteId: profile.id,
            destinatarioId: profile.id,
            titulo: '🔔 Teste de notificação',
            mensagem:
              'Se você recebeu esta mensagem, o Push da sua conta está funcionando corretamente.',
            tipo: 'teste_push_cliente',
            url: '/cliente'
          })
        }),
        'O teste demorou demais. Verifique sua conexão e tente novamente.'
      )

      let resultado: any = null

      try {
        resultado = await resposta.json()
      } catch {
        resultado = null
      }

      if (!resposta.ok) {
        setResultadoTestePush(
          resultado?.erro ||
            `Erro HTTP ${resposta.status} ao testar o Push.`
        )
        return
      }

      if (resultado?.pushEnviado && resultado?.enviados > 0) {
        setResultadoTestePush(
          'Push enviado pelo servidor. Verifique se a notificação apareceu neste dispositivo.'
        )
      } else {
        setResultadoTestePush(
          resultado?.motivo ||
            'O servidor não encontrou uma assinatura ativa para esta conta.'
        )
      }
    } catch (error: any) {
      console.error('[CLIENTE] Erro no teste de Push:', error)
      setResultadoTestePush(
        error?.message || 'Não foi possível realizar o teste de Push.'
      )
    } finally {
      setTestandoPush(false)
    }
  }

  // ============================================================
  // ATUALIZAÇÃO DO TELEFONE
  // ============================================================

  async function salvarTelefone() {
    if (!profile?.id || !cliente?.id) {
      setErroTelefone(
        'Não conseguimos identificar seu cadastro. Saia da conta e entre novamente.'
      )
      return
    }

    if (!telefoneValido(telefone)) {
      setErroTelefone(
        'Informe um telefone válido com DDD. Exemplo: (16) 99999-9999.'
      )
      return
    }

    if (salvandoTelefone) return

    const idConta = profile.id
    const idCliente = cliente.id
    const idRequisicao = ++requisicaoTelefone.current

    const requisicaoAtual = () =>
      requisicaoTelefone.current === idRequisicao &&
      profile?.id === idConta

    setSalvandoTelefone(true)
    setErroTelefone('')
    setSucessoTelefone(false)

    try {
      const telefoneLimpo = telefone.replace(/\D/g, '')

      const { data, error } = await comTempoLimite(
        supabase
          .from('clientes')
          .update({ telefone: telefoneLimpo })
          .eq('id', idCliente)
          .eq('profile_id', idConta)
          .select('id, telefone')
          .maybeSingle(),
        'O salvamento demorou demais. Confira sua conexão e tente novamente.'
      )

      if (!requisicaoAtual()) return

      if (error) {
        console.error('[CLIENTE] Erro ao salvar telefone:', error)
        setErroTelefone(
          'Não foi possível salvar seu telefone. Tente novamente. Se o erro continuar, avise o salão.'
        )
        return
      }

      if (!data) {
        setErroTelefone(
          'O banco de dados não confirmou a atualização. Verifique as permissões de acesso ao cadastro e tente novamente.'
        )
        return
      }

      setCliente((atual: any) =>
        atual?.id === idCliente
          ? { ...atual, telefone: data.telefone }
          : atual
      )

      setTelefone(formatarTelefone(data.telefone))
      setSucessoTelefone(true)
    } catch (error: any) {
      if (!requisicaoAtual()) return

      console.error('[CLIENTE] Erro ao salvar telefone:', error)
      setErroTelefone(
        error?.message ||
          'Ocorreu um erro inesperado ao salvar seu telefone.'
      )
    } finally {
      if (requisicaoAtual()) {
        setSalvandoTelefone(false)
      }
    }
  }

  // ============================================================
  // ATIVAÇÃO DO PUSH
  // ============================================================

  async function ativarPushAgora() {
    if (!profile?.id) {
      setErroPush('Não foi possível identificar sua conta.')
      return
    }

    if (ativandoPush) return

    const idConta = profile.id

    setAtivandoPush(true)
    setErroPush('')

    try {
      if (!verificarSuportePush()) {
        setErroPush(
          'Este navegador ou dispositivo não oferece suporte a notificações Push.'
        )
        return
      }

      let permissao = obterPermissaoPush()

      if (permissao === 'denied') {
        setErroPush(
          'As notificações estão bloqueadas neste dispositivo. Ative as notificações do Organiza Salão nas configurações do navegador/iPhone e depois tente novamente.'
        )
        return
      }

      const resultado = await comTempoLimite(
        registrarPush(idConta),
        'A ativação das notificações demorou demais. Tente novamente.'
      )

      if (profile?.id !== idConta) return

      if (resultado) {
        let vinculado = await comTempoLimite(
          verificarPushVinculadoAConta(idConta)
        )

        if (!vinculado) {
          const vinculacao = await comTempoLimite(
            vincularPushAConta(idConta)
          )

          if (profile?.id !== idConta) return

          if (vinculacao) {
            vinculado = await comTempoLimite(
              verificarPushVinculadoAConta(idConta)
            )
          }
        }

        if (profile?.id !== idConta) return

        if (vinculado) {
          setPushAtivoConta(true)
          setModalPushLembrete(false)
          setErroPush('')
          setVerificandoPush(false)
          return
        }

        setPushAtivoConta(false)
        setErroPush(
          obterUltimoErroPush() ||
            'A permissão foi concedida, mas não conseguimos confirmar o vínculo das notificações com esta conta. Tente novamente.'
        )
        return
      }

      permissao = obterPermissaoPush()

      if (permissao === 'denied') {
        setErroPush(
          'As notificações foram bloqueadas. Para ativá-las, permita as notificações do Organiza Salão nas configurações do navegador/iPhone.'
        )
      } else if (permissao === 'default') {
        setErroPush(
          'A permissão para notificações ainda não foi concedida. Toque novamente em "Ativar notificações".'
        )
      } else {
        setErroPush(
          obterUltimoErroPush() ||
            'Não foi possível ativar as notificações. Verifique as permissões do navegador e tente novamente.'
        )
      }
    } catch (error: any) {
      if (profile?.id !== idConta) return

      console.error('[CLIENTE] Erro ao ativar Push:', error)
      setPushAtivoConta(false)
      setErroPush(
        obterUltimoErroPush() ||
          error?.message ||
          'Ocorreu um erro ao ativar as notificações. Tente novamente.'
      )
    } finally {
      if (profile?.id === idConta) {
        setAtivandoPush(false)
      }
    }
  }

  // ============================================================
  // DADOS DE APRESENTAÇÃO
  // ============================================================

  const cor = salao?.cor_primaria || '#E91E8C'
  const partes = salao?.nome?.split(' - ')
  const nomePrincipal = partes?.[0] || 'Espaço de Beleza'
  const nomeSecundario = partes?.[1]

  const mostrarPacotes = salao?.mostrar_pacotes !== false
  const mostrarQuestionarios = salao?.mostrar_questionarios !== false
  const mostrarAvaliacoes = salao?.mostrar_avaliacoes !== false
  const mostrarQuemSomos = salao?.mostrar_quem_somos !== false

  const proximos = agendamentos.filter(
    a =>
      new Date(a.data_hora) >= new Date() &&
      a.status !== 'cancelado'
  )

  const historico = agendamentos.filter(
    a =>
      new Date(a.data_hora) < new Date() &&
      a.status === 'concluido'
  )

  const hora = new Date().getHours()
  const saudacao =
    hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const menuItems = [
    {
      icon: Calendar,
      label: 'Agendamentos',
      sub: 'Meus horários',
      href: '/cliente/agendamentos',
      badge: proximos.length > 0 ? proximos.length : null
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
          badge: pacotesAtivos > 0 ? pacotesAtivos : null
        }
      : null,
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
  // TELAS DE CARREGAMENTO E RECUPERAÇÃO
  // ============================================================

  if (loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Redirecionando para o login...</div>
      </div>
    )
  }

  if (carregandoDados) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-6">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Carregando sua área da cliente...</p>
      </div>
    )
  }

  if (erroCarregamento) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-gray-50">
        <section className="w-full max-w-md bg-white rounded-3xl p-6 shadow-lg text-center">
          <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center mx-auto mb-4">
            <RefreshCw size={25} className="text-pink-600" />
          </div>

          <h1 className="text-xl font-bold text-gray-900">
            Não conseguimos carregar sua área
          </h1>

          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            {erroCarregamento}
          </p>

          <button
            onClick={() => void carregarDados()}
            className="w-full mt-6 rounded-xl py-3.5 bg-pink-600 text-white font-semibold flex items-center justify-center gap-2"
          >
            <RefreshCw size={17} />
            Tentar novamente
          </button>

          <button
            onClick={() => void signOut()}
            className="w-full py-3 text-sm text-gray-400"
          >
            Sair da conta
          </button>
        </section>
      </main>
    )
  }

  // ============================================================
  // BLOQUEIO DO PAINEL ATÉ INFORMAR O TELEFONE
  // ============================================================

  if (cliente && precisaTelefone) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-5 py-10"
        style={{ backgroundColor: '#f0f0f5' }}
      >
        <section className="w-full max-w-md bg-white rounded-3xl p-6 shadow-lg">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: `${cor}18` }}
          >
            <Phone size={30} style={{ color: cor }} />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 text-center">
            Atualize seu cadastro
          </h1>

          <p className="text-sm text-gray-500 text-center mt-3 leading-relaxed">
            Para mantermos seu cadastro atualizado e facilitar o contato sobre
            seus agendamentos, precisamos que você informe seu telefone com DDD.
          </p>

          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={event => {
              event.preventDefault()
              void salvarTelefone()
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Telefone com DDD *
              </span>

              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefone}
                onChange={event => {
                  setTelefone(formatarTelefone(event.target.value))
                  setErroTelefone('')
                  setSucessoTelefone(false)
                }}
                placeholder="(16) 99999-9999"
                maxLength={16}
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as any]: cor }}
              />
            </label>

            {erroTelefone && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{erroTelefone}</p>
              </div>
            )}

            {sucessoTelefone && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm text-green-700">
                  Telefone atualizado. Seu painel já está liberado.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={salvandoTelefone}
              className="w-full rounded-xl py-3.5 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: cor }}
            >
              {salvandoTelefone ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {salvandoTelefone ? 'Salvando...' : 'Salvar telefone'}
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full py-2 text-sm text-gray-400"
            >
              Sair da conta
            </button>
          </form>
        </section>
      </main>
    )
  }

  // ============================================================
  // PAINEL DA CLIENTE
  // ============================================================

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f0f5' }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="relative overflow-hidden"
        style={{ backgroundColor: cor, minHeight: 240 }}
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
              onClick={() => router.push('/cliente/notificacoes')}
              aria-label="Abrir notificações"
              className={`relative w-10 h-10 rounded-2xl backdrop-blur flex items-center justify-center transition-all ${
                notifCount > 0
                  ? 'bg-white/35 scale-105 shadow-lg'
                  : 'bg-white/20'
              }`}
            >
              <Bell size={notifCount > 0 ? 20 : 18} className="text-white" />

              {notifCount > 0 && (
                <>
                  <span className="absolute inset-0 rounded-2xl border-2 border-white/50 animate-pulse" />
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-400 text-white text-[10px] flex items-center justify-center font-bold border-2 border-white shadow-sm">
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                </>
              )}
            </button>

            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-base">
              {profile?.nome?.charAt(0).toUpperCase() || 'C'}
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
              fontFamily: "'Dancing Script', cursive",
              fontSize: '2rem',
              fontWeight: 700,
              textShadow: '0 2px 12px rgba(0,0,0,0.15)',
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

      {/* NOTIFICAÇÕES: carregamento independente do painel */}

      {!verificandoPush && (
        <div className="px-4 -mt-5 relative z-10 mb-3">
          <div className="w-full rounded-2xl px-4 py-3 shadow-md bg-white">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: pushAtivoConta ? `${cor}18` : '#fee2e2'
                }}
              >
                <Bell
                  size={18}
                  style={{ color: pushAtivoConta ? cor : '#ef4444' }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium">
                  Notificações
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {pushAtivoConta
                    ? 'Ativadas neste dispositivo'
                    : 'Notificações desativadas'}
                </p>
              </div>

              {!pushAtivoConta && (
                <button
                  onClick={() => {
                    setErroPush('')
                    setModalPushLembrete(true)
                  }}
                  className="text-xs font-bold shrink-0"
                  style={{ color: cor }}
                >
                  Ativar
                </button>
              )}

              <button
                onClick={() => setTentativaPush(valor => valor + 1)}
                disabled={verificandoPush}
                title="Verificar notificações novamente"
                aria-label="Verificar notificações novamente"
                className="p-2 rounded-lg text-gray-400 disabled:opacity-50"
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {pushAtivoConta && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => void testarPushCliente()}
                  disabled={testandoPush}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{ backgroundColor: `${cor}12`, color: cor }}
                >
                  {testandoPush ? (
                    <>
                      <div
                        className="w-4 h-4 border-2 rounded-full animate-spin"
                        style={{
                          borderColor: `${cor}40`,
                          borderTopColor: cor
                        }}
                      />
                      Enviando teste...
                    </>
                  ) : (
                    <>
                      <Bell size={15} />
                      Testar notificação
                    </>
                  )}
                </button>

                {resultadoTestePush && (
                  <div
                    className="mt-2 rounded-xl px-3 py-2"
                    style={{ backgroundColor: `${cor}08` }}
                  >
                    <p className="text-xs leading-relaxed" style={{ color: cor }}>
                      {resultadoTestePush}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {verificandoPush && (
        <div className="px-4 -mt-5 relative z-10 mb-3">
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <RefreshCw size={16} className="animate-spin text-gray-400" />
            <p className="text-xs text-gray-500">
              Verificando notificações em segundo plano...
            </p>
          </div>
        </div>
      )}

      {proximos.length > 0 && (
        <div
          className={`px-4 relative z-10 mb-3 ${
            verificandoPush ? 'mt-0' : 'mt-0'
          }`}
        >
          <button
            onClick={() => router.push('/cliente/agendamentos')}
            className="w-full bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-md active:scale-[0.98] transition-all text-left"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${cor}18` }}
            >
              <Clock size={18} style={{ color: cor }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 font-medium">
                Próximo agendamento
              </p>
              <p className="text-sm font-bold text-gray-900 truncate">
                {proximos[0].servicos?.nome}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(proximos[0].data_hora).toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                })}
                {' · '}
                {new Date(proximos[0].data_hora).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        </div>
      )}

      <div
        className="px-4 flex flex-col gap-4 pb-10"
        style={{ marginTop: proximos.length > 0 ? 0 : -20 }}
      >
        {proximos.length === 0 && <div className="h-5" />}

        <div className="grid grid-cols-2 gap-3">
          {menuItems.map(({ icon: Icon, label, sub, href, badge }: any) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="bg-white rounded-3xl p-4 flex flex-col gap-3 active:scale-95 transition-all shadow-sm text-left relative overflow-hidden"
            >
              <div
                className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-5"
                style={{ backgroundColor: cor }}
              />

              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${cor}15` }}
              >
                <Icon size={20} style={{ color: cor }} />
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
                  style={{ backgroundColor: cor }}
                >
                  {badge}
                </div>
              )}
            </button>
          ))}
        </div>

        {mostrarQuemSomos && (
          <button
            onClick={() => router.push('/cliente/quem-somos')}
            className="bg-white rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-all text-left"
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${cor}15` }}
            >
              <Heart size={20} style={{ color: cor }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">
                {salao?.titulo_quem_somos || 'Quem somos'}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                Nossa história e valores
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        )}

        {contratosCount > 0 && (
          <button
            onClick={() => router.push('/cliente/contratos')}
            className="bg-white rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-all text-left"
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${cor}15` }}
            >
              <FileText size={20} style={{ color: cor }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">
                Contratos e termos
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                Documentos para assinar
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        )}

        {contasCount > 0 && (
          <button
            onClick={() => router.push('/cliente/contas')}
            className="bg-white rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-all text-left"
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${cor}15` }}
            >
              <Wallet size={20} style={{ color: cor }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">Minhas Contas</p>
              <p className="text-gray-400 text-xs mt-0.5">
                Débitos e créditos com o salão
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        )}

        {historico.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900 text-sm">Últimas visitas</p>
              <button
                onClick={() => router.push('/cliente/agendamentos')}
                className="text-xs font-semibold"
                style={{ color: cor }}
              >
                Ver todas
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {historico.slice(0, 3).map((ag: any) => (
                <div
                  key={ag.id}
                  className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cor}12` }}
                  >
                    <Scissors size={16} style={{ color: cor }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {ag.servicos?.nome}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(ag.data_hora).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>

                  {ag.valor && (
                    <p
                      className="text-sm font-bold shrink-0"
                      style={{ color: cor }}
                    >
                      R${' '}
                      {Number(ag.valor).toFixed(2).replace('.', ',')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {mostrarAvaliacoes && (
          <button
            onClick={() => router.push('/cliente/avaliacoes')}
            className="relative overflow-hidden rounded-3xl px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-all text-left"
            style={{
              background: `linear-gradient(135deg, ${cor} 0%, ${cor}bb 100%)`
            }}
          >
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Star size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">
                Deixe sua avaliação
              </p>
              <p className="text-white/70 text-xs mt-0.5">
                Compartilhe sua experiência ✨
              </p>
            </div>
            <Sparkles size={18} className="text-white/60 shrink-0" />
          </button>
        )}

        <button
          onClick={() => void signOut()}
          className="flex items-center justify-center gap-2 text-gray-400 text-sm py-2"
        >
          <LogOut size={15} />
          Sair da conta
        </button>
      </div>

      {/* JANELA DE ATIVAÇÃO DO PUSH */}

      {modalPushLembrete && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end">
          <div className="bg-white w-full rounded-t-3xl overflow-hidden flex flex-col">
            <div
              className="relative px-6 pt-8 pb-9 overflow-hidden shrink-0"
              style={{
                background: `linear-gradient(135deg, ${cor}, ${cor}bb)`
              }}
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 bg-white" />

              <button
                onClick={() => setModalPushLembrete(false)}
                aria-label="Fechar"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
              >
                <X size={16} className="text-white" />
              </button>

              <div className="relative flex flex-col items-center text-center gap-3 pt-2">
                <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center">
                  <Bell size={30} className="text-white" />
                </div>

                <h3 className="text-white font-bold text-xl leading-snug px-4">
                  Ative suas notificações!
                </h3>

                <p className="text-white/80 text-sm px-6 leading-relaxed">
                  Sem elas, você pode perder avisos de horários confirmados,
                  lembretes de agendamento e novidades do salão.
                </p>
              </div>
            </div>

            <div className="px-6 py-6 flex flex-col gap-3">
              {erroPush && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm">{erroPush}</p>
                  <button
                    onClick={() => setTentativaPush(valor => valor + 1)}
                    disabled={verificandoPush || ativandoPush}
                    className="mt-2 text-sm font-semibold text-red-700 underline disabled:opacity-50"
                  >
                    Verificar novamente
                  </button>
                </div>
              )}

              <button
                onClick={() => void ativarPushAgora()}
                disabled={ativandoPush}
                className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: cor }}
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

              <button
                onClick={() => setModalPushLembrete(false)}
                className="w-full py-3 text-gray-400 text-sm font-medium"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
