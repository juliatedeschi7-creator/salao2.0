
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
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Phone,
  MessageCircle,
  Send
} from 'lucide-react'

export default function ClientePerfilPage() {
  const { profile, loading, temAcessoTotal } = useAuth()
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

  const [senhaTemporaria, setSenhaTemporaria] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [redefinindoSenha, setRedefinindoSenha] = useState(false)
  const [mensagemSenha, setMensagemSenha] = useState('')
  const [erroSenha, setErroSenha] = useState(false)

  // Solicitação de correção do telefone
  const [solicitacaoTelefone, setSolicitacaoTelefone] = useState<any>(null)
  const [modalTelefone, setModalTelefone] = useState(false)
  const [motivoTelefone, setMotivoTelefone] = useState('')
  const [enviandoSolicitacaoTelefone, setEnviandoSolicitacaoTelefone] = useState(false)
  const [mensagemTelefone, setMensagemTelefone] = useState('')
  const [erroTelefone, setErroTelefone] = useState(false)

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

  async function carregarSolicitacaoTelefone() {
    if (!profile?.salao_id || !clienteId) return

    const { data, error } = await supabase
      .from('clientes_solicitacoes_telefone')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('salao_id', profile.salao_id)
      .order('criada_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error(
        'Erro ao carregar solicitação de telefone:',
        error
      )
      return
    }

    setSolicitacaoTelefone(data || null)
  }

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
        .eq('salao_id', profile!.salao_id!)
        .single()

      if (erroCli || !cli) {
        setCarregando(false)
        return
      }

      setCliente(cli)
      setObsText(cli?.observacoes_internas || '')

      await carregarSolicitacaoTelefone()

      const { data: ags } = await supabase
        .from('agendamentos')
        .select(
          '*, servicos(nome, preco), profiles!agendamentos_profissional_id_fkey(nome)'
        )
        .eq('cliente_id', clienteId)
        .order('data_hora', { ascending: false })

      setAgendamentos(ags || [])

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

  async function solicitarCorrecaoTelefone() {
    setMensagemTelefone('')
    setErroTelefone(false)

    if (!cliente || !profile?.salao_id) {
      setErroTelefone(true)
      setMensagemTelefone(
        'Não foi possível identificar o salão ou a cliente.'
      )
      return
    }

    if (!motivoTelefone.trim()) {
      setErroTelefone(true)
      setMensagemTelefone(
        'Informe o motivo da solicitação.'
      )
      return
    }

    if (
      solicitacaoTelefone?.status === 'pendente'
    ) {
      setErroTelefone(true)
      setMensagemTelefone(
        'Já existe uma solicitação aguardando resposta desta cliente.'
      )
      return
    }

    setEnviandoSolicitacaoTelefone(true)

    try {
      const {
        data: { user },
        error: erroUsuario
      } = await supabase.auth.getUser()

      if (erroUsuario || !user) {
        throw new Error(
          'Não foi possível identificar o usuário que está fazendo a solicitação.'
        )
      }

      const { data, error } = await supabase
        .from('clientes_solicitacoes_telefone')
        .insert({
          cliente_id: clienteId,
          salao_id: profile.salao_id,
          solicitada_por: user.id,
          telefone_atual: cliente.telefone || null,
          motivo: motivoTelefone.trim(),
          status: 'pendente'
        })
        .select()
        .single()

      if (error) {
        console.error(
          'Erro ao criar solicitação de telefone:',
          error
        )
        throw new Error(
          error.message ||
          'Não foi possível registrar a solicitação.'
        )
      }

      setSolicitacaoTelefone(data)
      setMotivoTelefone('')
      setModalTelefone(false)
      setMensagemTelefone(
        'Solicitação registrada. Ela ficará disponível para a cliente responder pela Minha Área.'
      )
      setErroTelefone(false)

    } catch (error: any) {
      console.error(error)
      setErroTelefone(true)
      setMensagemTelefone(
        error?.message ||
        'Ocorreu um erro ao enviar a solicitação.'
      )
    } finally {
      setEnviandoSolicitacaoTelefone(false)
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
      .eq('salao_id', profile!.salao_id!)

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

  async function redefinirSenha() {
    setMensagemSenha('')
    setErroSenha(false)

    if (!cliente?.profile_id) {
      setErroSenha(true)
      setMensagemSenha(
        'Esta cliente ainda não possui uma conta vinculada.'
      )
      return
    }

    if (senhaTemporaria.length < 8) {
      setErroSenha(true)
      setMensagemSenha(
        'A senha deve ter pelo menos 8 caracteres.'
      )
      return
    }

    const confirmar = window.confirm(
      `Deseja realmente definir uma nova senha temporária para ${cliente.nome}? A senha atual deixará de funcionar.`
    )

    if (!confirmar) return

    setRedefinindoSenha(true)

    try {
      const resposta = await fetch(
        `/api/salao/clientes/${clienteId}/redefinir-senha`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            senha: senhaTemporaria
          })
        }
      )

      const resultado = await resposta.json()

      if (!resposta.ok) {
        throw new Error(
          resultado?.error ||
          'Não foi possível redefinir a senha.'
        )
      }

      setSenhaTemporaria('')
      setMostrarSenha(false)
      setErroSenha(false)
      setMensagemSenha(
        'Senha temporária definida com sucesso! Informe a nova senha à cliente por um canal privado.'
      )

    } catch (error: any) {
      setErroSenha(true)
      setMensagemSenha(
        error?.message ||
        'Ocorreu um erro ao redefinir a senha.'
      )
    } finally {
      setRedefinindoSenha(false)
    }
  }

  const cor =
    salao?.cor_primaria ||
    '#E91E8C'

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
    confirmado: 'bg-green-50 text-green-600',
    pendente: 'bg-yellow-50 text-yellow-600',
    concluido: 'bg-gray-100 text-gray-500',
    cancelado: 'bg-red-50 text-red-400',
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
            {cliente?.nome?.charAt(0).toUpperCase()}
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
              style={{ color: cor }}
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

      {cliente?.telefone && (
        <div className="px-4 mb-4">
          <a
            href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-medium text-sm"
            style={{ backgroundColor: '#25D366' }}
          >
            <MessageCircle size={16} />
            Enviar mensagem no WhatsApp
          </a>
        </div>
      )}

      <div className="px-4 mb-4">
        <div className="flex gap-1.5 bg-white rounded-2xl p-1 shadow-sm overflow-x-auto">
          {([
            { key: 'resumo', label: 'Resumo' },
            { key: 'historico', label: 'Histórico' },
            { key: 'pacotes', label: 'Pacotes' },
            { key: 'anamnese', label: 'Anamnese' }
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

        {aba === 'resumo' && (
          <>
            <div className="card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={14} style={{ color: cor }} />
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
                    onChange={e => setObsText(e.target.value)}
                    autoFocus
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setObsText(cliente?.observacoes_internas || '')
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
                      style={{ backgroundColor: cor }}
                    >
                      {salvandoObs ? '...' : (
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
                  onClick={() => setEditandoObs(true)}
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

            {temAcessoTotal && (
              <div className="card flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound
                    size={17}
                    style={{ color: cor }}
                  />
                  <p className="text-sm font-semibold text-gray-700">
                    Acesso à conta
                  </p>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  Defina uma senha temporária para esta cliente caso ela não consiga acessar a conta.
                </p>

                {!cliente?.profile_id ? (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                    <p className="text-xs text-yellow-700">
                      Esta cliente ainda não possui uma conta vinculada ao aplicativo.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <input
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senhaTemporaria}
                        onChange={e => {
                          setSenhaTemporaria(e.target.value)
                          setMensagemSenha('')
                        }}
                        placeholder="Digite a senha temporária"
                        autoComplete="new-password"
                        maxLength={128}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 pr-12 text-sm outline-none focus:border-pink-300"
                      />

                      <button
                        type="button"
                        onClick={() => setMostrarSenha(!mostrarSenha)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {mostrarSenha ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-400">
                      Utilize pelo menos 8 caracteres.
                    </p>

                    <button
                      onClick={redefinirSenha}
                      disabled={
                        redefinindoSenha ||
                        senhaTemporaria.length < 8
                      }
                      className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: cor }}
                    >
                      <ShieldCheck size={16} />
                      {redefinindoSenha
                        ? 'Redefinindo senha...'
                        : 'Definir senha temporária'}
                    </button>
                  </>
                )}

                {mensagemSenha && (
                  <div
                    className={`rounded-xl p-3 text-xs leading-relaxed ${
                      erroSenha
                        ? 'bg-red-50 text-red-600'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {mensagemSenha}
                  </div>
                )}
              </div>
            )}

            {/* Dados pessoais e solicitação de correção */}
            <div className="card flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Dados pessoais
              </p>

              {cliente?.telefone ? (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-700">
                    {cliente.telefone}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-red-500">
                    Nenhum telefone cadastrado
                  </p>
                </div>
              )}

              {cliente?.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-700">
                    {cliente.email}
                  </p>
                </div>
              )}

              {cliente?.data_nascimento && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-700">
                    Nasc:{' '}
                    {new Date(
                      cliente.data_nascimento + 'T12:00'
                    ).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Phone size={15} style={{ color: cor }} />
                  <p className="text-sm font-semibold text-gray-700">
                    Conferência do telefone
                  </p>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  Se o número estiver incorreto ou não tiver WhatsApp, você pode pedir à cliente que confira e responda pela Minha Área.
                </p>

                {solicitacaoTelefone?.status === 'pendente' ? (
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 flex flex-col gap-1">
                    <p className="text-xs font-semibold text-yellow-800">
                      Solicitação aguardando resposta
                    </p>
                    <p className="text-xs text-yellow-700">
                      Enviada em{' '}
                      {solicitacaoTelefone.criada_em
                        ? new Date(solicitacaoTelefone.criada_em).toLocaleDateString('pt-BR')
                        : 'data não disponível'}
                    </p>
                    {solicitacaoTelefone.motivo && (
                      <p className="text-xs text-yellow-700">
                        Motivo: {solicitacaoTelefone.motivo}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMensagemTelefone('')
                      setErroTelefone(false)
                      setMotivoTelefone('')
                      setModalTelefone(true)
                    }}
                    className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border"
                    style={{
                      color: cor,
                      borderColor: `${cor}55`,
                      backgroundColor: `${cor}08`
                    }}
                  >
                    <Send size={15} />
                    Solicitar correção do telefone
                  </button>
                )}

                {solicitacaoTelefone?.status === 'aceita' && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-semibold text-green-700">
                      A cliente respondeu à solicitação
                    </p>
                    {solicitacaoTelefone.telefone_corrigido && (
                      <p className="text-xs text-green-700 mt-1">
                        Telefone informado: {solicitacaoTelefone.telefone_corrigido}
                      </p>
                    )}
                    {solicitacaoTelefone.resposta_cliente && (
                      <p className="text-xs text-green-700 mt-1">
                        Resposta: {solicitacaoTelefone.resposta_cliente}
                      </p>
                    )}
                    <p className="text-[11px] text-green-600 mt-2">
                      Confira a informação antes de atualizar o cadastro. O telefone não foi alterado automaticamente.
                    </p>
                    <button
                      type="button"
                      onClick={() => setModalTelefone(true)}
                      className="text-xs font-semibold mt-2 underline"
                      style={{ color: cor }}
                    >
                      Criar nova solicitação
                    </button>
                  </div>
                )}

                {solicitacaoTelefone?.status === 'recusada' && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-700">
                      A cliente recusou a solicitação
                    </p>
                    {solicitacaoTelefone.resposta_cliente && (
                      <p className="text-xs text-gray-600 mt-1">
                        Resposta: {solicitacaoTelefone.resposta_cliente}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMensagemTelefone('')
                        setErroTelefone(false)
                        setMotivoTelefone('')
                        setModalTelefone(true)
                      }}
                      className="text-xs font-semibold mt-2 underline"
                      style={{ color: cor }}
                    >
                      Criar nova solicitação
                    </button>
                  </div>
                )}

                {mensagemTelefone && (
                  <div
                    className={`rounded-xl p-3 text-xs leading-relaxed ${
                      erroTelefone
                        ? 'bg-red-50 text-red-600'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {mensagemTelefone}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {aba === 'historico' && (
          agendamentos.length === 0 ? (
            <div className="card text-center py-8">
              <Calendar size={32} className="text-gray-300 mx-auto mb-2" />
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
                  {new Date(ag.data_hora).toLocaleDateString(
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

        {aba === 'pacotes' && (
          pacotes.length === 0 ? (
            <div className="card text-center py-8">
              <Package size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">
                Nenhum pacote
              </p>
            </div>
          ) : (
            pacotes.map(p => {
              const sessoesTotal = Number(p.sessoes_total || 0)
              const sessoesRestantes = Number(p.sessoes_restantes || 0)
              const sessoesUsadas = Math.max(0, sessoesTotal - sessoesRestantes)

              const percentual = sessoesTotal > 0
                ? Math.min(
                    100,
                    Math.round((sessoesUsadas / sessoesTotal) * 100)
                  )
                : 0

              const historicoSessoes = Array.isArray(p.historico_sessoes)
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
                        {p.servico || 'Pacote'}
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
                        backgroundColor: p.status === 'ativo'
                          ? `${cor}15`
                          : '#f3f4f6',
                        color: p.status === 'ativo'
                          ? cor
                          : '#9ca3af'
                      }}
                    >
                      {p.status === 'ativo' ? 'Ativo' : 'Concluído'}
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
                      style={{ backgroundColor: `${cor}10` }}
                    >
                      <p
                        className="text-lg font-bold"
                        style={{ color: cor }}
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
                      <span>Utilização</span>
                      <span>{percentual}%</span>
                    </div>

                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentual}%`,
                          backgroundColor: cor
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
                          .map((sessao: any, index: number) => (
                            <div
                              key={sessao.id || index}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-gray-500">
                                {sessao.data
                                  ? new Date(sessao.data).toLocaleDateString('pt-BR')
                                  : `Sessão ${index + 1}`}
                              </span>

                              {sessao.servico && (
                                <span className="text-gray-400">
                                  {sessao.servico}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )
        )}

        {aba === 'anamnese' && (
          anamneses.length === 0 ? (
            <div className="card text-center py-8">
              <ClipboardList size={32} className="text-gray-300 mx-auto mb-2" />
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

      {/* Modal para solicitar correção do telefone */}
      {modalTelefone && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Solicitar correção
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  A cliente receberá o pedido na Minha Área.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalTelefone(false)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-400 mb-1">
                Telefone atualmente cadastrado
              </p>
              <p className="text-sm font-semibold text-gray-700">
                {cliente.telefone || 'Nenhum telefone cadastrado'}
              </p>
            </div>

            <label className="text-sm font-semibold text-gray-700 block mb-2">
              Por que está solicitando a conferência?
            </label>

            <textarea
              value={motivoTelefone}
              onChange={e => {
                setMotivoTelefone(e.target.value)
                setMensagemTelefone('')
              }}
              rows={4}
              maxLength={500}
              placeholder="Ex.: Este número parece estar incorreto ou não possui WhatsApp. Por favor, confira seus dados."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none resize-none focus:border-pink-300"
            />

            <p className="text-[11px] text-gray-400 mt-1 mb-3">
              A cliente poderá informar o número correto ou recusar a solicitação. O cadastro não será alterado sem conferência.
            </p>

            {mensagemTelefone && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-xs mb-3">
                {mensagemTelefone}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalTelefone(false)}
                disabled={enviandoSolicitacaoTelefone}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={solicitarCorrecaoTelefone}
                disabled={
                  enviandoSolicitacaoTelefone ||
                  !motivoTelefone.trim()
                }
                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: cor }}
              >
                <Send size={15} />
                {enviandoSolicitacaoTelefone
                  ? 'Enviando...'
                  : 'Enviar solicitação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
