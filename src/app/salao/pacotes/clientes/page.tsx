'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { CreditCard, Users, Search, Plus, Trash2, AlertCircle, X, ChevronRight, Calendar } from 'lucide-react'
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
  const [pacoteAlvoSessao, setPacoteAlvoSessao] = useState<any>(null)

  // Inputs formulários
  const [pacoteEscolhido, setPacoteEscolhido] = useState('')
  const [nomePacoteAntigo, setNomePacoteAntigo] = useState('')
  const [sessoesTotalAntigo, setSessoesTotalAntigo] = useState('')
  const [servicoSessao, setServicoSessao] = useState('')
  const [dataSessao, setDataSessao] = useState(new Date().toISOString().split('T')[0])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/login'); return }

        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single()

        if (!prof) { router.replace('/login'); return }

        let salaoId = prof.salao_id
        if (!salaoId) {
          const { data: salDono } = await supabase
            .from('saloes').select('id').eq('dono_id', session.user.id).maybeSingle()
          if (salDono) salaoId = salDono.id
        }

        if (!salaoId) { router.replace('/criar-salao'); return }

        setProfile(prof)

        const { data: sal } = await supabase.from('saloes').select('*').eq('id', salaoId).single()
        setSalao(sal)

        const { data: listaClientes } = await supabase
          .from('clientes')
          .select('*')
          .eq('salao_id', salaoId)
          .order('nome', { ascending: true })

        setClientes(listaClientes || [])

        const { data: listaPacotes } = await supabase
          .from('pacotes')
          .select('*')
          .eq('salao_id', salaoId)

        setPacotesDisponiveis(listaPacotes || [])

      } catch (e) {
        console.error('Erro ao carregar:', e)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  async function abrirDetalhesCliente(cliente: any) {
    setClienteSelecionado(cliente)
    await carregarPacotesDoCliente(cliente.id)
  }

  async function carregarPacotesDoCliente(clienteId: string) {
    const { data, error } = await supabase
      .from('cliente_pacotes')
      .select('*, pacotes(*)')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar pacotes:', error.message)
      return
    }

    const pacotesComHistorico = await Promise.all((data || []).map(async (pc) => {
      const { data: hist } = await supabase
        .from('cliente_pacotes_historico')
        .select('*')
        .eq('cliente_pacote_id', pc.id)
        .order('data', { ascending: false })

      return {
        ...pc,
        cliente_pacotes_historico: hist || []
      }
    }))

    setPacotesCliente(pacotesComHistorico)
  }

  async function venderPacote(e: React.FormEvent) {
    e.preventDefault()
    if (!pacoteEscolhido || !clienteSelecionado || !salao) return
    setSalvando(true)

    try {
      const pacoteObj = pacotesDisponiveis.find(p => p.id === pacoteEscolhido)
      const total = pacoteObj?.sessoes || 1

      const { error } = await supabase
        .from('cliente_pacotes')
        .insert({
          salao_id: salao.id,
          cliente_id: clienteSelecionado.id,
          pacote_id: pacoteEscolhido,
          sessoes_total: total,
          sessoes_restantes: total,
          status: 'ativo',
          tipo_cadastro: 'sistema',
          vendido_por: profile.nome || 'Equipe'
        })

      if (error) throw error

      setModalVenderAberto(false)
      setPacoteEscolhido('')
      await carregarPacotesDoCliente(clienteSelecionado.id)
    } catch (err: any) {
      alert('Erro ao atribuir pacote: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function cadastrarPacoteAntigo(e: React.FormEvent) {
    e.preventDefault()
    if (!nomePacoteAntigo || !sessoesTotalAntigo || !clienteSelecionado || !salao) return
    setSalvando(true)

    try {
      const total = parseInt(sessoesTotalAntigo) || 1

      const { error } = await supabase
        .from('cliente_pacotes')
        .insert({
          salao_id: salao.id,
          cliente_id: clienteSelecionado.id,
          sessoes_total: total,
          sessoes_restantes: total,
          status: 'ativo',
          tipo_cadastro: 'manual',
          nome_personalizado: nomePacoteAntigo,
          vendido_por: profile.nome || 'Equipe'
        })

      if (error) throw error

      setModalAntigoAberto(false)
      setNomePacoteAntigo('')
      setSessoesTotalAntigo('')
      await carregarPacotesDoCliente(clienteSelecionado.id)
    } catch (err: any) {
      alert('Erro ao cadastrar pacote antigo: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function adicionarSessaoRealizada(e: React.FormEvent) {
    e.preventDefault()
    if (!pacoteAlvoSessao || !servicoSessao) return
    setSalvando(true)

    try {
      const { error: errHist } = await supabase
        .from('cliente_pacotes_historico')
        .insert({
          cliente_pacote_id: pacoteAlvoSessao.id,
          servico: servicoSessao,
          data: dataSessao
        })

      if (errHist) throw errHist

      const novasRestantes = Math.max(0, pacoteAlvoSessao.sessoes_restantes - 1)
      const novoStatus = novasRestantes === 0 ? 'concluido' : 'ativo'

      const { error: errUp } = await supabase
        .from('cliente_pacotes')
        .update({ sessoes_restantes: novasRestantes, status: novoStatus })
        .eq('id', pacoteAlvoSessao.id)

      if (errUp) throw errUp

      setModalSessaoAberto(false)
      setServicoSessao('')
      setPacoteAlvoSessao(null)
      await carregarPacotesDoCliente(clienteSelecionado.id)
    } catch (err: any) {
      alert('Erro ao adicionar sessão: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluirHistorico(histId: string, pacoteId: string, restantesAtuais: number, total: number) {
    if (!confirm('Deseja excluir esta sessão do histórico e devolver 1 sessão?')) return

    try {
      await supabase.from('cliente_pacotes_historico').delete().eq('id', histId)

      const novasRestantes = Math.min(total, restantesAtuais + 1)
      await supabase
        .from('cliente_pacotes')
        .update({ sessoes_restantes: novasRestantes, status: 'ativo' })
        .eq('id', pacoteId)

      await carregarPacotesDoCliente(clienteSelecionado.id)
    } catch (err: any) {
      alert('Erro ao excluir sessão: ' + err.message)
    }
  }

  async function excluirPacoteCliente(idVinculo: string) {
    if (!confirm('Deseja realmente remover este pacote da cliente?')) return

    const { error } = await supabase
      .from('cliente_pacotes')
      .delete()
      .eq('id', idVinculo)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }

    if (clienteSelecionado) {
      await carregarPacotesDoCliente(clienteSelecionado.id)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (carregando || !profile) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  const clientesFiltrados = clientes.filter(c => 
    c.nome?.toLowerCase().includes(busca.toLowerCase()) || 
    c.telefone?.includes(busca)
  )

  const navItems = [
    { icon: Users, label: 'Início', href: '/salao' },
    { icon: CreditCard, label: 'Pacotes por Cliente', href: '/salao/pacotes/clientes' },
  ]

  return (
    <div className="min-h-screen pb-24 bg-gray-50">
      <Header profile={profile} salaoNome={salao?.nome} corPrimaria={cor} />

      <div className="px-4 py-5 flex flex-col gap-4 max-w-xl mx-auto">
        
        {clienteSelecionado ? (
          <div className="flex flex-col gap-4">
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3">
              <button onClick={() => setClienteSelecionado(null)} className="text-xs font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-1 self-start">
                ← Voltar para lista de clientes
              </button>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{clienteSelecionado.nome}</h1>
                  <p className="text-xs text-gray-500">{clienteSelecionado.telefone || 'Sem telefone'}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setModalVenderAberto(true)}
                  className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
                  style={{ backgroundColor: cor }}>
                  <Plus size={16} /> Vender Pacote
                </button>
                <button onClick={() => setModalAntigoAberto(true)}
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 transition">
                  <Calendar size={16} /> Pacote Antigo
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pacotes da cliente</h2>
              
              {pacotesCliente.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl text-center border border-gray-100 shadow-sm flex flex-col items-center gap-2">
                  <AlertCircle size={32} className="text-gray-300" />
                  <p className="text-gray-500 text-sm">Esta cliente não possui pacotes cadastrados.</p>
                </div>
              ) : (
                pacotesCliente.map(pc => {
                  const nomePacote = pc.tipo_cadastro === 'manual' ? pc.nome_personalizado : (pc.pacotes?.nome || 'Pacote')
                  const total = pc.sessoes_total || pc.pacotes?.sessoes || 1
                  const restantes = pc.sessoes_restantes ?? total
                  const usadas = Math.max(0, total - restantes)
                  const progressoPct = Math.min(100, (usadas / total) * 100)
                  const status = pc.status || 'ativo'
                  const historico = pc.cliente_pacotes_historico || []

                  return (
                    <div key={pc.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-base">{nomePacote}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${status === 'ativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                              {status}
                            </span>
                          </div>
                          <span className="inline-block mt-1 text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                            {pc.tipo_cadastro === 'manual' ? 'Cadastro manual' : 'Sistema'}
                          </span>
                        </div>
                        <button onClick={() => excluirPacoteCliente(pc.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Remover pacote">
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs text-gray-500 font-medium">
                          <span>{usadas} usadas</span>
                          <span>{restantes} restantes</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressoPct}%`, backgroundColor: cor }} />
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Histórico de sessões</span>
                        
                        {historico.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Nenhuma sessão realizada ainda.</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {historico.map((h: any) => {
                              const dataFormatada = h.data ? h.data.split('-').reverse().join('/') : ''
                              return (
                                <div key={h.id} className="flex items-center justify-between text-xs text-gray-700 bg-gray-50 px-3 py-2 rounded-xl">
                                  <div className="flex gap-3">
                                    <span className="font-medium text-gray-500">{dataFormatada}</span>
                                    <span className="font-semibold text-gray-900">{h.servico}</span>
                                  </div>
                                  <button onClick={() => excluirHistorico(h.id, pc.id, restantes, total)} className="text-gray-400 hover:text-red-500 p-1">
                                    <X size={14} />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {status === 'ativo' && (
                        <button onClick={() => { setPacoteAlvoSessao(pc); setModalSessaoAberto(true); }}
                          className="w-full border py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 mt-1"
                          style={{ borderColor: cor, color: cor }}>
                          <Plus size={16} /> Adicionar sessão realizada
                        </button>
                      )}

                      <div className="text-[11px] text-gray-400 pt-1 border-t border-gray-50">
                        Vendido por: <span className="font-medium text-gray-600">{pc.vendido_por || 'Equipe'}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
              <div>
                <h1 className="text-lg font-bold text-gray-900">Pacotes por Cliente</h1>
                <p className="text-xs text-gray-500">Selecione uma cliente para gerenciar os pacotes</p>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                <input type="text" placeholder="Buscar cliente por nome ou telefone..."
                  value={busca} onChange={e => setBusca(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-xs outline-none placeholder-gray-400" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {clientesFiltrados.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl text-center border border-gray-100 shadow-sm flex flex-col items-center gap-2">
                  <Users size={32} className="text-gray-300" />
                  <p className="text-gray-500 text-sm">Nenhuma cliente encontrada.</p>
                </div>
              ) : (
                clientesFiltrados.map(cliente => (
                  <div key={cliente.id} onClick={() => abrirDetalhesCliente(cliente)}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-3 cursor-pointer hover:border-pink-300 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs uppercase shrink-0"
                        style={{ backgroundColor: cor }}>
                        {cliente.nome ? cliente.nome[0] : 'C'}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">{cliente.nome}</h3>
                        <p className="text-xs text-gray-400">{cliente.telefone || 'Sem telefone'}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-400" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Vender Pacote */}
      {modalVenderAberto && clienteSelecionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Vender Pacote</h3>
              <button onClick={() => setModalVenderAberto(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={venderPacote} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-900">Selecione o Pacote</label>
                <select value={pacoteEscolhido} onChange={e => setPacoteEscolhido(e.target.value)} required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none text-gray-700">
                  <option value="">Selecione...</option>
                  {pacotesDisponiveis.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} ({p.sessoes} sessões)</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalVenderAberto(false)} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold">Cancelar</button>
                <button type="submit" disabled={salvando} className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold" style={{ backgroundColor: cor }}>
                  {salvando ? 'Salvando...' : 'Vender'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pacote Antigo (Manual) */}
      {modalAntigoAberto && clienteSelecionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Cadastrar Pacote Antigo</h3>
              <button onClick={() => setModalAntigoAberto(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={cadastrarPacoteAntigo} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-900">Nome do Pacote</label>
                <input type="text" placeholder="Ex: 4 mãos e 1 pé" value={nomePacoteAntigo} onChange={e => setNomePacoteAntigo(e.target.value)} required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-900">Total de Sessões</label>
                <input type="number" min="1" placeholder="Ex: 5" value={sessoesTotalAntigo} onChange={e => setSessoesTotalAntigo(e.target.value)} required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalAntigoAberto(false)} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold">Cancelar</button>
                <button type="submit" disabled={salvando} className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold" style={{ backgroundColor: cor }}>
                  {salvando ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Sessão Realizada */}
      {modalSessaoAberto && pacoteAlvoSessao && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Adicionar Sessão Realizada</h3>
              <button onClick={() => setModalSessaoAberto(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={adicionarSessaoRealizada} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-900">Serviço Realizado</label>
                <input type="text" placeholder="Ex: Manicure ou Pedicure" value={servicoSessao} onChange={e => setServicoSessao(e.target.value)} required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-900">Data da Sessão</label>
                <input type="date" value={dataSessao} onChange={e => setDataSessao(e.target.value)} required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-xs outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalSessaoAberto(false)} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-semibold">Cancelar</button>
                <button type="submit" disabled={salvando} className="flex-1 text-white py-3 rounded-2xl text-xs font-semibold" style={{ backgroundColor: cor }}>
                  {salvando ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}
