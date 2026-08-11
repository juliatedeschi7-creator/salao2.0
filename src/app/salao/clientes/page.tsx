// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Search, Plus, User, Phone, ChevronRight, MessageSquare, Check, X, Clock, GitMerge, Edit3, Save } from 'lucide-react'

export default function ClientesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'pendentes' | 'duplicados'>('ativos')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [processandoMesclagem, setProcessandoMesclagem] = useState(false)

  // Modal Novo Cliente
  const [modalAberto, setModalAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [aniversario, setAniversario] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Estado para Edição Rápida de Nome/Cliente
  const [clienteEditando, setClienteEditando] = useState<any | null>(null)
  const [novoNomeEdicao, setNovoNomeEdicao] = useState('')
  const [novoTelefoneEdicao, setNovoTelefoneEdicao] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    if (profile.salao_id) {
      carregarDados()
    }
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: todos } = await supabase.from('clientes')
      .select('*')
      .eq('salao_id', profile!.salao_id!)
      .eq('ignorar_duplicado', false) // <--- Ignora os que já foram descartados dos duplicados
      .order('nome', { ascending: true })

    if (todos) {
      const pendentesList = todos.filter(c => c.status === 'pendente')
      const ativosList = todos.filter(c => c.status !== 'pendente')
      
      setSolicitacoes(pendentesList)
      setClientes(ativosList)
    } else {
      setClientes([])
      setSolicitacoes([])
    }

    setCarregando(false)
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
    const gruposMap: { [chave: string]: any[] } = {}

    clientes.forEach(cliente => {
      if (!cliente.nome) return
      const nomeNorm = normalizarNome(cliente.nome)
      const partes = nomeNorm.split(/\s+/)
      if (partes.length === 0) return

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

      lista.forEach(cli => {
        const palavrasCli = normalizarNome(cli.nome).split(/\s+/)
        let alocado = false

        for (const sg of subGrupos) {
          const representante = sg[0]
          const palavrasRep = normalizarNome(representante.nome).split(/\s+/)

          const temSobrenomeSemelhante = palavrasCli.some((pC, idxC) => 
            palavrasRep.some((pR, idxR) => {
              if (idxC === 0 && idxR === 0) return true
              if (pC === pR || (pC.length > 3 && pR.length > 3 && (pC.startsWith(pR.slice(0, 3)) || pR.startsWith(pC.slice(0, 3))))) {
                return true
              }
              return false
            })
          )

          if (temSobrenomeSemelhante) {
            sg.push(cli)
            alocado = true
            break
          }
        }

        if (!alocado) {
          subGrupos.push([cli])
        }
      })

      subGrupos.forEach(sg => {
        if (sg.length > 1) {
          resultado.push({
            chaveGrupo: primeiroNome.toUpperCase(),
            clientes: sg
          })
        }
      })
    })

    return resultado
  }

  const gruposDuplicados = obterGruposDuplicados()

  // Função para dispensar/ignorar um cliente da lista de duplicados usando o X
  async function ignorarDuplicado(clienteId: string) {
    const { error } = await supabase
      .from('clientes')
      .update({ ignorar_duplicado: true })
      .eq('id', clienteId)

    if (!error) {
      carregarDados()
    } else {
      console.error(error)
    }
  }

  async function mesclarGrupo(grupoClientes: any[], clientePrincipalId: string) {
    if (processandoMesclagem) return
    setProcessandoMesclagem(true)

    const principal = grupoClientes.find(c => c.id === clientePrincipalId)
    const duplicados = grupoClientes.filter(c => c.id !== clientePrincipalId)

    if (!principal) {
      setProcessandoMesclagem(false)
      return
    }

    try {
      for (const dup of duplicados) {
        await supabase
          .from('agendamentos')
          .update({ cliente_id: principal.id })
          .eq('cliente_id', dup.id)

        await supabase
          .from('depoimentos')
          .update({ cliente_id: principal.id })
          .eq('cliente_id', dup.id)

        await supabase
          .from('historico_cliente')
          .update({ cliente_id: principal.id })
          .eq('cliente_id', dup.id)

        await supabase
          .from('clientes')
          .delete()
          .eq('id', dup.id)
      }

      notificar({
        salaoId: profile!.salao_id!,
        remetenteId: profile!.id,
        destinatarioId: profile!.id,
        titulo: 'Mesclagem Concluída',
        mensagem: 'Os cadastros foram mesclados com sucesso.',
        tipo: 'sistema'
      })

      carregarDados()
    } catch (error) {
      console.error(error)
      notificar({
        salaoId: profile!.salao_id!,
        remetenteId: profile!.id,
        destinatarioId: profile!.id,
        titulo: 'Erro',
        mensagem: 'Não foi possível concluir a mesclagem.',
        tipo: 'sistema'
      })
    } finally {
      setProcessandoMesclagem(false)
    }
  }

  async function aceitarSolicitacao(id: string) {
    const { error } = await supabase.from('clientes').update({ status: 'ativo' }).eq('id', id)
    if (!error) {
      carregarDados()
      notificar({
        salaoId: profile!.salao_id!,
        remetenteId: profile!.id,
        destinatarioId: profile!.id,
        titulo: 'Cliente Aprovado!',
        mensagem: 'O cadastro do cliente foi aceito com sucesso.',
        tipo: 'sistema'
      })
    }
  }

  async function recusarSolicitacao(id: string) {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (!error) {
      carregarDados()
    }
  }

  async function salvarEdicaoCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteEditando || !novoNomeEdicao.trim()) return

    setSalvandoEdicao(true)
    const { error } = await supabase
      .from('clientes')
      .update({
        nome: novoNomeEdicao.trim(),
        telefone: novoTelefoneEdicao.trim() || null
      })
      .eq('id', clienteEditando.id)

    if (error) {
      console.error(error)
      notificar({
        salaoId: profile!.salao_id!,
        remetenteId: profile!.id,
        destinatarioId: profile!.id,
        titulo: 'Erro',
        mensagem: 'Não foi possível atualizar o cliente.',
        tipo: 'sistema'
      })
    } else {
      notificar({
        salaoId: profile!.salao_id!,
        remetenteId: profile!.id,
        destinatarioId: profile!.id,
        titulo: 'Atualizado',
        mensagem: 'Dados do cliente alterados com sucesso.',
        tipo: 'sistema'
      })
      setClienteEditando(null)
      carregarDados()
    }
    setSalvandoEdicao(false)
  }

  async function cadastrarCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      notificar({
        salaoId: profile!.salao_id!,
        remetenteId: profile!.id,
        destinatarioId: profile!.id,
        titulo: 'Atenção',
        mensagem: 'O nome do cliente é obrigatório.',
        tipo: 'sistema'
      })
      return
    }

    setSalvando(true)
    const { error } = await supabase.from('clientes').insert({
      salao_id: profile!.salao_id,
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      aniversario: aniversario || null,
      observacoes: observacoes.trim() || null,
      status: 'ativo'
    })

    if (error) {
      console.error(error)
      notificar({
        salaoId: profile!.salao_id!,
        remetenteId: profile!.id,
        destinatarioId: profile!.id,
        titulo: 'Erro',
        mensagem: 'Não foi possível cadastrar o cliente.',
        tipo: 'sistema'
      })
    } else {
      setModalAberto(false)
      setNome('')
      setTelefone('')
      setEmail('')
      setAniversario('')
      setObservacoes('')
      carregarDados()
    }
    setSalvando(false)
  }

  const clientesFiltrados = clientes.filter(c => 
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  )

  const cor = salao?.cor_primaria || '#E91E8C'
  const p = profile as any
  const isFuncionarioComum = p?.tipo === 'funcionario' || p?.nivel === 'funcionario' || p?.cargo === 'funcionario'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* Cabeçalho */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg">Clientes</h1>
        </div>
        <button 
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      {/* Abas */}
      <div className="flex bg-white border-b border-gray-100 px-4">
        <button 
          onClick={() => setAbaAtiva('ativos')}
          className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${abaAtiva === 'ativos' ? '' : 'text-gray-400 border-transparent'}`}
          style={abaAtiva === 'ativos' ? { color: cor, borderColor: cor } : {}}>
          Cadastrados ({clientes.length})
        </button>
        <button 
          onClick={() => setAbaAtiva('pendentes')}
          className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all relative ${abaAtiva === 'pendentes' ? '' : 'text-gray-400 border-transparent'}`}
          style={abaAtiva === 'pendentes' ? { color: cor, borderColor: cor } : {}}>
          Solicitações
          {solicitacoes.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] text-white bg-red-500 font-bold">
              {solicitacoes.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setAbaAtiva('duplicados')}
          className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all relative ${abaAtiva === 'duplicados' ? '' : 'text-gray-400 border-transparent'}`}
          style={abaAtiva === 'duplicados' ? { color: cor, borderColor: cor } : {}}>
          Duplicados
          {gruposDuplicados.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] text-white bg-amber-500 font-bold">
              {gruposDuplicados.length}
            </span>
          )}
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {abaAtiva === 'ativos' && (
          <>
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
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

            {carregando ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="card text-center py-12">
                <User size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Nenhum cliente encontrado.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {clientesFiltrados.map(cliente => (
                  <div 
                    key={cliente.id} 
                    onClick={() => router.push(`/clientes/${cliente.id}`)}
                    className="card bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-gray-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center font-bold text-white text-sm justify-center shrink-0" style={{ backgroundColor: cor }}>
                        {cliente.nome?.charAt(0).toUpperCase() || 'C'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{cliente.nome}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone size={12} /> {cliente.telefone || 'Sem telefone'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setClienteEditando(cliente)
                          setNovoNomeEdicao(cliente.nome || '')
                          setNovoTelefoneEdicao(cliente.telefone || '')
                        }}
                        className="w-8 h-8 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100"
                        title="Editar nome/telefone">
                        <Edit3 size={14} />
                      </button>
                      {cliente.telefone && (
                        <a 
                          href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                          <MessageSquare size={14} />
                        </a>
                      )}
                      <ChevronRight size={18} className="text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {abaAtiva === 'pendentes' && (
          <div className="flex flex-col gap-3">
            {solicitacoes.length === 0 ? (
              <div className="card text-center py-12">
                <Clock size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Nenhuma solicitação de cadastro pendente.</p>
              </div>
            ) : (
              solicitacoes.map(sol => (
                <div key={sol.id} className="card bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center font-bold text-white text-sm justify-center shrink-0" style={{ backgroundColor: cor }}>
                        {sol.nome?.charAt(0).toUpperCase() || 'C'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{sol.nome}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone size={12} /> {sol.telefone || 'Sem telefone'}
                        </p>
                        {sol.email && <p className="text-xs text-gray-400 mt-0.5">{sol.email}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => {
                          setClienteEditando(sol)
                          setNovoNomeEdicao(sol.nome || '')
                          setNovoTelefoneEdicao(sol.telefone || '')
                        }}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1">
                        <Edit3 size={12} /> Editar
                      </button>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase bg-yellow-50 text-yellow-600">
                        Pendente
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-50">
                    <button 
                      onClick={() => aceitarSolicitacao(sol.id)}
                      className="flex-1 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                      style={{ backgroundColor: cor }}>
                      <Check size={14} /> Aceitar Cadastro
                    </button>
                    <button 
                      onClick={() => recusarSolicitacao(sol.id)}
                      className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold flex items-center justify-center gap-1">
                      <X size={14} /> Recusar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {abaAtiva === 'duplicados' && (
          <div className="flex flex-col gap-4">
            {gruposDuplicados.length === 0 ? (
              <div className="card text-center py-12">
                <GitMerge size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Nenhum cliente com nome semelhante encontrado para mesclagem.</p>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-800 font-medium text-center">
                    ⚠️ Encontramos cadastros com nomes semelhantes (como variações de grafia ou nomes parecidos). Selecione abaixo qual deles será o registro <strong>principal</strong> para unificar os históricos, ou clique no <strong>X</strong> para descartar da lista.
                  </p>
                </div>

                {gruposDuplicados.map((grupo, idx) => (
                  <div key={idx} className="card bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="text-xs font-bold text-gray-500 uppercase">Grupo com prefixo: "{grupo.chaveGrupo}"</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">{grupo.clientes.length} cadastros</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {grupo.clientes.map(cli => (
                        <div key={cli.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center font-bold text-white text-xs justify-center shrink-0" style={{ backgroundColor: cor }}>
                              {cli.nome?.charAt(0).toUpperCase() || 'C'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{cli.nome}</p>
                              <p className="text-[11px] text-gray-400">{cli.telefone || 'Sem telefone'} {cli.email ? `• ${cli.email}` : ''}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setClienteEditando(cli)
                                setNovoNomeEdicao(cli.nome || '')
                                setNovoTelefoneEdicao(cli.telefone || '')
                              }}
                              className="px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-semibold flex items-center gap-1"
                              title="Editar">
                              <Edit3 size={12} />
                            </button>

                            {/* Botão X para descartar este cadastro da lista de duplicados */}
                            <button
                              onClick={() => ignorarDuplicado(cli.id)}
                              className="px-2 py-1.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-semibold flex items-center gap-1 hover:bg-red-100"
                              title="Descartar / Não é duplicado">
                              <X size={14} />
                            </button>

                            <button
                              onClick={() => mesclarGrupo(grupo.clientes, cli.id)}
                              disabled={processandoMesclagem}
                              className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm flex items-center gap-1 disabled:opacity-50"
                              style={{ backgroundColor: cor }}
                            >
                              <GitMerge size={12} /> {processandoMesclagem ? 'Mesclando...' : 'Manter este'}
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

      {/* Modal para Editar Nome/Telefone do Cliente */}
      {clienteEditando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Editar Cadastro</h3>
              <button onClick={() => setClienteEditando(null)}><span className="text-gray-400 text-xl font-bold">×</span></button>
            </div>

            <form onSubmit={salvarEdicaoCliente} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do Cliente *</label>
                <input 
                  type="text" 
                  required
                  className="input-field text-sm"
                  value={novoNomeEdicao}
                  onChange={e => setNovoNomeEdicao(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Telefone / WhatsApp</label>
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
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={salvandoEdicao}
                  className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: cor }}>
                  <Save size={16} /> {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Adicionar Novo Cliente */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Cadastrar Novo Cliente</h3>
              <button onClick={() => setModalAberto(false)}><span className="text-gray-400 text-xl font-bold">×</span></button>
            </div>

            <form onSubmit={cadastrarCliente} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome completo *</label>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  placeholder="Ex: (11) 99999-9999" 
                  className="input-field text-sm"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">E-mail</label>
                <input 
                  type="email" 
                  placeholder="Ex: maria@email.com" 
                  className="input-field text-sm"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Data de Aniversário</label>
                <input 
                  type="date" 
                  className="input-field text-sm"
                  value={aniversario}
                  onChange={e => setAniversario(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
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
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={salvando}
                  className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: cor }}>
                  {salvando ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
