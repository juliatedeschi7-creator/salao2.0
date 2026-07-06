'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, ShoppingCart, X, Plus, Minus } from 'lucide-react'

function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60), m = minutos % 60
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`
  return `${h}h${m > 0 ? ` e ${m}min` : ''}`
}

function AvisoServicos({ cor, texto }: { cor: string; texto?: string | null }) {
  if (!texto) return null
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  function renderLinha(linha: string) {
    return linha.split(' ').map((palavra, i) => {
      const limpa = palavra.replace(/[(),.]/g, '')
      const ehMaiuscula = limpa.length > 2 && limpa === limpa.toUpperCase() && /[A-Z]/.test(limpa)
      return <span key={i} className={ehMaiuscula ? 'font-bold' : ''}>{palavra} </span>
    })
  }
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: `${cor}18`, border: `1px solid ${cor}30` }}>
      <div className="text-gray-700 text-xs leading-relaxed flex flex-col gap-2">
        {linhas.map((linha, i) => <p key={i}>{renderLinha(linha)}</p>)}
      </div>
    </div>
  )
}

type ItemCarrinho = {
  id: string
  nome: string
  preco: number
  duracao_minutos: number
  quantidade: number
}

export default function ClienteServicosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [depoimentos, setDepoimentos] = useState<any[]>([])
  const [fotos, setFotos] = useState<any[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [descExpandida, setDescExpandida] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)

  // Carrinho
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [modalCarrinho, setModalCarrinho] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase
      .from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    if (!cli) { setCarregando(false); return }
    setCliente(cli)
    setSalao(cli.saloes)
    const salaoId = cli.saloes?.id
    const [srvsRes, depsRes, ftsRes] = await Promise.all([
      supabase.from('servicos').select('*').eq('salao_id', salaoId).eq('ativo', true).order('categoria'),
      supabase.from('depoimentos').select('*, clientes(nome)').eq('salao_id', salaoId).eq('publico', true).order('created_at', { ascending: false }),
      supabase.from('fotos_servicos').select('*').eq('salao_id', salaoId),
    ])
    setServicos(srvsRes.data || [])
    setDepoimentos(depsRes.data || [])
    setFotos(ftsRes.data || [])
    setCarregando(false)
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

  function removerItemCompleto(id: string) {
    setCarrinho(prev => prev.filter(i => i.id !== id))
  }

  function quantidadeNoCarrinho(id: string) {
    return carrinho.find(i => i.id === id)?.quantidade || 0
  }

  const totalCarrinho = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const totalItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0)
  const duracaoTotal = carrinho.reduce((acc, i) => acc + i.duracao_minutos * i.quantidade, 0)

  async function enviarCarrinho() {
    if (carrinho.length === 0 || !cliente || !salao) return
    setEnviando(true)

    // grupo_id agrupa todos os itens do mesmo carrinho
    const grupoId = crypto.randomUUID()

    for (const item of carrinho) {
      await supabase.from('solicitacoes_agendamento').insert({
        salao_id: salao.id,
        cliente_id: cliente.id,
        servico_id: item.id,
        status: 'pendente',
        grupo_id: grupoId,
      })
    }

    // Notifica o dono com resumo do carrinho
    const resumo = carrinho.map(i => `${i.quantidade}x ${i.nome}`).join(', ')
    await supabase.from('notificacoes').insert({
      salao_id: salao.id,
      remetente_id: profile!.id,
      destinatario_id: salao.dono_id,
      titulo: 'Nova solicitação de agendamento',
      mensagem: `${cliente.nome} quer agendar: ${resumo}`,
      tipo: 'solicitacao'
    })

    setEnviando(false)
    setEnviado(true)
    setCarrinho([])
    setTimeout(() => { setEnviado(false); setModalCarrinho(false) }, 3000)
  }

  function toggleDesc(id: string) {
    setDescExpandida(prev => {
      const next = new Set(Array.from(prev))
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const categorias = ['Todos', ...Array.from(new Set(servicos.map(s => s.categoria).filter(Boolean)))]
  const filtrados = servicos.filter(s => categoriaFiltro === 'Todos' || s.categoria === categoriaFiltro)
  const ALERTAS = ['diabetes', 'fungo', 'micose', 'alergia', 'pressao', 'gestante', 'gravida', 'hipertensao', 'cancer', 'quimio']
  function temAlerta(desc: string) { return desc ? ALERTAS.some(a => desc.toLowerCase().includes(a)) : false }

  if (loading || carregando) return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Serviços disponíveis</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: totalItens > 0 ? 100 : 32 }}>
      <div className="px-4 pt-12 pb-6 flex items-center justify-between" style={{ backgroundColor: cor }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
          <h1 className="font-bold text-white text-lg">Serviços disponíveis</h1>
        </div>
        {totalItens > 0 && (
          <button onClick={() => setModalCarrinho(true)}
            className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <ShoppingCart size={18} className="text-white" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs font-bold"
              style={{ color: cor }}>{totalItens}</span>
          </button>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {categoriaFiltro === 'Todos' && (
          <AvisoServicos cor={cor} texto={salao?.aviso_servicos} />
        )}

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {categorias.map(c => (
            <button key={c} onClick={() => setCategoriaFiltro(c)}
              className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0"
              style={categoriaFiltro === c
                ? { backgroundColor: cor, color: 'white' }
                : { backgroundColor: 'white', color: '#6b7280' }}>
              {c}
            </button>
          ))}
        </div>

        {filtrados.map(s => {
          const fotosServico = fotos.filter(f => f.servico_id === s.id)
          const deps = depoimentos.filter(d => d.servico_id === s.id)
          const aberto = expandido === s.id
          const alerta = temAlerta(s.descricao)
          const descLonga = s.descricao && s.descricao.length > 120
          const descAberta = descExpandida.has(s.id)
          const variavel = s.tipo_preco === 'variavel'
          const qtd = quantidadeNoCarrinho(s.id)

          return (
            <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              {fotosServico.length > 0 && (
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                  {fotosServico.map(f => (
                    <img key={f.id} src={f.url} alt={s.nome}
                      className="w-24 h-24 rounded-xl object-cover shrink-0" />
                  ))}
                </div>
              )}

              {/* Header do card */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{s.nome}</p>
                    {s.categoria && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.categoria}</span>
                    )}
                    {alerta && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                        <AlertTriangle size={10} />Atenção
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <p className="font-bold text-sm" style={{ color: cor }}>
                      {variavel
                        ? `A partir de R$ ${Number(s.preco).toFixed(2).replace('.', ',')}`
                        : `R$ ${Number(s.preco).toFixed(2).replace('.', ',')}`}
                    </p>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock size={12} />
                      <p className="text-xs">{formatarDuracao(s.duracao_minutos)}</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setExpandido(aberto ? null : s.id)} className="text-gray-400 shrink-0">
                  {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {/* Descrição — sempre 2 linhas + ler mais */}
              {s.descricao && (
                <div>
                  <p className={`text-sm text-gray-500 leading-relaxed ${!descAberta && descLonga ? 'line-clamp-2' : ''}`}>
                    {s.descricao}
                  </p>
                  {descLonga && (
                    <button onClick={() => toggleDesc(s.id)}
                      className="text-sm font-semibold mt-1 underline underline-offset-2"
                      style={{ color: cor }}>
                      {descAberta ? 'Ler menos' : 'Ler mais'}
                    </button>
                  )}
                </div>
              )}

              {/* Botão adicionar ao carrinho — sempre visível */}
              <div className="flex items-center justify-between">
                {qtd === 0 ? (
                  <button onClick={() => adicionarAoCarrinho(s)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
                    style={{ backgroundColor: cor }}>
                    <Plus size={15} />Adicionar
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button onClick={() => removerDoCarrinho(s.id)}
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: cor }}>
                      <Minus size={14} style={{ color: cor }} />
                    </button>
                    <span className="font-bold text-gray-900">{qtd}</span>
                    <button onClick={() => adicionarAoCarrinho(s)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: cor }}>
                      <Plus size={14} />
                    </button>
                  </div>
                )}
                {qtd > 0 && (
                  <p className="text-sm font-bold" style={{ color: cor }}>
                    R$ {(Number(s.preco) * qtd).toFixed(2).replace('.', ',')}
                  </p>
                )}
              </div>

              {/* Seção expandida: atenção + avaliações */}
              {aberto && (
                <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                  {alerta && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2">
                      <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-700">Atenção importante</p>
                        <p className="text-xs text-yellow-600 mt-0.5">
                          Este serviço pode ter restrições para certas condições de saúde. Informe ao profissional sobre diabetes, alergias, gestação ou outras condições antes do procedimento.
                        </p>
                      </div>
                    </div>
                  )}
                  {deps.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Avaliações ({deps.length})</p>
                      {deps.slice(0, 3).map(d => (
                        <div key={d.id} className="bg-gray-50 rounded-xl p-3 mb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: cor }}>
                              {d.clientes?.nome?.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-xs font-medium text-gray-700">{d.clientes?.nome}</p>
                            <p className="text-xs text-gray-400 ml-auto">
                              {new Date(d.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <p className="text-sm text-gray-600">{d.texto}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Barra flutuante do carrinho */}
      {totalItens > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-30">
          <button onClick={() => setModalCarrinho(true)}
            className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-between px-5 shadow-xl"
            style={{ backgroundColor: cor }}>
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} />
              <span>{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
            </div>
            <span>Ver carrinho · R$ {totalCarrinho.toFixed(2).replace('.', ',')}</span>
          </button>
        </div>
      )}

      {/* Modal do carrinho */}
      {modalCarrinho && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Meu carrinho</h3>
              <button onClick={() => setModalCarrinho(false)}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            {enviado ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: cor }}>
                  <CheckCircle size={32} className="text-white" />
                </div>
                <p className="font-bold text-gray-900 text-lg text-center">Pedido enviado!</p>
                <p className="text-gray-500 text-sm text-center">
                  Aguarde o salão entrar em contato com os horários disponíveis.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {carrinho.map(item => (
                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{item.nome}</p>
                        <p className="text-xs text-gray-400">{formatarDuracao(item.duracao_minutos)} por sessão</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => removerDoCarrinho(item.id)}
                          className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: cor }}>
                          <Minus size={12} style={{ color: cor }} />
                        </button>
                        <span className="font-bold text-gray-900 w-4 text-center">{item.quantidade}</span>
                        <button onClick={() => adicionarAoCarrinho(item)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: cor }}>
                          <Plus size={12} />
                        </button>
                        <button onClick={() => removerItemCompleto(item.id)} className="ml-1">
                          <X size={14} className="text-gray-300" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumo */}
                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tempo estimado</span>
                    <span className="font-medium text-gray-900">{formatarDuracao(duracaoTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-lg" style={{ color: cor }}>
                      R$ {totalCarrinho.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  Ao enviar, o salão receberá seu pedido e entrará em contato com os horários disponíveis.
                </p>

                <button onClick={enviarCarrinho} disabled={enviando}
                  className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2"
                  style={{ backgroundColor: cor }}>
                  {enviando
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : 'Enviar pedido de agendamento'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
