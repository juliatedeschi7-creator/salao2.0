// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Calendar, Clock, Plus, Minus, X, CheckCircle } from 'lucide-react'

function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60), m = minutos % 60
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`
  return `${h}h${m > 0 ? ` e ${m}min` : ''}`
}

type ItemCarrinho = { id: string; nome: string; preco: number; duracao_minutos: number; quantidade: number }

export default function ClienteAgendamentosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('todos')
  const [filtro, setFiltro] = useState<'proximos' | 'historico'>('proximos')
  
  // Estados para o fluxo de agendamento / carrinho
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [modalAgendar, setModalAgendar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [dataPreferida, setDataPreferida] = useState('')
  const [periodoPreferido, setPeriodoPreferido] = useState('qualquer')

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    if (!cli) return
    setCliente(cli)
    setSalao(cli?.saloes)
    const salaoId = cli?.saloes?.id

    // Busca serviços disponíveis do salão
    if (salaoId) {
      const { data: srvs } = await supabase.from('servicos').select('*').eq('salao_id', salaoId).eq('ativo', true).order('categoria')
      if (srvs) {
        setServicos(srvs)
        // Extrai categorias únicas
        const cats = Array.from(new Set(srvs.map(s => s.categoria).filter(Boolean))) as string[]
        setCategorias(cats)
      }
    }

    // 1. Busca os agendamentos do cliente
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('cliente_id', cli?.id)
      .order('data_hora', { ascending: false })

    if (!ags) {
      setAgendamentos([])
      return
    }

    // 2. Extrai todos os IDs de serviços únicos de todos os agendamentos
    const todosServicosIds = Array.from(
      new Set(
        ags.flatMap(ag => {
          if (!ag.servicos_ids) return []
          return Array.isArray(ag.servicos_ids) ? ag.servicos_ids : [ag.servicos_ids]
        })
      )
    )

    // 3. Busca os detalhes de todos esses serviços de uma só vez
    let servicosMap = {}
    if (todosServicosIds.length > 0) {
      const { data: servicosData } = await supabase
        .from('servicos')
        .select('id, nome, preco')
        .in('id', todosServicosIds)

      if (servicosData) {
        servicosMap = Object.fromEntries(servicosData.map(s => [s.id, s]))
      }
    }

    // 4. Associa os serviços correspondentes a cada agendamento
    const agsComServicos = ags.map(ag => {
      const ids = Array.isArray(ag.servicos_ids) ? ag.servicos_ids : (ag.servicos_ids ? [ag.servicos_ids] : [])
      const listaServicos = ids.map(id => servicosMap[id]).filter(Boolean)
      
      if (listaServicos.length === 0 && ag.servico_id && servicosMap[ag.servico_id]) {
        listaServicos.push(servicosMap[ag.servico_id])
      }

      return {
        ...ag,
        servicosLista: listaServicos
      }
    })

    setAgendamentos(agsComServicos)
  }

  function adicionarAoCarrinho(s: any) {
    setCarrinho(prev => {
      const existe = prev.find(i => i.id === s.id)
      if (existe) return prev.map(i => i.id === s.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { id: s.id, nome: s.nome, preco: s.preco, duracao_minutos: s.duracao_minutos, quantidade: 1 }]
    })
  }

  function removerDoCarrinho(id: string) {
    setCarrinho(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      if (item.quantidade === 1) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, quantidade: i.quantidade - 1 } : i)
    })
  }

  function qtdCarrinho(id: string) { return carrinho.find(i => i.id === id)?.quantidade || 0 }

  const totalCarrinho = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const totalItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0)
  const duracaoTotal = carrinho.reduce((acc, i) => acc + i.duracao_minutos * i.quantidade, 0)

  // Filtra serviços no modal de acordo com a categoria selecionada
  const servicosFiltrados = categoriaSelecionada === 'todos' 
    ? servicos 
    : servicos.filter(s => s.categoria === categoriaSelecionada)

  async function enviarCarrinho() {
    if (carrinho.length === 0 || !cliente || !salao) return
    setEnviando(true)
    const grupoId = crypto.randomUUID()
    for (const item of carrinho) {
      await supabase.from('solicitacoes_agendamento').insert({
        salao_id: salao.id, cliente_id: cliente.id, servico_id: item.id, status: 'pendente', grupo_id: grupoId,
        data_preferida: dataPreferida || null,
        periodo_preferido: periodoPreferido !== 'qualquer' ? periodoPreferido : null,
      })
    }
    const resumo = carrinho.map(i => `${i.quantidade}x ${i.nome}`).join(', ')
    await notificar({
      salaoId: salao.id, remetenteId: profile!.id, destinatarioId: salao.dono_id,
      titulo: 'Nova solicitação de agendamento',
      mensagem: `${cliente.nome} quer agendar: ${resumo}`, tipo: 'solicitacao',
      url: '/salao/notificacoes'
    })
    setEnviando(false)
    setEnviado(true)
    setCarrinho([])
    setDataPreferida('')
    setPeriodoPreferido('qualquer')
    setTimeout(() => {
      setEnviado(false)
      setModalAgendar(false)
      carregarDados()
    }, 3000)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const agora = new Date()
  const proximos = agendamentos.filter(a => new Date(a.data_hora) >= agora && a.status !== 'cancelado')
  const historico = agendamentos.filter(a => new Date(a.data_hora) < agora || a.status === 'concluido' || a.status === 'cancelado')
  const lista = filtro === 'proximos' ? proximos : historico

  const statusCor: Record<string, string> = {
    confirmado: 'bg-green-50 text-green-600',
    pendente: 'bg-yellow-50 text-yellow-600',
    concluido: 'bg-gray-100 text-gray-500',
    cancelado: 'bg-red-50 text-red-400',
    aguardando_confirmacao: 'bg-blue-50 text-blue-600',
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28 relative">
      <div className="px-4 pt-12 pb-6 flex items-center justify-between" style={{ backgroundColor: cor }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
          <h1 className="font-bold text-white text-lg">Meus Agendamentos</h1>
        </div>
      </div>

      <div className="flex bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        {(['proximos', 'historico'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={'flex-1 py-3 text-sm font-medium transition-all ' + (filtro === f ? 'border-b-2' : 'text-gray-400')}
            style={filtro === f ? { color: cor, borderColor: cor } : {}}>
            {f === 'proximos' ? 'Próximos' : 'Histórico'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Botão de Agendar Horário em destaque */}
        <div 
          onClick={() => setModalAgendar(true)}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer transition-transform active:scale-98">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cor}15` }}>
              <Calendar size={20} style={{ color: cor }} />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Agendar novo horário</p>
              <p className="text-xs text-gray-400">Escolha serviços, data e período preferido</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
            <Plus size={16} />
          </div>
        </div>

        {lista.length === 0 ? (
          <div className="card text-center py-10 mt-2">
            <Calendar size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">{filtro === 'proximos' ? 'Nenhum agendamento futuro' : 'Nenhum histórico'}</p>
          </div>
        ) : lista.map(ag => (
          <div key={ag.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex flex-col gap-0.5">
                  {ag.servicosLista?.length > 0 ? (
                    ag.servicosLista.map((s: any, index: number) => (
                      <p key={index} className="font-bold text-gray-900">• {s.nome}</p>
                    ))
                  ) : (
                    <p className="font-bold text-gray-900">Serviço não especificado</p>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <Clock size={13} className="text-gray-400" />
                  <p className="text-sm text-gray-500">
                    {new Date(ag.data_hora).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} às {new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {ag.profiles?.nome && <p className="text-xs text-gray-400 mt-0.5">Prof: {ag.profiles?.nome}</p>}
              </div>
              <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (statusCor[ag.status] || statusCor.pendente)}>
                {ag.status?.toUpperCase()}
              </span>
            </div>
            {ag.valor && <p className="text-sm font-bold mt-1" style={{ color: cor }}>R$ {ag.valor.toFixed(2).replace('.', ',')}</p>}
          </div>
        ))}
      </div>

      {/* Botão flutuante para agendar */}
      <div className="fixed bottom-6 right-6 z-20">
        <button
          onClick={() => setModalAgendar(true)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full text-white font-bold text-sm shadow-xl transition-transform active:scale-95"
          style={{ backgroundColor: cor }}>
          <Plus size={18} /> Agendar Horário
        </button>
      </div>

      {/* MODAL DE AGENDAMENTO / SELEÇÃO DE SERVIÇOS E PREFERÊNCIA */}
      {modalAgendar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Novo Agendamento</h3>
              <button onClick={() => setModalAgendar(false)}><X size={22} className="text-gray-400" /></button>
            </div>

            {enviado ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: cor }}>
                  <CheckCircle size={32} className="text-white" />
                </div>
                <p className="font-bold text-gray-900 text-lg text-center">Pedido enviado!</p>
                <p className="text-gray-500 text-sm text-center">Aguarde o salão entrar em contato com os horários disponíveis.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase">1. Selecione os serviços</p>
                  </div>

                  {/* Filtro por Categoria */}
                  {categorias.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      <button
                        onClick={() => setCategoriaSelecionada('todos')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                          categoriaSelecionada === 'todos' ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                        }`}
                        style={categoriaSelecionada === 'todos' ? { backgroundColor: cor } : {}}
                      >
                        Todos
                      </button>
                      {categorias.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setCategoriaSelecionada(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                            categoriaSelecionada === cat ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                          }`}
                          style={categoriaSelecionada === cat ? { backgroundColor: cor } : {}}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Lista de serviços filtrados */}
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 mt-1">
                    {servicosFiltrados.length === 0 ? (
                      <p className="text-xs text-gray-400 py-3 text-center">Nenhum serviço encontrado nesta categoria.</p>
                    ) : servicosFiltrados.map(s => {
                      const qtd = qtdCarrinho(s.id)
                      return (
                        <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-semibold text-gray-900 text-sm truncate">{s.nome}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-bold" style={{ color: cor }}>R$ {Number(s.preco).toFixed(2).replace('.', ',')}</span>
                              <span className="text-xs text-gray-400">• {formatarDuracao(s.duracao_minutos)}</span>
                            </div>
                          </div>
                          {qtd === 0 ? (
                            <button onClick={() => adicionarAoCarrinho(s)}
                              className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold shrink-0"
                              style={{ backgroundColor: cor }}>
                              Adicionar
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => removerDoCarrinho(s.id)} className="w-6 h-6 rounded-full border flex items-center justify-center" style={{ borderColor: cor }}>
                                <Minus size={12} style={{ color: cor }} />
                              </button>
                              <span className="font-bold text-gray-900 text-sm w-4 text-center">{qtd}</span>
                              <button onClick={() => adicionarAoCarrinho(s)} className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
                                <Plus size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {carrinho.length > 0 && (
                  <>
                    <div className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1.5 border border-gray-100">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Serviços selecionados: {totalItens}</span>
                        <span>Tempo: {formatarDuracao(duracaoTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-200/50">
                        <span className="font-bold text-gray-900 text-sm">Total estimado</span>
                        <span className="font-bold text-base" style={{ color: cor }}>R$ {totalCarrinho.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase">2. Dia preferido e Período</p>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Data preferida (opcional)</label>
                        <input type="date" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none"
                          style={{ borderColor: `${cor}66` }}
                          value={dataPreferida}
                          onChange={e => setDataPreferida(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Período preferido</label>
                        <div className="flex gap-2">
                          {[
                            { valor: 'qualquer', label: 'Indiferente' },
                            { valor: 'manha', label: 'Manhã' },
                            { valor: 'tarde', label: 'Tarde' },
                            { valor: 'noite', label: 'Noite' },
                          ].map(p => (
                            <button key={p.valor} type="button" onClick={() => setPeriodoPreferido(p.valor)}
                              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all border"
                              style={periodoPreferido === p.valor
                                ? { backgroundColor: cor, color: 'white', borderColor: cor }
                                : { backgroundColor: '#f3f4f6', color: '#6b7280', borderColor: 'transparent' }}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <button onClick={enviarCarrinho} disabled={enviando || carrinho.length === 0}
                  className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                  style={{ backgroundColor: cor }}>
                  {enviando ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Enviar pedido de agendamento'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
