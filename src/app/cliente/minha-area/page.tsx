
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  UserRound,
  Phone,
  Mail,
  Calendar,
  Save,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'

function formatarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, '').slice(0, 11)

  if (numeros.length <= 2) return numeros.length ? `(${numeros}` : ''
  if (numeros.length <= 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`
  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`
}

function telefoneValido(valor: string) {
  const n = valor.replace(/\D/g, '')
  return n.length === 10 || n.length === 11
}

const nomesCampos: Record<string, string> = {
  nome: 'Nome completo',
  telefone: 'Telefone',
  email: 'E-mail',
  data_nascimento: 'Data de nascimento'
}

export default function MinhaAreaPage() {
  const { profile, user, loading } = useAuth()
  const router = useRouter()

  const [cliente, setCliente] = useState<any>(null)
  const [salao, setSalao] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [email, setEmail] = useState('')

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [respondendo, setRespondendo] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    if (!profile?.id) return

    setCarregando(true)
    setErro('')

    try {
      const { data: cli, error: erroCliente } = await supabase
        .from('clientes')
        .select('*, saloes(*)')
        .eq('profile_id', profile.id)
        .maybeSingle()

      if (erroCliente) throw erroCliente

      if (!cli) {
        throw new Error('Não encontramos um cadastro de cliente vinculado à sua conta.')
      }

      setCliente(cli)
      setSalao(cli.saloes || null)

      setNome(cli.nome || '')
      setTelefone(cli.telefone ? formatarTelefone(cli.telefone) : '')
      setDataNascimento(cli.data_nascimento || '')
      setEmail(cli.email || user?.email || '')

      const [hist, sols] = await Promise.all([
        supabase
          .from('clientes_dados_historico')
          .select('*')
          .eq('cliente_id', cli.id)
          .order('criado_em', { ascending: false }),

        supabase
          .from('clientes_solicitacoes_telefone')
          .select('*')
          .eq('cliente_id', cli.id)
          .order('criada_em', { ascending: false })
      ])

      if (hist.error) {
        console.error('Erro ao carregar histórico:', hist.error)
      } else {
        setHistorico(hist.data || [])
      }

      if (sols.error) {
        console.error('Erro ao carregar solicitações:', sols.error)
      } else {
        setSolicitacoes(sols.data || [])
      }

      // Sincroniza o e-mail somente depois da confirmação no Supabase Auth.
      if (user?.email && cli.email !== user.email) {
        const { error: erroAtualizarCliente } = await supabase
          .from('clientes')
          .update({ email: user.email })
          .eq('id', cli.id)
          .eq('profile_id', profile.id)

        if (!erroAtualizarCliente) {
          await supabase
            .from('profiles')
            .update({ email: user.email })
            .eq('id', profile.id)

          setCliente((atual: any) => ({
            ...atual,
            email: user.email
          }))

          setEmail(user.email || '')
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar Minha Área:', e)
      setErro(e?.message || 'Não foi possível carregar seus dados.')
    } finally {
      setCarregando(false)
    }
  }, [profile?.id, user?.email])

  useEffect(() => {
    if (!loading && !profile) {
      router.replace('/login')
      return
    }

    if (!loading && profile?.id) {
      void carregarDados()
    }
  }, [loading, profile?.id, carregarDados, router])

  async function salvarDados() {
    if (!profile?.id || !cliente?.id) return

    setErro('')
    setSucesso('')

    if (!nome.trim()) {
      setErro('Informe seu nome completo.')
      return
    }

    if (!telefoneValido(telefone)) {
      setErro('Informe um telefone válido com DDD.')
      return
    }

    if (dataNascimento) {
      const data = new Date(`${dataNascimento}T12:00:00`)

      if (Number.isNaN(data.getTime()) || data > new Date()) {
        setErro('Confira a data de nascimento informada.')
        return
      }
    }

    setSalvando(true)

    try {
      const atualizacoes = {
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, ''),
        data_nascimento: dataNascimento || null
      }

      const { data, error: erroAtualizacao } = await supabase
        .from('clientes')
        .update(atualizacoes)
        .eq('id', cliente.id)
        .eq('profile_id', profile.id)
        .select('*')
        .maybeSingle()

      if (erroAtualizacao) throw erroAtualizacao

      if (!data) {
        throw new Error(
          'O banco não confirmou a atualização. Confira as permissões do cadastro.'
        )
      }

      const { error: erroPerfil } = await supabase
        .from('profiles')
        .update({ nome: nome.trim() })
        .eq('id', profile.id)

      if (erroPerfil) {
        console.error('Não foi possível atualizar o nome do perfil:', erroPerfil)
      }

      setCliente((atual: any) => ({
        ...atual,
        ...data
      }))

      setTelefone(formatarTelefone(data.telefone || ''))

      setSucesso(
        'Seus dados foram atualizados. As alterações de cadastro ficam registradas no histórico.'
      )

      await carregarDados()
    } catch (e: any) {
      console.error('Erro ao salvar dados:', e)
      setErro(e?.message || 'Não foi possível salvar seus dados.')
    } finally {
      setSalvando(false)
    }
  }

  async function solicitarAlteracaoEmail() {
    if (!email.trim() || !email.includes('@')) {
      setErro('Informe um endereço de e-mail válido.')
      return
    }

    if (email.trim().toLowerCase() === (user?.email || '').toLowerCase()) {
      setErro('Este já é o e-mail da sua conta.')
      return
    }

    setErro('')
    setSucesso('')

    try {
      const { error: authError } = await supabase.auth.updateUser({
        email: email.trim()
      })

      if (authError) throw authError

      setSucesso(
        'Enviamos uma confirmação para o novo e-mail. A alteração só será concluída depois que você confirmar a mensagem recebida.'
      )
    } catch (e: any) {
      console.error('Erro ao solicitar alteração de e-mail:', e)
      setErro(e?.message || 'Não foi possível solicitar a alteração do e-mail.')
    }
  }

  async function responderSolicitacao(
    solicitacao: any,
    aceitar: boolean
  ) {
    if (!profile?.id || !cliente?.id) return

    if (solicitacao.status !== 'pendente') {
      setErro('Esta solicitação já foi respondida.')
      await carregarDados()
      return
    }

    let telefoneCorrigido = ''
    let respostaCliente = ''

    if (aceitar) {
      telefoneCorrigido = window.prompt(
        'Digite o telefone correto com DDD:',
        telefone
      ) || ''

      if (!telefoneValido(telefoneCorrigido)) {
        setErro('Para aceitar, informe um telefone válido com DDD.')
        return
      }
    } else {
      const motivo = window.prompt(
        'Se desejar, explique por que não pode atualizar o telefone:',
        ''
      )

      if (motivo === null) return

      respostaCliente = motivo.trim() || 'Solicitação recusada.'
    }

    setRespondendo(solicitacao.id)
    setErro('')
    setSucesso('')

    try {
      // Ao aceitar, atualiza o cadastro da cliente.
      // O gatilho existente registra a alteração em clientes_dados_historico.
      if (aceitar) {
        const { data: clienteAtualizado, error: erroTelefone } = await supabase
          .from('clientes')
          .update({
            telefone: telefoneCorrigido.replace(/\D/g, '')
          })
          .eq('id', cliente.id)
          .eq('profile_id', profile.id)
          .select('id, telefone')
          .maybeSingle()

        if (erroTelefone) throw erroTelefone

        if (!clienteAtualizado) {
          throw new Error(
            'Não foi possível atualizar seu telefone. Confira as permissões do cadastro.'
          )
        }

        setTelefone(formatarTelefone(clienteAtualizado.telefone || ''))
      }

      // Só permite responder se a solicitação ainda estiver pendente.
      const { data: resposta, error: erroResposta } = await supabase
        .from('clientes_solicitacoes_telefone')
        .update({
          status: aceitar ? 'aceita' : 'recusada',
          telefone_corrigido: aceitar
            ? telefoneCorrigido.replace(/\D/g, '')
            : null,
          resposta_cliente: aceitar
            ? 'Telefone atualizado pela cliente.'
            : respostaCliente
        })
        .eq('id', solicitacao.id)
        .eq('cliente_id', cliente.id)
        .eq('status', 'pendente')
        .select('id')
        .maybeSingle()

      if (erroResposta) throw erroResposta

      if (!resposta) {
        throw new Error(
          'O telefone foi atualizado, mas a solicitação não pôde ser confirmada. Atualize a página e confira o cadastro.'
        )
      }

      setSucesso(
        aceitar
          ? 'Telefone atualizado e solicitação respondida.'
          : 'Solicitação respondida. Obrigada por nos avisar.'
      )

      await carregarDados()
    } catch (e: any) {
      console.error('Erro ao responder solicitação:', e)

      setErro(
        e?.message ||
        'Não foi possível concluir a resposta. Confira seus dados e tente novamente.'
      )

      await carregarDados()
    } finally {
      setRespondendo(null)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw
            className="animate-spin"
            style={{ color: cor }}
            size={28}
          />
          <p className="text-sm text-gray-500">Carregando seus dados...</p>
        </div>
      </main>
    )
  }

  if (!cliente) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <AlertCircle size={32} className="text-red-400 mb-3" />
        <p className="text-center text-gray-600">
          {erro || 'Cadastro não encontrado.'}
        </p>

        <button
          onClick={() => router.push('/cliente')}
          className="mt-5 px-5 py-3 rounded-xl text-white"
          style={{ backgroundColor: cor }}
        >
          Voltar ao painel
        </button>
      </main>
    )
  }

  const solicitacoesPendentes = solicitacoes.filter(
    s => s.status === 'pendente'
  )

  return (
    <main className="min-h-screen bg-[#f5f5f8] pb-10">
      <header
        className="px-5 pt-12 pb-7 text-white rounded-b-[2rem]"
        style={{ backgroundColor: cor }}
      >
        <button
          onClick={() => router.push('/cliente')}
          className="flex items-center gap-2 text-sm text-white/90 mb-6"
        >
          <ArrowLeft size={18} />
          Voltar ao painel
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <UserRound size={25} />
          </div>

          <div>
            <p className="text-white/75 text-xs">Seu cadastro</p>
            <h1 className="text-2xl font-bold">Minha Área</h1>
          </div>
        </div>

        <p className="text-sm text-white/80 mt-4">
          Mantenha seus dados atualizados para facilitar nosso contato e cuidar melhor dos seus atendimentos.
        </p>
      </header>

      <div className="px-4 mt-5 flex flex-col gap-4 max-w-xl mx-auto">
        {erro && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-sm text-green-700 flex gap-2">
            <CheckCircle size={18} className="shrink-0" />
            <span>{sucesso}</span>
          </div>
        )}

        {solicitacoesPendentes.length > 0 && (
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle size={19} className="text-amber-600" />
              Solicitações do salão
            </h2>

            <p className="text-xs text-gray-500 mb-4">
              O salão precisa confirmar algumas informações do seu cadastro.
              Confira as solicitações abaixo.
            </p>

            {solicitacoesPendentes.map(s => (
              <div
                key={s.id}
                className="border border-amber-100 bg-amber-50 rounded-xl p-4 mb-3 last:mb-0"
              >
                <p className="font-semibold text-gray-800 text-sm">
                  O salão pediu para conferir seu telefone.
                </p>

                <p className="text-xs text-gray-600 mt-2">
                  Telefone cadastrado:{' '}
                  {s.telefone_atual || 'Não informado'}
                </p>

                {s.motivo && (
                  <p className="text-xs text-gray-600 mt-2">
                    Motivo: {s.motivo}
                  </p>
                )}

                <div className="flex flex-col gap-2 mt-4">
                  <button
                    disabled={respondendo === s.id}
                    onClick={() => void responderSolicitacao(s, true)}
                    className="w-full rounded-lg py-3 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: cor }}
                  >
                    {respondendo === s.id ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Phone size={16} />
                    )}
                    Informar telefone correto
                  </button>

                  <button
                    disabled={respondendo === s.id}
                    onClick={() => void responderSolicitacao(s, false)}
                    className="w-full rounded-lg px-3 py-3 border border-gray-200 bg-white text-gray-600 text-sm font-semibold disabled:opacity-50"
                  >
                    Não posso atualizar agora
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Dados pessoais</h2>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <UserRound size={15} />
                Nome completo
              </span>

              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                maxLength={150}
                autoComplete="name"
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as any]: cor }}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Phone size={15} />
                Telefone com DDD
              </span>

              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefone}
                onChange={e => setTelefone(formatarTelefone(e.target.value))}
                placeholder="(16) 99999-9999"
                maxLength={16}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as any]: cor }}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar size={15} />
                Data de nascimento
              </span>

              <input
                type="date"
                value={dataNascimento}
                onChange={e => setDataNascimento(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as any]: cor }}
              />
            </label>

            <button
              onClick={() => void salvarDados()}
              disabled={salvando}
              className="w-full rounded-xl py-3.5 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: cor }}
            >
              {salvando ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Mail size={17} />
            E-mail da conta
          </h2>

          <p className="text-xs text-gray-500 mb-3">
            Para sua segurança, a troca de e-mail precisa ser confirmada pelo endereço novo.
          </p>

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="seuemail@exemplo.com"
            className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none mb-3"
          />

          <button
            onClick={() => void solicitarAlteracaoEmail()}
            className="w-full rounded-xl py-3 border font-semibold text-sm"
            style={{ color: cor, borderColor: cor }}
          >
            Solicitar alteração de e-mail
          </button>
        </section>

        <section className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-1">
            <Clock size={17} />
            Histórico de alterações
          </h2>

          <p className="text-xs text-gray-500 mb-4">
            As alterações nos seus dados ficam registradas para manter a segurança do cadastro.
          </p>

          {historico.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">
              Nenhuma alteração registrada até o momento.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {historico.map(item => (
                <div
                  key={item.id}
                  className="border-l-2 pl-3 py-1"
                  style={{ borderColor: cor }}
                >
                  <p className="text-sm font-semibold text-gray-800">
                    {nomesCampos[item.campo] || item.campo}
                  </p>

                  <p className="text-xs text-gray-500 mt-1 break-words">
                    Antes: {item.valor_anterior || 'Não informado'}
                  </p>

                  <p className="text-xs text-gray-700 break-words">
                    Agora: {item.valor_novo || 'Não informado'}
                  </p>

                  <p className="text-[11px] text-gray-400 mt-1">
                    {item.criado_em
                      ? new Date(item.criado_em).toLocaleString('pt-BR')
                      : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 leading-relaxed">
            Seus dados são utilizados para identificação, comunicação e organização dos seus atendimentos com{' '}
            {salao?.nome || 'o salão'}. Se precisar de ajuda, entre em contato diretamente com o salão.
          </p>
        </section>
      </div>
    </main>
  )
}
