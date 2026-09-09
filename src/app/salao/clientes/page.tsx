// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import {
  ArrowLeft,
  Search,
  Plus,
  User,
  Phone,
  ChevronRight,
  MessageSquare,
  Check,
  X,
  Clock,
  GitMerge,
  Edit3,
  Save,
  CheckSquare,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

export default function ClientesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'pendentes' | 'duplicados'>('ativos')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  // Mesclagem
  const [processandoMesclagem, setProcessandoMesclagem] = useState(false)
  const [clientesSelecionados, setClientesSelecionados] = useState<string[]>([])
  const [modalMesclagemAberto, setModalMesclagemAberto] = useState(false)
  const [clientePrincipalMesclagem, setClientePrincipalMesclagem] = useState<string | null>(null)
  const [erroMesclagem, setErroMesclagem] = useState('')

  // Novo cliente
  const [modalAberto, setModalAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [aniversario, setAniversario] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Edição
  const [clienteEditando, setClienteEditando] = useState<any | null>(null)
  const [novoNomeEdicao, setNovoNomeEdicao] = useState('')
  const [novoTelefoneEdicao, setNovoTelefoneEdicao] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const cor = salao?.cor_primaria || '#E91E8C'

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    if (profile.salao_id) {
      carregarDados()
    }
  }, [loading, profile])

  async function carregarDados() {
    if (!profile?.salao_id) return

    setCarregando(true)

    try {
      const [{ data: sal }, { data: todos, error }] = await Promise.all([
        supabase
          .from('saloes')
          .select('*')
          .eq('id', profile.salao_id)
          .single(),

        supabase
          .from('clientes')
          .select('*')
          .eq('salao_id', profile.salao_id)
          .order('nome', { ascending: true }),
      ])

      setSalao(sal)

      if (error) {
        console.error('Erro ao carregar clientes:', error)
        setClientes([])
        setSolicitacoes([])
        return
      }

      const lista = todos || []

      // "ignorar_duplicado" NÃO remove o cliente dos cadastrados.
      // Ele somente impede que o cliente volte para as sugestões.
      setSolicitacoes(lista.filter(c => c.status === 'pendente'))
      setClientes(lista.filter(c => c.status !== 'pendente'))

      setClientesSelecionados(prev =>
        prev.filter(id => lista.some(c => c.id === id))
      )
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      setClientes([])
      setSolicitacoes([])
    } finally {
      setCarregando(false)
    }
  }

  function normalizarNome(texto: string) {
    if (!texto) return ''

    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  function obterGruposDuplicados() {
    const gruposMap: Record<string, any[]> = {}

    clientes
      .filter(cliente => cliente.ignorar_duplicado !== true)
      .forEach(cliente => {
        if (!cliente.nome) return

        const nomeNorm = normalizarNome(cliente.nome)
        const partes = nomeNorm.split(/\s+/).filter(Boolean)
        if (!partes.length) return

        const primeiroNome = partes[0]

        if (!gruposMap[primeiroNome]) {
          gruposMap[primeiroNome] = []
        }

        gruposMap[primeiroNome].push(cliente)
      })

    const resultado: { chaveGrupo: string; clientes: any[] }[] = []

    Object.keys(gruposMap).forEach(primeiroNome => {
      const lista = gruposMap[primeiroNome]
      if (lista.length < 2) return

      const subGrupos: any[][] = []

      lista.forEach(cliente => {
        const palavrasCliente = normalizarNome(cliente.nome).split(/\s+/)
        let alocado = false

        for (const grupo of subGrupos) {
          const representante = grupo[0]
          const palavrasRep = normalizarNome(representante.nome).split(/\s+/)

          const semelhante = palavrasCliente.some((pC, idxC) =>
            palavrasRep.some((pR, idxR) => {
              if (idxC === 0 && idxR === 0) return true

              if (pC === pR) return true

              if (
                pC.length > 3 &&
                pR.length > 3 &&
                (pC.startsWith(pR.slice(0, 3)) || pR.startsWith(pC.slice(0, 3)))
              ) {
                return true
              }

              return false
            })
          )

          if (semelhante) {
            grupo.push(cliente)
            alocado = true
            break
          }
        }

        if (!alocado) {
          subGrupos.push([cliente])
        }
      })

      subGrupos.forEach(grupo => {
        if (grupo.length > 1) {
          resultado.push({
            chaveGrupo: primeiroNome.toUpperCase(),
            clientes: grupo,
          })
        }
      })
    })

    return resultado
  }

  const gruposDuplicados = useMemo(
    () => obterGruposDuplicados(),
    [clientes]
  )

  async function ignorarDuplicado(clienteId: string) {
    if (!profile?.salao_id) return

    const { error } = await supabase
      .from('clientes')
      .update({ ignorar_duplicado: true })
      .eq('id', clienteId)
      .eq('salao_id', profile.salao_id)

    if (error) {
      console.error('Erro ao ignorar duplicado:', error)

      notificar({
        salaoId: profile.salao_id,
        remetenteId: profile.id,
        destinatarioId: profile.id,
        titulo: 'Erro',
        mensagem: `Não foi possível retirar o cliente das sugestões: ${error.message}`,
        tipo: 'sistema',
      })

      return
    }

    await carregarDados()
  }

  function alternarSelecaoCliente(clienteId: string) {
    setClientesSelecionados(prev =>
      prev.includes(clienteId)
        ? prev.filter(id => id !== clienteId)
        : [...prev, clienteId]
    )
  }

  const clientesFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim()

    if (!termo) return clientes

    return clientes.filter(cliente =>
      cliente.nome?.toLowerCase().includes(termo) ||
      cliente.telefone?.includes(termo)
    )
  }, [clientes, busca])

  const todosVisiveisSelecionados =
    clientesFiltrados.length > 0 &&
    clientesFiltrados.every(cliente =>
      clientesSelecionados.includes(cliente.id)
    )

  function selecionarTodosVisiveis() {
    const ids = clientesFiltrados.map(cliente => cliente.id)

    if (todosVisiveisSelecionados) {
      setClientesSelecionados(prev =>
        prev.filter(id => !ids.includes(id))
      )
    } else {
      setClientesSelecionados(prev => [
        ...prev,
        ...ids.filter(id => !prev.includes(id)),
      ])
    }
  }

  const clientesSelecionadosObjetos = clientes.filter(cliente =>
    clientesSelecionados.includes(cliente.id)
  )

  function abrirModalMesclagemManual() {
    if (clientesSelecionados.length < 2) return

    setErroMesclagem('')
    setClientePrincipalMesclagem(clientesSelecionados[0])
    setModalMesclagemAberto(true)
  }

  function cancelarMesclagemManual() {
    if (processandoMesclagem) return

    setModalMesclagemAberto(false)
    setClientePrincipalMesclagem(null)
    setErroMesclagem('')
  }

  /*
   * Executa uma etapa da mesclagem e transforma o erro em uma
   * mensagem legível. Isso evita o antigo comportamento em que
   * o botão ficava simplesmente em "Mesclando...".
   */
  async function executarEtapa(
    tabela: string,
    descricao: string,
    duplicadoId: string,
    principalId: string
  ) {
    const { error } = await supabase
      .from(tabela)
      .update({ cliente_id: principalId })
      .eq('cliente_id', duplicadoId)

    if (error) {
      throw new Error(
        `${descricao}: ${error.message}`
      )
    }
  }

  /*
   * MESCLAGEM COMPLETA
   *
   * A ordem é proposital:
   * 1. Remove sugestões que apontam para o duplicado.
   * 2. Transfere todos os registros das tabelas filhas.
   * 3. Só então exclui o cadastro duplicado.
   *
   * Não usamos ON DELETE CASCADE para "resolver" a mesclagem,
   * porque isso poderia apagar histórico que deveria ser preservado.
   */
  async function executarMesclagem(
    grupoClientes: any[],
    clientePrincipalId: string
  ) {
    if (processandoMesclagem) return false
    if (!profile?.salao_id) return false
    if (!clientePrincipalId || grupoClientes.length < 2) return false

    const principal = grupoClientes.find(
      cliente => cliente.id === clientePrincipalId
    )

    if (!principal) {
      setErroMesclagem('O cadastro principal não foi encontrado.')
      return false
    }

    const duplicados = grupoClientes.filter(
      cliente => cliente.id !== clientePrincipalId
    )

    setProcessandoMesclagem(true)
    setErroMesclagem('')

    try {
      for (const duplicado of duplicados) {
        /*
         * Essas sugestões não são histórico da cliente.
         * Elas só existem para indicar possíveis duplicidades.
         * Precisam ser removidas antes da exclusão do cliente,
         * pois suas FKs não possuem ON DELETE CASCADE.
         */
        const { error: erroSugestaoNovo } = await supabase
          .from('sugestoes_mesclagem')
          .delete()
          .eq('cliente_novo_id', duplicado.id)

        if (erroSugestaoNovo) {
          throw new Error(
            `Não foi possível limpar as sugestões de mesclagem (cliente_novo_id): ${erroSugestaoNovo.message}`
          )
        }

        const { error: erroSugestaoPendente } = await supabase
          .from('sugestoes_mesclagem')
          .delete()
          .eq('cliente_pendente_id', duplicado.id)

        if (erroSugestaoPendente) {
          throw new Error(
            `Não foi possível limpar as sugestões de mesclagem (cliente_pendente_id): ${erroSugestaoPendente.message}`
          )
        }

        // Relações reais encontradas no banco.
        const etapas = [
          ['agendamentos', 'Não foi possível transferir os agendamentos'],
          ['contas_clientes', 'Não foi possível transferir as contas do cliente'],
          ['contratos', 'Não foi possível transferir os contratos'],
          ['depoimentos', 'Não foi possível transferir os depoimentos'],
          ['duvidas', 'Não foi possível transferir as dúvidas'],
          ['evolucao_fotos', 'Não foi possível transferir as fotos de evolução'],
          ['evolucao_registros', 'Não foi possível transferir os registros de evolução'],
          ['evolucoes', 'Não foi possível transferir as evoluções'],
          ['horarios_vagos', 'Não foi possível transferir os horários vagos'],
          ['respostas_anamnese', 'Não foi possível transferir as respostas de anamnese'],
          ['series_recorrentes', 'Não foi possível transferir as séries recorrentes'],
          ['solicitacoes_agendamento', 'Não foi possível transferir as solicitações de agendamento'],
          ['solicitacoes_orcamento', 'Não foi possível transferir as solicitações de orçamento'],
          ['historico_cliente', 'Não foi possível transferir o histórico do cliente'],
        ]

        for (const [tabela, descricao] of etapas) {
          await executarEtapa(
            tabela,
            descricao,
            duplicado.id,
            principal.id
          )
        }
      }
        /*
         * Só depois de todas as transferências concluírem,
         * excluímos os cadastros duplicados.
         */
        for (const duplicado of duplicados) {
          const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', duplicado.id)
            .eq('salao_id', profile.salao_id)

          if (error) {
            throw new Error(
              `Os dados foram transferidos, mas não foi possível excluir o cadastro duplicado "${duplicado.nome}": ${error.message}`
            )
          }
        }

        notificar({
          salaoId: profile.salao_id,
          remetenteId: profile.id,
          destinatarioId: profile.id,
          titulo: 'Mesclagem concluída',
          mensagem: `${duplicados.length} cadastro(s) foram mesclados em "${principal.nome}".`,
          tipo: 'sistema',
        })

        return true
      } catch (error: any) {
        console.error('Erro completo na mesclagem:', error)

        const mensagem =
          error?.message ||
          'Não foi possível concluir a mesclagem.'

        setErroMesclagem(mensagem)

        notificar({
          salaoId: profile.salao_id,
          remetenteId: profile.id,
          destinatarioId: profile.id,
          titulo: 'Erro na mesclagem',
          mensagem,
          tipo: 'sistema',
        })

        return false
      } finally {
        setProcessandoMesclagem(false)
      }
    }

    async function confirmarMesclagemManual() {
      if (processandoMesclagem) return
      if (clientesSelecionados.length < 2) return
      if (!clientePrincipalMesclagem) return

      const selecionados = clientes.filter(cliente =>
        clientesSelecionados.includes(cliente.id)
      )

      if (selecionados.length < 2) {
        setErroMesclagem('Selecione pelo menos dois clientes.')
        return
      }

      const principal = selecionados.find(
        cliente => cliente.id === clientePrincipalMesclagem
      )

      if (!principal) {
        setErroMesclagem('Escolha o cadastro principal.')
        return
      }

      const confirmar = window.confirm(
        `Tem certeza que deseja mesclar ${selecionados.length} clientes no cadastro "${principal.nome}"?\n\nTodos os históricos relacionados aos outros cadastros serão transferidos para o principal e os cadastros duplicados serão excluídos.\n\nEssa ação não poderá ser desfeita.`
      )

      if (!confirmar) return

      const sucesso = await executarMesclagem(
        selecionados,
        clientePrincipalMesclagem
      )

      if (sucesso) {
        setClientesSelecionados([])
        setModalMesclagemAberto(false)
        setClientePrincipalMesclagem(null)
        setErroMesclagem('')
        await carregarDados()
      }
    }

    async function mesclarGrupo(
      grupoClientes: any[],
      clientePrincipalId: string
    ) {
      if (processandoMesclagem) return

      const confirmar = window.confirm(
        `Deseja mesclar estes ${grupoClientes.length} cadastros?\n\n"${grupoClientes.find(c => c.id === clientePrincipalId)?.nome || 'Cliente'}" será mantido como principal e os demais cadastros serão excluídos após a transferência dos dados.\n\nEssa ação não poderá ser desfeita.`
      )

      if (!confirmar) return

      const sucesso = await executarMesclagem(
        grupoClientes,
        clientePrincipalId
      )

      if (sucesso) {
        setClientesSelecionados([])
        await carregarDados()
      }
    }

    async function aceitarSolicitacao(id: string) {
      if (!profile?.salao_id) return

      const { error } = await supabase
        .from('clientes')
        .update({ status: 'ativo' })
        .eq('id', id)
        .eq('salao_id', profile.salao_id)

      if (error) {
        notificar({
          salaoId: profile.salao_id,
          remetenteId: profile.id,
          destinatarioId: profile.id,
          titulo: 'Erro',
          mensagem: `Não foi possível aprovar o cadastro: ${error.message}`,
          tipo: 'sistema',
        })
        return
      }

      await carregarDados()

      notificar({
        salaoId: profile.salao_id,
        remetenteId: profile.id,
        destinatarioId: profile.id,
        titulo: 'Cliente aprovado',
        mensagem: 'O cadastro do cliente foi aceito com sucesso.',
        tipo: 'sistema',
      })
    }

    async function recusarSolicitacao(id: string) {
      if (!profile?.salao_id) return

      const confirmar = window.confirm(
        'Deseja realmente recusar esta solicitação?'
      )

      if (!confirmar) return

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)
        .eq('salao_id', profile.salao_id)

      if (error) {
        notificar({
          salaoId: profile.salao_id,
          remetenteId: profile.id,
          destinatarioId: profile.id,
          titulo: 'Erro',
          mensagem: `Não foi possível recusar a solicitação: ${error.message}`,
          tipo: 'sistema',
        })
        return
      }

      await carregarDados()
    }

    async function salvarEdicaoCliente(e: React.FormEvent) {
      e.preventDefault()

      if (!profile?.salao_id) return
      if (!clienteEditando || !novoNomeEdicao.trim()) return

      setSalvandoEdicao(true)

      const { error } = await supabase
        .from('clientes')
        .update({
          nome: novoNomeEdicao.trim(),
          telefone: novoTelefoneEdicao.trim() || null,
        })
        .eq('id', clienteEditando.id)
        .eq('salao_id', profile.salao_id)

      if (error) {
        console.error(error)

        notificar({
          salaoId: profile.salao_id,
          remetenteId: profile.id,
          destinatarioId: profile.id,
          titulo: 'Erro',
          mensagem: `Não foi possível atualizar o cliente: ${error.message}`,
          tipo: 'sistema',
        })
      } else {
        setClienteEditando(null)
        await carregarDados()

        notificar({
          salaoId: profile.salao_id,
          remetenteId: profile.id,
          destinatarioId: profile.id,
          titulo: 'Cliente atualizado',
          mensagem: 'Os dados do cliente foram alterados com sucesso.',
          tipo: 'sistema',
        })
      }

      setSalvandoEdicao(false)
    }

    async function cadastrarCliente(e: React.FormEvent) {
      e.preventDefault()

      if (!profile?.salao_id) return

      if (!nome.trim()) {
        notificar({
          salaoId: profile.salao_id,
          remetenteId: profile.id,
          destinatarioId: profile.id,
          titulo: 'Atenção',
          mensagem: 'O nome do cliente é obrigatório.',
          tipo: 'sistema',
        })
        return
      }

      setSalvando(true)

      const { error } = await supabase
        .from('clientes')
        .insert({
          salao_id: profile.salao_id,
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          aniversario: aniversario || null,
          observacoes: observacoes.trim() || null,
          status: 'ativo',
        })

      if (error) {
        console.error(error)

        notificar({
          salaoId: profile.salao_id,
          remetenteId: profile.id,
          destinatarioId: profile.id,
          titulo: 'Erro',
          mensagem: `Não foi possível cadastrar o cliente: ${error.message}`,
          tipo: 'sistema',
        })
      } else {
        setModalAberto(false)
        setNome('')
        setTelefone('')
        setEmail('')
        setAniversario('')
        setObservacoes('')
        await carregarDados()
      }

      setSalvando(false)
    }

    const p = profile as any

    const isFuncionarioComum =
      p?.tipo === 'funcionario' ||
      p?.nivel === 'funcionario' ||
      p?.cargo === 'funcionario'

    return (
      <div className="min-h-screen bg-[#f8f9fa] pb-24">

        {/* CABEÇALHO */}
        <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}>
              <ArrowLeft size={22} className="text-gray-700" />
            </button>

            <h1 className="font-bold text-gray-900 text-lg">
              Clientes
            </h1>
          </div>

          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold shadow-sm"
            style={{ backgroundColor: cor }}
          >
            <Plus size={16} />
            Novo Cliente
          </button>
        </div>

        {/* ABAS */}
        <div className="flex bg-white border-b border-gray-100 px-4">
          {[
            ['ativos', `Cadastrados (${clientes.length})`],
            ['pendentes', 'Solicitações'],
            ['duplicados', 'Duplicados'],
          ].map(([aba, label]) => (
            <button
              key={aba}
              onClick={() => setAbaAtiva(aba as any)}
              className={`flex-1 py-3 text-xs font-bold border-b-2 relative ${
                abaAtiva === aba ? '' : 'text-gray-400 border-transparent'
              }`}
              style={
                abaAtiva === aba
                  ? { color: cor, borderColor: cor }
                  : {}
              }
            >
              {label}

              {aba === 'pendentes' && solicitacoes.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] text-white bg-red-500">
                  {solicitacoes.length}
                </span>
              )}

              {aba === 'duplicados' && gruposDuplicados.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] text-white bg-amber-500">
                  {gruposDuplicados.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">

          {/* CLIENTES */}
          {abaAtiva === 'ativos' && (
            <>
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  className="input-field pl-10 text-sm bg-white"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>

              {isFuncionarioComum && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-xs text-blue-700 font-medium text-center">
                    👁️ Modo de visualização: Você pode consultar os cadastros e abrir os prontuários.
                  </p>
                </div>
              )}

              {clientesFiltrados.length > 0 && (
                <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm">
                  <button
                    onClick={selecionarTodosVisiveis}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-600"
                  >
                    {todosVisiveisSelecionados ? (
                      <CheckSquare size={17} style={{ color: cor }} />
                    ) : (
                      <div className="w-[17px] h-[17px] rounded border-2 border-gray-300" />
                    )}

                    {todosVisiveisSelecionados
                      ? 'Desmarcar todos'
                      : 'Selecionar clientes'}
                  </button>

                  {clientesSelecionados.length > 0 && (
                    <span
                      className="text-xs font-bold"
                      style={{ color: cor }}
                    >
                      {clientesSelecionados.length} selecionado
                      {clientesSelecionados.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              {clientesSelecionados.length > 0 && (
                <div
                  className="bg-white border rounded-2xl p-3 shadow-sm flex items-center justify-between gap-3"
                  style={{ borderColor: `${cor}40` }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: `${cor}15`,
                        color: cor,
                      }}
                    >
                      <GitMerge size={17} />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {clientesSelecionados.length} clientes selecionados
                      </p>

                      <p className="text-[10px] text-gray-400">
                        Selecione pelo menos 2 para mesclar
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={abrirModalMesclagemManual}
                    disabled={
                      clientesSelecionados.length < 2 ||
                      processandoMesclagem
                    }
                    className="px-3 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                    style={{ backgroundColor: cor }}
                  >
                    <GitMerge size={14} />
                    Mesclar
                  </button>
                </div>
              )}

              {carregando ? (
                <div className="flex justify-center py-12">
                  <Loader2
                    size={26}
                    className="animate-spin"
                    style={{ color: cor }}
                  />
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="card text-center py-12">
                  <User size={36} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">
                    Nenhum cliente encontrado.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {clientesFiltrados.map(cliente => {
                    const selecionado = clientesSelecionados.includes(cliente.id)

                    return (
                      <div
                        key={cliente.id}
                        onClick={() => router.push(`/clientes/${cliente.id}`)}
                        className={`bg-white border shadow-sm rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all ${
                          selecionado
                            ? 'border-2'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                        style={
                          selecionado
                            ? { borderColor: cor }
                            : {}
                        }
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              alternarSelecaoCliente(cliente.id)
                            }}
                            className="shrink-0"
                          >
                            {selecionado ? (
                              <div
                                className="w-5 h-5 rounded-md flex items-center justify-center text-white"
                                style={{ backgroundColor: cor }}
                              >
                                <Check size={14} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-md border-2 border-gray-300 bg-white" />
                            )}
                          </button>

                          <div
                            className="w-10 h-10 rounded-full flex items-center font-bold text-white text-sm justify-center shrink-0"
                            style={{ backgroundColor: cor }}
                          >
                            {cliente.nome?.charAt(0).toUpperCase() || 'C'}
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">
                              {cliente.nome}
                            </p>

                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone size={12} />
                              {cliente.telefone || 'Sem telefone'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setClienteEditando(cliente)
                              setNovoNomeEdicao(cliente.nome || '')
                              setNovoTelefoneEdicao(cliente.telefone || '')
                            }}
                            className="w-8 h-8 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center"
                            title="Editar nome/telefone"
                          >
                            <Edit3 size={14} />
                          </button>

                          {cliente.telefone && (
                            <a
                              href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center"
                            >
                              <MessageSquare size={14} />
                            </a>
                          )}

                          <ChevronRight size={18} className="text-gray-300" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        {/* SOLICITAÇÕES */}
        {abaAtiva === 'pendentes' && (
          <div className="flex flex-col gap-3">
            {solicitacoes.length === 0 ? (
              <div className="card text-center py-12">
                <Clock size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">
                  Nenhuma solicitação de cadastro pendente.
                </p>
              </div>
            ) : (
              solicitacoes.map(sol => (
                <div
                  key={sol.id}
                  className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center font-bold text-white text-sm justify-center shrink-0"
                        style={{ backgroundColor: cor }}
                      >
                        {sol.nome?.charAt(0).toUpperCase() || 'C'}
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">
                          {sol.nome}
                        </p>

                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone size={12} />
                          {sol.telefone || 'Sem telefone'}
                        </p>

                        {sol.email && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {sol.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setClienteEditando(sol)
                        setNovoNomeEdicao(sol.nome || '')
                        setNovoTelefoneEdicao(sol.telefone || '')
                      }}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      <Edit3 size={12} />
                      Editar
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => aceitarSolicitacao(sol.id)}
                      className="flex-1 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: cor }}
                    >
                      <Check size={14} />
                      Aceitar Cadastro
                    </button>

                    <button
                      onClick={() => recusarSolicitacao(sol.id)}
                      className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <X size={14} />
                      Recusar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* DUPLICADOS */}
        {abaAtiva === 'duplicados' && (
          <div className="flex flex-col gap-4">
            {gruposDuplicados.length === 0 ? (
              <div className="card text-center py-12">
                <GitMerge size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">
                  Nenhum cliente com nome semelhante encontrado para mesclagem.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-800 font-medium text-center">
                    ⚠️ Encontramos cadastros com nomes semelhantes. Escolha qual será o
                    registro principal para unificar os históricos ou clique no X para
                    informar que aquele cadastro não é duplicado.
                  </p>
                </div>

                {gruposDuplicados.map((grupo, idx) => (
                  <div
                    key={`${grupo.chaveGrupo}-${idx}`}
                    className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="text-xs font-bold text-gray-500 uppercase">
                        Grupo: "{grupo.chaveGrupo}"
                      </span>

                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                        {grupo.clientes.length} cadastros
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {grupo.clientes.map(cli => (
                        <div
                          key={cli.id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-8 h-8 rounded-full flex items-center font-bold text-white text-xs justify-center shrink-0"
                              style={{ backgroundColor: cor }}
                            >
                              {cli.nome?.charAt(0).toUpperCase() || 'C'}
                            </div>

                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-xs truncate">
                                {cli.nome}
                              </p>

                              <p className="text-[11px] text-gray-400 truncate">
                                {cli.telefone || 'Sem telefone'}
                                {cli.email ? ` • ${cli.email}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setClienteEditando(cli)
                                setNovoNomeEdicao(cli.nome || '')
                                setNovoTelefoneEdicao(cli.telefone || '')
                              }}
                              className="px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs"
                              title="Editar"
                            >
                              <Edit3 size={12} />
                            </button>

                            <button
                              onClick={() => ignorarDuplicado(cli.id)}
                              className="px-2 py-1.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs"
                              title="Não é duplicado"
                            >
                              <X size={14} />
                            </button>

                            <button
                              onClick={() =>
                                mesclarGrupo(grupo.clientes, cli.id)
                              }
                              disabled={processandoMesclagem}
                              className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                              style={{ backgroundColor: cor }}
                            >
                              {processandoMesclagem ? (
                                <Loader2
                                  size={12}
                                  className="animate-spin"
                                />
                              ) : (
                                <GitMerge size={12} />
                              )}

                              {processandoMesclagem
                                ? 'Mesclando...'
                                : 'Manter este'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL DE MESCLAGEM MANUAL */}
      {modalMesclagemAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  Mesclar clientes
                </h3>

                <p className="text-xs text-gray-400 mt-1">
                  Escolha qual cadastro será mantido como principal.
                </p>
              </div>

              <button
                onClick={cancelarMesclagemManual}
                disabled={processandoMesclagem}
              >
                <span className="text-gray-400 text-xl font-bold">
                  ×
                </span>
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex gap-2">
                <AlertTriangle
                  size={16}
                  className="text-amber-600 shrink-0 mt-0.5"
                />

                <p className="text-xs text-amber-800">
                  Todos os registros vinculados aos outros cadastros serão
                  transferidos para o principal. Os duplicados serão excluídos
                  somente depois da transferência.
                </p>
              </div>
            </div>

            {erroMesclagem && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-red-700">
                  Não foi possível concluir a mesclagem:
                </p>

                <p className="text-xs text-red-600 mt-1 break-words">
                  {erroMesclagem}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-600 uppercase">
                Cadastro principal
              </p>

              {clientesSelecionadosObjetos.map(cliente => {
                const principal =
                  clientePrincipalMesclagem === cliente.id

                return (
                  <button
                    key={cliente.id}
                    type="button"
                    disabled={processandoMesclagem}
                    onClick={() =>
                      setClientePrincipalMesclagem(cliente.id)
                    }
                    className={`w-full text-left p-3 rounded-2xl border-2 transition-all ${
                      principal
                        ? ''
                        : 'border-gray-100 bg-gray-50'
                    } disabled:opacity-70`}
                    style={
                      principal
                        ? {
                            borderColor: cor,
                            backgroundColor: `${cor}08`,
                          }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                        style={{ backgroundColor: cor }}
                      >
                        {cliente.nome?.charAt(0).toUpperCase() || 'C'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">
                          {cliente.nome}
                        </p>

                        <p className="text-xs text-gray-400 mt-0.5">
                          {cliente.telefone || 'Sem telefone'}
                        </p>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          principal
                            ? 'border-transparent'
                            : 'border-gray-300'
                        }`}
                        style={
                          principal
                            ? { backgroundColor: cor }
                            : {}
                        }
                      >
                        {principal && (
                          <Check
                            size={13}
                            className="text-white"
                          />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3 mt-1">
              <button
                type="button"
                onClick={cancelarMesclagemManual}
                disabled={processandoMesclagem}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarMesclagemManual}
                disabled={
                  processandoMesclagem ||
                  !clientePrincipalMesclagem ||
                  clientesSelecionados.length < 2
                }
                className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ backgroundColor: cor }}
              >
                {processandoMesclagem ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Mesclando...
                  </>
                ) : (
                  <>
                    <GitMerge size={16} />
                    Mesclar clientes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {clienteEditando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                Editar Cadastro
              </h3>

              <button
                onClick={() => setClienteEditando(null)}
              >
                <span className="text-gray-400 text-xl font-bold">
                  ×
                </span>
              </button>
            </div>

            <form
              onSubmit={salvarEdicaoCliente}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Nome do Cliente *
                </label>

                <input
                  type="text"
                  required
                  className="input-field text-sm"
                  value={novoNomeEdicao}
                  onChange={e => setNovoNomeEdicao(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Telefone / WhatsApp
                </label>

                <input
                  type="text"
                  className="input-field text-sm"
                  value={novoTelefoneEdicao}
                  onChange={e => setNovoTelefoneEdicao(e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setClienteEditando(null)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: cor }}
                >
                  <Save size={16} />
                  {salvandoEdicao
                    ? 'Salvando...'
                    : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO CLIENTE */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                Cadastrar Novo Cliente
              </h3>

              <button
                onClick={() => setModalAberto(false)}
              >
                <span className="text-gray-400 text-xl font-bold">
                  ×
                </span>
              </button>
            </div>

            <form
              onSubmit={cadastrarCliente}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Nome completo *
                </label>

                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Silva"
                  className="input-field text-sm"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Telefone / WhatsApp
                </label>

                <input
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  className="input-field text-sm"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  E-mail
                </label>

                <input
                  type="email"
                  placeholder="Ex: maria@email.com"
                  className="input-field text-sm"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Data de Aniversário
                </label>

                <input
                  type="date"
                  className="input-field text-sm"
                  value={aniversario}
                  onChange={e => setAniversario(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Observações
                </label>

                <textarea
                  placeholder="Preferências, alergias, anotações..."
                  className="input-field text-sm h-20 resize-none"
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: cor }}
                >
                  {salvando
                    ? 'Salvando...'
                    : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARRA FLUTUANTE */}
      {clientesSelecionados.length >= 2 &&
        abaAtiva === 'ativos' && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3">
            <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-900">
                  {clientesSelecionados.length} clientes selecionados
                </p>

                <p className="text-[10px] text-gray-400">
                  Prontos para mesclar
                </p>
              </div>

              <button
                onClick={abrirModalMesclagemManual}
                disabled={processandoMesclagem}
                className="px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                style={{ backgroundColor: cor }}
              >
                {processandoMesclagem ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <GitMerge size={15} />
                )}

                {processandoMesclagem
                  ? 'Mesclando...'
                  : 'Mesclar selecionados'}
              </button>
            </div>
          </div>
        )}
    </div>
  )
}