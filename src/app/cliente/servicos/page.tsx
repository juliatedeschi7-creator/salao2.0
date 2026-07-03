'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, AlertTriangle, Calendar, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60), m = minutos % 60
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`
  return `${h} hora${h > 1 ? 's' : ''} e ${m} minutos`
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
    <div className="rounded-2xl p-4" style={{ backgroundColor: cor }}>
      <div className="text-black text-xs leading-relaxed flex flex-col gap-2">
        {linhas.map((linha, i) => <p key={i}>{renderLinha(linha)}</p>)}
      </div>
    </div>
  )
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
  // expandido controla só a seção extra (alerta, avaliações, botão agendar)
  const [expandido, setExpandido] = useState<string | null>(null)
  // descricao expandida por serviço (ler mais)
  const [descExpandida, setDescExpandida] = useState<Set<string>>(new Set())
  const [solicitados, setSolicitados] = useState<Set<string>>(new Set())
  const [solicitando, setSolicitando] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

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

  async function solicitarAgendamento(servicoId: string) {
    if (solicitados.has(servicoId) || solicitando === servicoId) return
    setSolicitando(servicoId)
    await supabase.from('solicitacoes_agendamento').insert({
      salao_id: salao.id, cliente_id: cliente.id, servico_id: servicoId, status: 'pendente'
    })
    const servico = servicos.find(s => s.id === servicoId)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile!.id, destinatario_id: salao.dono_id,
      titulo: 'Nova solicitação de agendamento',
      mensagem: `${cliente.nome} quer agendar: ${servico?.nome}`, tipo: 'solicitacao'
    })
    setSolicitados(prev => new Set(Array.from(prev).concat(servicoId)))
    setSolicitando(null)
  }

  function toggleDesc(id: string) {
    setDescExpandida(prev => {
      const next = new Set(Array.from(prev))
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const categorias = ['Todos', ...Array.from(new Set(servicos.map(s => s.categoria)))]
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
            <div className="h-3 bg-gray-100 rounded w-full mb-1" />
            <div className="h-3 bg-gray-100 rounded w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Serviços disponíveis</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {categoriaFiltro === 'Todos' && (
          <AvisoServicos cor={cor} texto={salao?.aviso_servicos} />
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {categorias.map(c => (
            <button key={c} onClick={() => setCategoriaFiltro(c)}
              className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
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
          const jaSolicitado = solicitados.has(s.id)
          const enviando = solicitando === s.id
          const descLonga = s.descricao && s.descricao.length > 120
          const descAberta = descExpandida.has(s.id)
          const variavel = s.tipo_preco === 'variavel'

          return (
            <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              {/* Fotos */}
              {fotosServico.length > 0 && (
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                  {fotosServico.map(f => (
                    <img key={f.id} src={f.url} alt={s.nome}
                      className="w-24 h-24 rounded-xl object-cover shrink-0" />
                  ))}
                </div>
              )}

              {/* Cabeçalho sempre visível */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{s.nome}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.categoria}</span>
                    {alerta && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                        <AlertTriangle size={10} />Ler atenções
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <p className="font-bold text-sm" style={{ color: cor }}>
                      {variavel
                        ? `A partir de R$ ${s.preco.toFixed(2).replace('.', ',')}`
                        : `R$ ${s.preco.toFixed(2).replace('.', ',')}`}
                    </p>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock size={12} />
                      <p className="text-xs">{formatarDuracao(s.duracao_minutos)}</p>
                    </div>
                  </div>
                </div>
                {/* Botão expandir seção extra */}
                <button onClick={() => setExpandido(aberto ? null : s.id)} className="text-gray-400 ml-2 shrink-0">
                  {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {/* Descrição sempre visível — 2 linhas + ler mais */}
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

              {/* Seção expandida: alerta, avaliações, botão agendar */}
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

                  <button
                    onClick={() => solicitarAgendamento(s.id)}
                    disabled={jaSolicitado || enviando}
                    className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{ backgroundColor: jaSolicitado ? '#22c55e' : cor, color: 'white', opacity: enviando ? 0.7 : 1 }}>
                    {enviando ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : jaSolicitado ? (
                      <><CheckCircle size={16} />Pedido feito, aguarde as sugestões de horários</>
                    ) : (
                      <><Calendar size={16} />Quero agendar este serviço</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}