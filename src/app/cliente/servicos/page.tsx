'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, ShoppingCart, X, Plus, Minus, Sparkles, Package, FileText } from 'lucide-react'

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

const REGEX_LINK = /\[\[(.+?)\|(.+?)\]\]/g

function DescricaoComLinks({ texto, cor, onAbrirExplicacao }: {
  texto: string; cor: string; onAbrirExplicacao: (t: string, c: string) => void
}) {
  const partes: React.ReactNode[] = []
  let ultimo = 0, chave = 0
  const regex = new RegExp(REGEX_LINK)
  let match: RegExpExecArray | null
  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimo) partes.push(texto.slice(ultimo, match.index))
    partes.push(
      <button key={chave++} type="button"
        onClick={e => { e.stopPropagation(); onAbrirExplicacao(match![1], match![2]) }}
        className="font-semibold underline underline-offset-2 decoration-2 inline" style={{ color: cor }}>
        {match[1]}
      </button>
    )
    ultimo = regex.lastIndex
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return <>{partes}</>
}

function ModalExplicacao({ aberto, onClose, titulo, texto, cor }: {
  aberto: boolean; onClose: () => void; titulo: string; texto: string; cor: string
}) {
  if (!aberto) return null
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="relative px-6 pt-8 pb-9 overflow-hidden shrink-0"
          style={{ background: `linear-gradient(135deg, ${cor}, ${cor}bb)` }}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 bg-white" />
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <X size={16} className="text-white" />
          </button>
          <div className="relative flex flex-col items-center text-center gap-3 pt-2">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl">💡</div>
            <h3 className="text-white font-bold text-lg leading-snug px-6">{titulo}</h3>
          </div>
        </div>
        <div className="px-6 py-6 overflow-y-auto">
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{texto}</p>
        </div>
        <div className="px-6 pb-6 pt-1 shrink-0">
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2" style={{ backgroundColor: cor }}>
            <Sparkles size={15} />Entendi
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalRegras({ aberto, onClose, pacote, cor, onConfirmar }: {
  aberto: boolean; onClose: () => void; pacote: any; cor: string; onConfirmar: () => void
}) {
  if (!aberto || !pacote) return null
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg">Regras do Pacote</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <p className="text-sm font-semibold text-gray-700">{pacote.nome}</p>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{pacote.regras}</p>
        </div>
        <button onClick={() => { onConfirmar(); onClose() }}
          className="w-full py-3 rounded-2xl text-white font-semibold" style={{ backgroundColor: cor }}>
          Li e estou de acordo
        </button>
      </div>
    </div>
  )
}

type ItemCarrinho = { id: string; nome: string; preco: number; duracao_minutos: number; quantidade: number }

