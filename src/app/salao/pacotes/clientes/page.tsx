'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import {
  CreditCard,
  Users,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  X,
  ChevronRight,
  Calendar,
  UserPlus
} from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function PacotesClientesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const router = useRouter()

  const [profile, setProfile] = useState<any>(null)
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  // Cliente selecionado e pacotes
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null)
  const [pacotesCliente, setPacotesCliente] = useState<any[]>([])
  const [pacotesDisponiveis, setPacotesDisponiveis] = useState<any[]>([])

  // Modais
  const [modalVenderAberto, setModalVenderAberto] = useState(false)
  const [modalAntigoAberto, setModalAntigoAberto] = useState(false)
  const [modalSessaoAberto, setModalSessaoAberto] = useState(false)
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false)
  const [pacoteAlvoSessao, setPacoteAlvoSessao] = useState<any>(null)

  // Inputs formulários
  const [pacoteEscolhido, setPacoteEscolhido] = useState('')
  const [nomePacoteAntigo, setNomePacoteAntigo] = useState('')
  const [sessoesTotalAntigo, setSessoesTotalAntigo] = useState('')

  // Novo cliente rápido
  const [nomeNovoCliente, setNomeNovoCliente] = useState('')
  const [telefoneNovoCliente, setTelefoneNovoCliente] = useState('')

  // Sessão realizada
  const [servicoSessao, setServicoSessao] = useState('')
  const [dataSessao, setDataSessao] = useState(
    new Date().toISOString().split('T')[0]
  )

  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()

        if (!session) {
          router.replace('/login')
          return
        }

        const { data: prof, error: erroProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (erroProfile || !prof) {
          router.replace('/login')
          return
        }

        let salaoId = prof.salao_id

        if (!salaoId) {
          const { data: salDono } = await supabase
            .from('saloes')
            .select('id')
            .eq('dono_id', session.user.id)
            .maybeSingle()

          if (salDono) {
            salaoId = salDono.id
          }
        }

        if (!salaoId) {
          router.replace('/criar-salao')
          return
        }

        setProfile(prof)

        const { data: sal } = await supabase
          .from('saloes')
          .select('*')
          .eq('id', salaoId)
          .single()

        setSalao(sal)

        await carregarClientes(salaoId)

        // Busca os pacotes cadastrados no salão
        const { data: listaPacotes, error: errPacotes } = await supabase
          .from('pacotes')
          .select('*')
          .eq('salao_id', salaoId)
          .order('nome', { ascending: true })

        if (errPacotes) {
          console.error(
            'Erro ao buscar pacotes criados:',
            errPacotes.message
          )
        } else {
          setPacotesDisponiveis(listaPacotes || [])
        }
      } catch (e) {
        console.error('Erro ao carregar:', e)
      } finally {
        setCarregando(false)
      }
    }

    carregar()
  }, [])

  // =========================================================
  // CLIENTES
  // =========================================================

  async function carregarClientes(salaoId: string) {
    const { data: listaClientes, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('salao_id', salaoId)
      .order('nome', { ascending: true })

    if (error) {
      console.error('Erro ao carregar clientes:', error.message)
      return
    }

    setClientes(listaClientes || [])

    // Se a cliente que estava selecionada foi excluída,
    // volta automaticamente para a lista.
    if (clienteSelecionado) {
      const aindaExiste = (listaClientes || []).some(
        c => c.id === clienteSelecionado.id
      )

      if (!aindaExiste) {
        setClienteSelecionado(null)
        setPacotesCliente([])
      }
    }
  }

  async function cadastrarNovoClienteRapido(e: React.FormEvent) {
    e.preventDefault()

    if (!nomeNovoCliente || !salao) return

    setSalvando(true)

    try {
      const { data: novoC, error } = await supabase
        .from('clientes')
        .insert({
          salao_id: salao.id,
          nome: nomeNovoCliente,
          telefone: telefoneNovoCliente || null
        })
        .select()
        .single()

      if (error) {
        alert('Erro ao cadastrar cliente: ' + error.message)
        return
      }

      await carregarClientes(salao.id)

      setModalNovoClienteAberto(false)
      setNomeNovoCliente('')
      setTelefoneNovoCliente('')

      if (novoC) {
        abrirDetalhesCliente(novoC)
      }
    } catch (err: any) {
      alert('Erro inesperado: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function abrirDetalhesCliente(cliente: any) {
    setClienteSelecionado(cliente)
    await carregarPacotesDoCliente(cliente.nome)
  }

  // =========================================================
  // PACOTES DA CLIENTE
  // =========================================================

  async function carregarPacotesDoCliente(clienteNome: string) {
    const { data: pacotes, error } = await supabase
      .from('pacotes_clientes_resumo')
      .select('*')
      .eq('cliente_nome', clienteNome)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar pacotes:', error.message)
      setPacotesCliente([])
      return
    }

    setPacotesCliente(pacotes || [])
  }

  // =========================================================
  // VENDER PACOTE
  // =========================================================

  async function venderPacote(e: React.FormEvent) {
    e.preventDefault()

    if (!pacoteEscolhido || !clienteSelecionado || !salao) return

    setSalvando(true)

    try {
      const pacoteObj = pacotesDisponiveis.find(
        p => p.id === pacoteEscolhido
      )

      if (!pacoteObj) {
        alert('Pacote não encontrado.')
        return
      }

      /*
       * CORREÇÃO IMPORTANTE:
       *
       * A tabela "pacotes" possui:
       *
       * sessoes
       * sessoes_inclusas
       *
       * A quantidade correta cadastrada na página de Pacotes
       * deve ser lida primeiro de sessoes_inclusas.
       */
      const totalSessoes = Number(
        pacoteObj?.sessoes_inclusas ??
        pacoteObj?.sessoes ??
        pacoteObj?.sessoes_total ??
        pacoteObj?.quantidade ??
        pacoteObj?.total_sessoes ??
        1
      )

      const nomeServico = pacoteObj?.nome || 'Pacote'

      const { error } = await supabase
        .from('pacotes_clientes_resumo')
        .insert({
          cliente_nome: clienteSelecionado.nome,
          servico: nomeServico,
          sessoes_total: totalSessoes,
          sessoes_restantes: totalSessoes,
          status: 'ativo',
          historico_sessoes: []
        })

      if (error) {
        alert('Erro ao atribuir pacote: ' + error.message)
        return
      }

      setModalVenderAberto(false)
      setPacoteEscolhido('')

      await carregarPacotesDoCliente(clienteSelecionado.nome)
    } catch (err: any) {
      alert('Erro inesperado: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  // =========================================================
  // PACOTE ANTIGO
  // =========================================================

  async function cadastrarPacoteAntigo(e: React.FormEvent) {
    e.preventDefault()

    if (
      !nomePacoteAntigo ||
      !sessoesTotalAntigo ||
      !clienteSelecionado ||
      !salao
    ) {
      return
    }

    setSalvando(true)

    try {
      const totalNum = parseInt(sessoesTotalAntigo) || 1

      const { error } = await supabase
        .from('pacotes_clientes_resumo')
        .insert({
          cliente_nome: clienteSelecionado.nome,
          servico: nomePacoteAntigo,
          sessoes_total: totalNum,
          sessoes_restantes: totalNum,
          status: 'ativo',
          historico_sessoes: []
        })

      if (error) {
        alert('Erro ao cadastrar pacote antigo: ' + error.message)
        return
      }

      setModalAntigoAberto(false)
      setNomePacoteAntigo('')
      setSessoesTotalAntigo('')

      await carregarPacotesDoCliente(clienteSelecionado.nome)
    } catch (err: any) {
      alert('Erro inesperado: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  // =========================================================
  // REGISTRAR SESSÃO
  // =========================================================

  async function registrarSessaoRealizada(e: React.FormEvent) {
    e.preventDefault()

    if (
      !pacoteAlvoSessao ||
      !clienteSelecionado ||
      !servicoSessao
    ) {
      return
    }

    if (pacoteAlvoSessao.sessoes_restantes <= 0) {
      alert('Este pacote não possui mais sessões restantes.')
      return
    }

    setSalvando(true)

    try {
      const novasRestantes =
        pacoteAlvoSessao.sessoes_restantes - 1

      const novoStatus =
        novasRestantes === 0 ? 'concluido' : 'ativo'

      const novaSessaoObj = {
        id: Math.random().toString(36).substring(2, 9),
        servico: servicoSessao,
        data: dataSessao
      }

      const historicoAtual = Array.isArray(
        pacoteAlvoSessao.historico_sessoes
      )
        ? pacoteAlvoSessao.historico_sessoes
        : []

      const novoHistorico = [
        novaSessaoObj,
        ...historicoAtual
      ]

      const { error: errUp } = await supabase
        .from('pacotes_clientes_resumo')
        .update({
          sessoes_restantes: novasRestantes,
          status: novoStatus,
          historico_sessoes: novoHistorico
        })
        .eq('id', pacoteAlvoSessao.id)

      if (errUp) throw errUp

      setModalSessaoAberto(false)
      setServicoSessao('')
      setDataSessao(
        new Date().toISOString().split('T')[0]
      )
      setPacoteAlvoSessao(null)

      await carregarPacotesDoCliente(
        clienteSelecionado.nome
      )
    } catch (err: any) {
      alert('Erro ao registrar sessão: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  // =========================================================
  // EXCLUIR SESSÃO DO HISTÓRICO
  // =========================================================

  async function excluirSessaoHistorico(
    indexSessao: number,
    pacoteObj: any
  ) {
    if (
      !confirm(
        'Deseja excluir esta sessão e devolver 1 crédito ao pacote?'
      )
    ) {
      return
    }

    const historicoAtual = Array.isArray(
      pacoteObj.historico_sessoes
    )
      ? [...pacoteObj.historico_sessoes]
      : []

    historicoAtual.splice(indexSessao, 1)

    const novasRestantes =
      Number(pacoteObj.sessoes_restantes || 0) + 1

    const novoStatus = 'ativo'

    const { error } = await supabase
      .from('pacotes_clientes_resumo')
      .update({
        sessoes_restantes: novasRestantes,
        status: novoStatus,
        historico_sessoes: historicoAtual
      })
      .eq('id', pacoteObj.id)

    if (error) {
      alert('Erro ao excluir sessão: ' + error.message)
      return
    }

    if (clienteSelecionado) {
      await carregarPacotesDoCliente(
        clienteSelecionado.nome
      )
    }
  }

  // =========================================================
  // EXCLUIR PACOTE DA CLIENTE
  // =========================================================

  async function excluirPacoteCliente(pacoteId: string) {
    if (
      !confirm(
        'Deseja realmente remover este pacote e todo o seu histórico?'
      )
    ) {
      return
    }

    const { error } = await supabase
      .from('pacotes_clientes_resumo')
      .delete()
      .eq('id', pacoteId)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }

    if (clienteSelecionado) {
      await carregarPacotesDoCliente(
        clienteSelecionado.nome
      )
    }
  }

  const cor =
    salao?.cor_primaria || '#E91E8C'

  if (carregando || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{
            borderColor: cor
          }}
        />
      </div>
    )
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nome
      ?.toLowerCase()
      .includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  )

  const navItems = [
    {
      icon: Users,
      label: 'Início',
      href: '/salao'
    },
    {
      icon: CreditCard,
      label: 'Pacotes por Cliente',
      href: '/salao/pacotes/clientes'
    }
  ]

  return (
    <div className="min-h-screen pb-24 bg-gray-50">

      <Header
        profile={profile}
        salaoNome={salao?.nome}
        corPrimaria={cor}
      />

      <div className="px-4 py-5 flex flex-col gap-4 max-w-xl mx-auto">

        {/* =====================================================
            CLIENTE SELECIONADA
        ====================================================== */}

        {clienteSelecionado ? (

          <div className="flex flex-col gap-4">

            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3">

              <button
                onClick={() => {
                  setClienteSelecionado(null)
                  setPacotesCliente([])
                }}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-1 self-start"
              >
                ← Voltar para lista de clientes
              </button>

              <div className="flex items-center justify-between">

                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    {clienteSelecionado.nome}
                  </h1>

                  <p className="text-xs text-gray-500">
                    {clienteSelecionado.telefone ||
                      'Sem telefone'}
                  </p>
                </div>

              </div>

              <div className="flex gap-2 pt-1">

                <button
                  onClick={() =>
                    setModalVenderAberto(true)
                  }
                  className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  <Plus size={16} />
                  Vender Pacote
                </button>

                <button
                  onClick={() =>
                    setModalAntigoAberto(true)
                  }
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 transition"
                >
                  <Calendar size={16} />
                  Pacote Antigo
                </button>

              </div>

            </div>

            <div className="space-y-4">

              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Pacotes da cliente
              </h2>

              {pacotesCliente.length === 0 ? (

                <div className="bg-white p-8 rounded-3xl text-center border border-gray-100 shadow-sm flex flex-col items-center gap-2">

                  <AlertCircle
                    size={32}
                    className="text-gray-300"
                  />

                  <p className="text-gray-500 text-sm">
                    Esta cliente não possui pacotes cadastrados.
                  </p>

                </div>

              ) : (

                pacotesCliente.map(pc => {

                  const nomeServico =
                    pc.servico || 'Pacote'

                  const total =
                    Number(pc.sessoes_total) || 1

                  const restantes =
                    Number(
                      pc.sessoes_restantes
                    ) ?? total

                  const usadas = Math.max(
                    0,
                    total - restantes
                  )

                  const progressoPct =
                    Math.min(
                      100,
                      (usadas / total) * 100
                    )

                  const status =
                    pc.status || 'ativo'

                  const sessoesDoPacote =
                    Array.isArray(
                      pc.historico_sessoes
                    )
                      ? pc.historico_sessoes
                      : []

                  return (

                    <div
                      key={pc.id}
                      className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3"
                    >

                      <div className="flex items-start justify-between">

                        <div>

                          <div className="flex items-center gap-2">

                            <h3 className="font-bold text-gray-900 text-base">
                              {nomeServico}
                            </h3>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                status === 'ativo'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {status}
                            </span>

                          </div>

                        </div>

                        <button
                          onClick={() =>
                            excluirPacoteCliente(
                              pc.id
                            )
                          }
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                          title="Remover pacote"
                        >
                          <Trash2 size={16} />
                        </button>

                      </div>

                      <div className="flex flex-col gap-1.5">

                        <div className="flex justify-between text-xs text-gray-500 font-medium">

                          <span>
                            {usadas} usadas
                          </span>

                          <span>
                            {restantes} restantes
                          </span>

                        </div>

                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">

                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${progressoPct}%`,
                              backgroundColor: cor
                            }}
                          />

                        </div>

                      </div>

                      {/* HISTÓRICO */}

                      <div className="flex flex-col gap-2 pt-2 border-t border-gray-50">

                        <span className="text-xs font-bold text-gray-400">
                          Histórico de sessões
                        </span>

                        {sessoesDoPacote.length === 0 ? (

                          <p className="text-xs text-gray-400 italic">
                            Nenhuma sessão realizada ainda.
                          </p>

                        ) : (

                          <div className="flex flex-col gap-1.5">

                            {sessoesDoPacote.map(
                              (
                                sessao: any,
                                idx: number
                              ) => {

                                const dataFormatada =
                                  sessao.data
                                    ? sessao.data
                                        .split('-')
                                        .reverse()
                                        .join('/')
                                    : ''

                                return (

                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs bg-gray-50 px-3 py-2 rounded-xl"
                                  >

                                    <div className="flex items-center gap-2 text-gray-700 font-medium">

                                      <span className="text-gray-400">
                                        {dataFormatada}
                                      </span>

                                      <span>•</span>

                                      <span>
                                        {sessao.servico}
                                      </span>

                                    </div>

                                    <button
                                      onClick={() =>
                                        excluirSessaoHistorico(
                                          idx,
                                          pc
                                        )
                                      }
                                      className="text-gray-300 hover:text-red-500 p-1 transition"
                                      title="Excluir sessão"
                                    >
                                      <X size={14} />
                                    </button>

                                  </div>

                                )
                              }
                            )}

                          </div>

                        )}

                      </div>

                      {status === 'ativo' &&
                        restantes > 0 && (

                        <button
                          onClick={() => {
                            setPacoteAlvoSessao(pc)
                            setModalSessaoAberto(true)
                          }}
                          className="w-full border py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 mt-1"
                          style={{
                            borderColor: cor,
                            color: cor
                          }}
                        >
                          <Plus size={16} />
                          Adicionar sessão realizada
                        </button>

                      )}

                      <div className="text-[11px] text-gray-400 pt-1 border-t border-gray-50 flex justify-between">

                        <span>
                          Vendido por:{' '}
                          <span className="font-medium text-gray-600">
                            {profile?.nome ||
                              'Sistema'}
                          </span>
                        </span>

                        <span>
                          Criado em:{' '}
                          <span className="font-medium text-gray-600">
                            {pc.created_at
                              ? new Date(
                                  pc.created_at
                                ).toLocaleDateString(
                                  'pt-BR'
                                )
                              : '-'}
                          </span>
                        </span>

                      </div>

                    </div>

                  )
                })

              )}

            </div>

          </div>

        ) : (

          /* =====================================================
             LISTA DE CLIENTES
          ====================================================== */

          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-3 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">

              <div className="flex items-center justify-between">

                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    Pacotes por Cliente
                  </h1>

                  <p className="text-xs text-gray-500">
                    Selecione uma cliente para gerenciar os pacotes
                  </p>
                </div>

                <button
                  onClick={() =>
                    setModalNovoClienteAberto(true)
                  }
                  className="text-white px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  <UserPlus size={16} />
                  Novo Cliente
                </button>

              </div>

              <div className="relative">

                <Search
                  size={16}
                  className="absolute left-3.5 top-3.5 text-gray-400"
                />

                <input
                  type="text"
                  placeholder="Buscar cliente por nome ou telefone..."
                  value={busca}
                  onChange={e =>
                    setBusca(e.target.value)
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-xs outline-none placeholder-gray-400"
                />

              </div>

            </div>

            <div className="flex flex-col gap-2">

              {clientesFiltrados.length === 0 ? (

                <div className="bg-white p-8 rounded-3xl text-center border border-gray-100 shadow-sm flex flex-col items-center gap-2">

                  <Users
                    size={32}
                    className="text-gray-300"
                  />

                  <p className="text-gray-500 text-sm">
                    Nenhuma cliente encontrada.
                  </p>

                </div>

              ) : (

                clientesFiltrados.map(cliente => (

                  <div
                    key={cliente.id}
                    onClick={() =>
                      abrirDetalhesCliente(
                        cliente
                      )
                    }
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-3 cursor-pointer hover:border-pink-300 transition"
                  >

                    <div className="flex items-center gap-3">

                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs uppercase shrink-0"
                        style={{
                          backgroundColor: cor
                        }}
                      >
                        {cliente.nome
                          ? cliente.nome[0]
                          : 'C'}
                      </div>

                      <div>

                        <h3 className="font-bold text-gray-900 text-sm">
                          {cliente.nome}
                        </h3>

                        <p className="text-xs text-gray-400">
                          {cliente.telefone ||
                            'Sem telefone'}
                        </p>

                      </div>

                    </div>

                    <ChevronRight
                      size={18}
                      className="text-gray-400"
                    />

                  </div>

                ))

              )}

            </div>

          </div>

        )}

      </div>

      {/* =====================================================
          MODAL NOVO CLIENTE
      ====================================================== */}

      {modalNovoClienteAberto && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">

          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100">

            <div className="flex items-center justify-between">

              <h3 className="text-base font-bold text-gray-900">
                Novo Cliente
              </h3>

              <button
                onClick={() =>
                  setModalNovoClienteAberto(false)
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={
                cadastrarNovoClienteRapido
              }
              className="flex flex-col gap-3"
            >

              <div className="flex flex-col gap-1.5">

                <label className="text-xs font-semibold text-gray-900">
                  Nome completo
                </label>

                <input
                  type="text"
                  placeholder="Nome da cliente"
                  value={nomeNovoCliente}
                  onChange={e =>
                    setNomeNovoCliente(
                      e.target.value
                    )
                  }
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none"
                />

              </div>

              <div className="flex flex-col gap-1.5">

                <label className="text-xs font-semibold text-gray-900">
                  Telefone / WhatsApp (Opcional)
                </label>

                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={telefoneNovoCliente}
                  onChange={e =>
                    setTelefoneNovoCliente(
                      e.target.value
                    )
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none"
                />

              </div>

              <div className="flex gap-2 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setModalNovoClienteAberto(false)
                  }
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  {salvando
                    ? 'Salvando...'
                    : 'Cadastrar'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================
          MODAL VENDER PACOTE
      ====================================================== */}

      {modalVenderAberto &&
        clienteSelecionado && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">

          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100">

            <div className="flex items-center justify-between">

              <h3 className="text-base font-bold text-gray-900">
                Vender Pacote
              </h3>

              <button
                onClick={() =>
                  setModalVenderAberto(false)
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={venderPacote}
              className="flex flex-col gap-3"
            >

              <div className="flex flex-col gap-1.5">

                <label className="text-xs font-semibold text-gray-900">
                  Selecione o Pacote
                </label>

                <select
                  value={pacoteEscolhido}
                  onChange={e =>
                    setPacoteEscolhido(
                      e.target.value
                    )
                  }
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none text-gray-700"
                >

                  <option value="">
                    Selecione...
                  </option>

                  {pacotesDisponiveis.map(p => {

                    /*
                     * CORREÇÃO:
                     * Prioriza sessoes_inclusas.
                     *
                     * Assim a quantidade exibida no seletor
                     * é a mesma quantidade configurada na
                     * página de gerenciamento de pacotes.
                     */
                    const numSessoes = Number(
                      p.sessoes_inclusas ??
                      p.sessoes ??
                      p.sessoes_total ??
                      p.quantidade ??
                      p.total_sessoes ??
                      1
                    )

                    return (

                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {p.nome} ({numSessoes}{' '}
                        {numSessoes === 1
                          ? 'sessão'
                          : 'sessões'})
                      </option>

                    )
                  })}

                </select>

              </div>

              <div className="flex gap-2 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setModalVenderAberto(false)
                  }
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  {salvando
                    ? 'Salvando...'
                    : 'Vender'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================
          MODAL PACOTE ANTIGO
      ====================================================== */}

      {modalAntigoAberto &&
        clienteSelecionado && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">

          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100">

            <div className="flex items-center justify-between">

              <h3 className="text-base font-bold text-gray-900">
                Cadastrar Pacote Antigo
              </h3>

              <button
                onClick={() =>
                  setModalAntigoAberto(false)
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={cadastrarPacoteAntigo}
              className="flex flex-col gap-3"
            >

              <div className="flex flex-col gap-1.5">

                <label className="text-xs font-semibold text-gray-900">
                  Nome do Pacote
                </label>

                <input
                  type="text"
                  placeholder="Ex: 4 mãos e 1 pé"
                  value={nomePacoteAntigo}
                  onChange={e =>
                    setNomePacoteAntigo(
                      e.target.value
                    )
                  }
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none"
                />

              </div>

              <div className="flex flex-col gap-1.5">

                <label className="text-xs font-semibold text-gray-900">
                  Total de Sessões
                </label>

                <input
                  type="number"
                  min="1"
                  placeholder="Ex: 5"
                  value={sessoesTotalAntigo}
                  onChange={e =>
                    setSessoesTotalAntigo(
                      e.target.value
                    )
                  }
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none"
                />

              </div>

              <div className="flex gap-2 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setModalAntigoAberto(false)
                  }
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  {salvando
                    ? 'Salvando...'
                    : 'Cadastrar'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================
          MODAL ADICIONAR SESSÃO
      ====================================================== */}

      {modalSessaoAberto &&
        pacoteAlvoSessao && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">

          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100">

            <div className="flex items-center justify-between">

              <h3 className="text-base font-bold text-gray-900">
                Adicionar Sessão Realizada
              </h3>

              <button
                onClick={() =>
                  setModalSessaoAberto(false)
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={
                registrarSessaoRealizada
              }
              className="flex flex-col gap-3"
            >

              <div className="flex flex-col gap-1.5">

                <label className="text-xs font-semibold text-gray-900">
                  Serviço Realizado
                </label>

                <input
                  type="text"
                  placeholder="Ex: Manicure ou Pedicure"
                  value={servicoSessao}
                  onChange={e =>
                    setServicoSessao(
                      e.target.value
                    )
                  }
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none"
                />

              </div>

              <div className="flex flex-col gap-1.5">

                <label className="text-xs font-semibold text-gray-900">
                  Data da Sessão
                </label>

                <input
                  type="date"
                  value={dataSessao}
                  onChange={e =>
                    setDataSessao(
                      e.target.value
                    )
                  }
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none"
                />

              </div>

              <div className="flex gap-2 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setModalSessaoAberto(false)
                  }
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  {salvando
                    ? 'Salvando...'
                    : 'Adicionar'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      <BottomNav
        items={navItems}
        corPrimaria={cor}
      />

    </div>
  )
}