export default function ClienteServicosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [pacotes, setPacotes] = useState<any[]>([])
  const [meusPacotes, setMeusPacotes] = useState<any[]>([])
  const [depoimentos, setDepoimentos] = useState<any[]>([])
  const [fotos, setFotos] = useState<any[]>([])
  const [aba, setAba] = useState<'servicos' | 'pacotes'>('servicos')
  const [abaPackTab, setAbaPackTab] = useState<'vitrine' | 'meus'>('vitrine')
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [descExpandida, setDescExpandida] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [explicacao, setExplicacao] = useState<{ titulo: string; conteudo: string } | null>(null)
  const [modalRegras, setModalRegras] = useState<any>(null)
  const [interessados, setInteressados] = useState<Set<string>>(new Set())
  const [enviandoInteresse, setEnviandoInteresse] = useState<string | null>(null)
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [modalCarrinho, setModalCarrinho] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    if (!cli) { setCarregando(false); return }
    setCliente(cli); setSalao(cli.saloes)
    const salaoId = cli.saloes?.id
    const [srvsRes, depsRes, ftsRes, pacsRes, meusRes] = await Promise.all([
      supabase.from('servicos').select('*').eq('salao_id', salaoId).eq('ativo', true).order('categoria'),
      supabase.from('depoimentos').select('*, clientes(nome)').eq('salao_id', salaoId).eq('publico', true).order('created_at', { ascending: false }),
      supabase.from('fotos_servicos').select('*').eq('salao_id', salaoId),
      supabase.from('pacotes').select('*').eq('salao_id', salaoId).eq('ativo', true).order('preco'),
      supabase.from('cliente_pacotes').select('*, pacotes(nome, descricao, regras)').eq('cliente_id', cli.id).order('data_compra', { ascending: false }),
    ])
    setServicos(srvsRes.data || [])
    setDepoimentos(depsRes.data || [])
    setFotos(ftsRes.data || [])
    setPacotes(pacsRes.data || [])
    setMeusPacotes(meusRes.data || [])
    setCarregando(false)
  }

  async function demonstrarInteresse(pacote: any) {
    if (interessados.has(pacote.id) || enviandoInteresse === pacote.id) return
    setEnviandoInteresse(pacote.id)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile!.id, destinatario_id: salao.dono_id,
      titulo: '💎 Interesse em pacote!',
      mensagem: `${cliente.nome} tem interesse no pacote: ${pacote.nome} (R$ ${Number(pacote.preco).toFixed(2).replace('.', ',')})`,
      tipo: 'pacote'
    })
    setInteressados(prev => new Set(Array.from(prev).concat(pacote.id)))
    setEnviandoInteresse(null)
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

  function removerItemCompleto(id: string) { setCarrinho(prev => prev.filter(i => i.id !== id)) }
  function qtdCarrinho(id: string) { return carrinho.find(i => i.id === id)?.quantidade || 0 }

  const totalCarrinho = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const totalItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0)
  const duracaoTotal = carrinho.reduce((acc, i) => acc + i.duracao_minutos * i.quantidade, 0)

  async function enviarCarrinho() {
    if (carrinho.length === 0 || !cliente || !salao) return
    setEnviando(true)
    const grupoId = crypto.randomUUID()
    for (const item of carrinho) {
      await supabase.from('solicitacoes_agendamento').insert({
        salao_id: salao.id, cliente_id: cliente.id, servico_id: item.id, status: 'pendente', grupo_id: grupoId,
      })
    }
    const resumo = carrinho.map(i => `${i.quantidade}x ${i.nome}`).join(', ')
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile!.id, destinatario_id: salao.dono_id,
      titulo: 'Nova solicitação de agendamento',
      mensagem: `${cliente.nome} quer agendar: ${resumo}`, tipo: 'solicitacao'
    })
    setEnviando(false); setEnviado(true); setCarrinho([])
    setTimeout(() => { setEnviado(false); setModalCarrinho(false) }, 3000)
  }

  function toggleDesc(id: string) {
    setDescExpandida(prev => { const n = new Set(Array.from(prev)); n.has(id) ? n.delete(id) : n.add(id); return n })
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
        <h1 className="font-bold text-white text-lg">Serviços e Pacotes</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-4 animate-pulse h-24" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: totalItens > 0 ? 100 : 32 }}>
      <div className="px-4 pt-12 pb-4 flex items-center justify-between" style={{ backgroundColor: cor }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
          <h1 className="font-bold text-white text-lg">Serviços e Pacotes</h1>
        </div>
        <div className="flex items-center gap-2">
          </button>
          {totalItens > 0 && (
            <button onClick={() => setModalCarrinho(true)}
              className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ShoppingCart size={18} className="text-white" />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs font-bold"
                style={{ color: cor }}>{totalItens}</span>
            </button>
          )}
        </div>
      </div>

      {/* Abas principais */}
      <div className="bg-white border-b border-gray-100 flex">
        <button onClick={() => setAba('servicos')}
          className={'flex-1 py-3 text-sm font-semibold transition-all ' + (aba === 'servicos' ? 'border-b-2' : 'text-gray-400')}
          style={aba === 'servicos' ? { color: cor, borderColor: cor } : {}}>
          Serviços
        </button>
        <button onClick={() => setAba('pacotes')}
          className={'flex-1 py-3 text-sm font-semibold transition-all ' + (aba === 'pacotes' ? 'border-b-2' : 'text-gray-400')}
          style={aba === 'pacotes' ? { color: cor, borderColor: cor } : {}}>
          Pacotes {pacotes.length > 0 && `(${pacotes.length})`}
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* ABA SERVIÇOS */}
        {aba === 'servicos' && (
          <>
            {categoriaFiltro === 'Todos' && <AvisoServicos cor={cor} texto={salao?.aviso_servicos} />}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              {categorias.map(c => (
                <button key={c} onClick={() => setCategoriaFiltro(c)}
                  className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0"
                  style={categoriaFiltro === c ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#6b7280' }}>
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
              const qtd = qtdCarrinho(s.id)

              return (
                <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                  {fotosServico.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                      {fotosServico.map(f => (
                        <img key={f.id} src={f.url} alt={s.nome} className="w-24 h-24 rounded-xl object-cover shrink-0" />
                      ))}
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{s.nome}</p>
                        {s.categoria && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.categoria}</span>}
                        {alerta && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                            <AlertTriangle size={10} />Atenção
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <p className="font-bold text-sm" style={{ color: cor }}>
                          {variavel ? `A partir de R$ ${Number(s.preco).toFixed(2).replace('.', ',')}` : `R$ ${Number(s.preco).toFixed(2).replace('.', ',')}`}
                        </p>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Clock size={12} /><p className="text-xs">{formatarDuracao(s.duracao_minutos)}</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setExpandido(aberto ? null : s.id)} className="text-gray-400 shrink-0">
                      {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>

                  {s.descricao && (
                    <div>
                      <p className={`text-sm text-gray-500 leading-relaxed ${!descAberta && descLonga ? 'line-clamp-2' : ''}`}>
                        <DescricaoComLinks texto={s.descricao} cor={cor} onAbrirExplicacao={(t, c) => setExplicacao({ titulo: t, conteudo: c })} />
                      </p>
                      {descLonga && (
                        <button onClick={() => toggleDesc(s.id)} className="text-sm font-semibold mt-1 underline" style={{ color: cor }}>
                          {descAberta ? 'Ler menos' : 'Ler mais'}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    {qtd === 0 ? (
                      <button onClick={() => adicionarAoCarrinho(s)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
                        style={{ backgroundColor: cor }}>
                        <Plus size={15} />Adicionar
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => removerDoCarrinho(s.id)} className="w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ borderColor: cor }}>
                          <Minus size={14} style={{ color: cor }} />
                        </button>
                        <span className="font-bold text-gray-900">{qtd}</span>
                        <button onClick={() => adicionarAoCarrinho(s)} className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                    {qtd > 0 && <p className="text-sm font-bold" style={{ color: cor }}>R$ {(Number(s.preco) * qtd).toFixed(2).replace('.', ',')}</p>}
                  </div>

                  {aberto && (
                    <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                      {alerta && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2">
                          <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-yellow-700">Atenção importante</p>
                            <p className="text-xs text-yellow-600 mt-0.5">Este serviço pode ter restrições para certas condições de saúde. Informe ao profissional sobre diabetes, alergias, gestação ou outras condições antes do procedimento.</p>
                          </div>
                        </div>
                      )}
                      {deps.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Avaliações ({deps.length})</p>
                          {deps.slice(0, 3).map(d => (
                            <div key={d.id} className="bg-gray-50 rounded-xl p-3 mb-2">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: cor }}>
                                  {d.clientes?.nome?.charAt(0).toUpperCase()}
                                </div>
                                <p className="text-xs font-medium text-gray-700">{d.clientes?.nome}</p>
                                <p className="text-xs text-gray-400 ml-auto">{new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
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
          </>
        )}

        {/* ABA PACOTES */}
        {aba === 'pacotes' && (
          <>
            <div className="flex gap-2">
              <button onClick={() => setAbaPackTab('vitrine')}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={abaPackTab === 'vitrine' ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#9ca3af' }}>
                Disponíveis
              </button>
              <button onClick={() => setAbaPackTab('meus')}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={abaPackTab === 'meus' ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#9ca3af' }}>
                Meus pacotes {meusPacotes.length > 0 && `(${meusPacotes.length})`}
              </button>
            </div>

            {abaPackTab === 'vitrine' && (
              pacotes.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
                  <Package size={36} className="text-gray-200" />
                  <p className="text-gray-400 text-sm">Nenhum pacote disponível no momento</p>
                </div>
              ) : pacotes.map(p => {
                const jaInteressou = interessados.has(p.id)
                const descLonga = p.descricao && p.descricao.length > 100
                const descAberta = descExpandida.has('p-' + p.id)
                const variavel = p.tipo_preco === 'variavel'

                return (
                  <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${cor}18, ${cor}08)` }}>
                      <div>
                        <p className="font-bold text-gray-900">{p.nome}</p>
                        {p.sessoes_inclusas && <p className="text-xs text-gray-400">{p.sessoes_inclusas} sessões</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg" style={{ color: cor }}>
                          {variavel ? `A partir de R$ ${Number(p.preco_minimo || p.preco).toFixed(2).replace('.', ',')}` : `R$ ${Number(p.preco).toFixed(2).replace('.', ',')}`}
                        </p>
                        {p.validade_dias && <p className="text-xs text-gray-400">Validade: {p.validade_dias} dias</p>}
                      </div>
                    </div>

                    <div className="px-4 py-3 flex flex-col gap-3">
                      {p.descricao && (
                        <div>
                          <p className={`text-sm text-gray-500 leading-relaxed ${!descAberta && descLonga ? 'line-clamp-2' : ''}`}>
                            <DescricaoComLinks texto={p.descricao} cor={cor} onAbrirExplicacao={(t, c) => setExplicacao({ titulo: t, conteudo: c })} />
                          </p>
                          {descLonga && (
                            <button onClick={() => toggleDesc('p-' + p.id)} className="text-xs font-semibold mt-1 underline" style={{ color: cor }}>
                              {descAberta ? 'Ler menos' : 'Ler mais'}
                            </button>
                          )}
                        </div>
                      )}

                      {p.regras && (
                        <button onClick={() => setModalRegras(p)}
                          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border"
                          style={{ borderColor: cor, color: cor }}>
                          <FileText size={13} />Ver regras do pacote
                        </button>
                      )}

                      <button onClick={() => demonstrarInteresse(p)} disabled={jaInteressou || enviandoInteresse === p.id}
                        className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                        style={{ backgroundColor: jaInteressou ? '#22c55e' : cor, color: 'white' }}>
                        {enviandoInteresse === p.id
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : jaInteressou
                            ? <><CheckCircle size={16} />Interesse enviado!</>
                            : <><Sparkles size={16} />Tenho interesse</>}
                      </button>
                    </div>
                  </div>
                )
              })
            )}

            {abaPackTab === 'meus' && (
              meusPacotes.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
                  <Package size={36} className="text-gray-200" />
                  <p className="text-gray-400 text-sm">Você ainda não tem pacotes</p>
                  <button onClick={() => setAbaPackTab('vitrine')} className="text-sm font-semibold" style={{ color: cor }}>
                    Ver pacotes disponíveis
                  </button>
                </div>
              ) : meusPacotes.map(mp => {
                const progresso = mp.sessoes_total > 0 ? (mp.sessoes_usadas / mp.sessoes_total) * 100 : 0
                const statusCor: Record<string, string> = { ativo: 'bg-green-50 text-green-600', expirado: 'bg-red-50 text-red-500', concluido: 'bg-gray-100 text-gray-400' }
                return (
                  <div key={mp.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{mp.pacotes?.nome}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCor[mp.status] || 'bg-gray-100 text-gray-400'}`}>
                        {mp.status === 'ativo' ? 'Ativo' : mp.status === 'expirado' ? 'Expirado' : 'Concluído'}
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span>{mp.sessoes_usadas} usadas</span>
                        <span>{mp.sessoes_total - mp.sessoes_usadas} restantes</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${progresso}%`, backgroundColor: cor }} />
                      </div>
                    </div>
                    {mp.pacotes?.regras && (
                      <button onClick={() => setModalRegras(mp.pacotes)}
                        className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border self-start"
                        style={{ borderColor: cor, color: cor }}>
                        <FileText size={13} />Ver regras
                      </button>
                    )}
                    {mp.data_expiracao && <p className="text-xs text-gray-400">Expira em {new Date(mp.data_expiracao).toLocaleDateString('pt-BR')}</p>}
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

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

      {modalCarrinho && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Meu carrinho</h3>
              <button onClick={() => setModalCarrinho(false)}><X size={22} className="text-gray-400" /></button>
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
                  {carrinho.map(item => (
                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{item.nome}</p>
                        <p className="text-xs text-gray-400">{formatarDuracao(item.duracao_minutos)} por sessão</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => removerDoCarrinho(item.id)} className="w-7 h-7 rounded-full border-2 flex items-center justify-center" style={{ borderColor: cor }}>
                          <Minus size={12} style={{ color: cor }} />
                        </button>
                        <span className="font-bold text-gray-900 w-4 text-center">{item.quantidade}</span>
                        <button onClick={() => adicionarAoCarrinho(item)} className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
                          <Plus size={12} />
                        </button>
                        <button onClick={() => removerItemCompleto(item.id)} className="ml-1">
                          <X size={14} className="text-gray-300" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tempo estimado</span>
                    <span className="font-medium text-gray-900">{formatarDuracao(duracaoTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-lg" style={{ color: cor }}>R$ {totalCarrinho.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">Ao enviar, o salão receberá seu pedido e entrará em contato com os horários disponíveis.</p>
                <button onClick={enviarCarrinho} disabled={enviando}
                  className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2"
                  style={{ backgroundColor: cor }}>
                  {enviando ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Enviar pedido de agendamento'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <ModalExplicacao aberto={!!explicacao} onClose={() => setExplicacao(null)}
        titulo={explicacao?.titulo || ''} texto={explicacao?.conteudo || ''} cor={cor} />
      <ModalRegras aberto={!!modalRegras} onClose={() => setModalRegras(null)}
        pacote={modalRegras} cor={cor} onConfirmar={() => {}} />
    </div>
  )
}
