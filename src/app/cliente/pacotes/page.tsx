'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Sparkles, Check, ChevronDown, ChevronUp, X } from 'lucide-react'

// Reutiliza o mesmo modal explicativo dos serviços
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
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2"
            style={{ backgroundColor: cor }}>
            <Sparkles size={15} />Entendi
          </button>
        </div>
      </div>
    </div>
  )
}

const REGEX_LINK = /\[\[(.+?)\|(.+?)\]\]/g

function TextoComLinks({ texto, cor, onAbrirExplicacao }: {
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
        className="font-semibold underline underline-offset-2 decoration-2 inline"
        style={{ color: cor }}>
        {match[1]}
      </button>
    )
    ultimo = regex.lastIndex
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return <>{partes}</>
}

export default function VitrinePacksPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [meusPacotes, setMeusPacotes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [interessados, setInteressados] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState<string | null>(null)
  const [explicacao, setExplicacao] = useState<{ titulo: string; conteudo: string } | null>(null)
  const [aba, setAba] = useState<'vitrine' | 'meus'>('vitrine')

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    if (!cli) { setCarregando(false); return }
    setCliente(cli)
    setSalao(cli.saloes)

    const [pacsRes, meusRes] = await Promise.all([
      supabase.from('pacotes').select('*').eq('salao_id', cli.saloes.id).eq('status', 'ativo').order('preco'),
      supabase.from('cliente_pacotes').select('*, pacotes(nome, descricao, categoria)').eq('cliente_id', cli.id).order('data_compra', { ascending: false }),
    ])
    setPacotes(pacsRes.data || [])
    setMeusPacotes(meusRes.data || [])
    setCarregando(false)
  }

  async function demonstrarInteresse(pacote: any) {
    if (interessados.has(pacote.id) || enviando === pacote.id) return
    setEnviando(pacote.id)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id,
      remetente_id: profile!.id,
      destinatario_id: salao.dono_id,
      titulo: '💎 Interesse em pacote!',
      mensagem: `${cliente.nome} tem interesse no pacote: ${pacote.nome} (R$ ${Number(pacote.preco).toFixed(2).replace('.', ',')})`,
      tipo: 'pacote'
    })
    setInteressados(prev => new Set(Array.from(prev).concat(pacote.id)))
    setEnviando(null)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) return (
    <div className="min-h-screen" style={{ backgroundColor: '#f4f4f8' }}>
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Pacotes</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-4 animate-pulse h-24" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#f4f4f8' }}>
      {/* Header */}
      <div className="relative px-4 pt-12 pb-8 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cor}, ${cor}bb)` }}>
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-10 bg-white" />
        <button onClick={() => router.back()}
          className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-4">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="relative text-white font-bold text-2xl">Pacotes</h1>
        <p className="relative text-white/70 text-sm mt-1">Conheça e adquira nossos pacotes</p>
      </div>

      {/* Abas */}
      <div className="px-4 -mt-5 relative z-10 mb-4">
        <div className="bg-white rounded-2xl p-1 flex gap-1 shadow-md">
          <button onClick={() => setAba('vitrine')}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={aba === 'vitrine' ? { backgroundColor: cor, color: 'white' } : { color: '#9ca3af' }}>
            Disponíveis
          </button>
          <button onClick={() => setAba('meus')}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={aba === 'meus' ? { backgroundColor: cor, color: 'white' } : { color: '#9ca3af' }}>
            Meus pacotes {meusPacotes.length > 0 && `(${meusPacotes.length})`}
          </button>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-3">

        {/* Vitrine */}
        {aba === 'vitrine' && (
          pacotes.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
              <Package size={36} className="text-gray-200" />
              <p className="text-gray-400 text-sm">Nenhum pacote disponível no momento</p>
            </div>
          ) : pacotes.map(p => {
            const aberto = expandido === p.id
            const jaInteressou = interessados.has(p.id)
            const descLonga = p.descricao && p.descricao.length > 100

            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Cabeçalho colorido */}
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ background: `linear-gradient(135deg, ${cor}18, ${cor}08)` }}>
                  <div>
                    <p className="font-bold text-gray-900">{p.nome}</p>
                    {p.categoria && <p className="text-xs text-gray-400">{p.categoria}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg" style={{ color: cor }}>
                      R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-xs text-gray-400">{p.sessoes} sessões</p>
                  </div>
                </div>

                <div className="px-4 py-3 flex flex-col gap-3">
                  {/* Descrição com link explicativo */}
                  {p.descricao && (
                    <div>
                      <p className={`text-sm text-gray-500 leading-relaxed ${!aberto && descLonga ? 'line-clamp-2' : ''}`}>
                        <TextoComLinks texto={p.descricao} cor={cor}
                          onAbrirExplicacao={(t, c) => setExplicacao({ titulo: t, conteudo: c })} />
                      </p>
                      {descLonga && (
                        <button onClick={() => setExpandido(aberto ? null : p.id)}
                          className="text-xs font-semibold mt-1 underline" style={{ color: cor }}>
                          {aberto ? 'Ler menos' : 'Ler mais'}
                        </button>
                      )}
                    </div>
                  )}

                  {p.validade_dias && (
                    <p className="text-xs text-gray-400">Validade: {p.validade_dias} dias após a compra</p>
                  )}

                  <button
                    onClick={() => demonstrarInteresse(p)}
                    disabled={jaInteressou || enviando === p.id}
                    className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                    style={{ backgroundColor: jaInteressou ? '#22c55e' : cor, color: 'white' }}>
                    {enviando === p.id
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : jaInteressou
                        ? <><Check size={16} />Interesse enviado!</>
                        : <><Sparkles size={16} />Tenho interesse</>}
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* Meus pacotes */}
        {aba === 'meus' && (
          meusPacotes.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
              <Package size={36} className="text-gray-200" />
              <p className="text-gray-400 text-sm">Você ainda não tem pacotes</p>
              <button onClick={() => setAba('vitrine')} className="text-sm font-semibold" style={{ color: cor }}>
                Ver pacotes disponíveis
              </button>
            </div>
          ) : meusPacotes.map(mp => {
            const progresso = mp.sessoes_total > 0 ? (mp.sessoes_usadas / mp.sessoes_total) * 100 : 0
            const statusCor: Record<string, string> = {
              ativo: 'bg-green-50 text-green-600',
              expirado: 'bg-red-50 text-red-500',
              concluido: 'bg-gray-100 text-gray-400',
            }
            return (
              <div key={mp.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{mp.pacotes?.nome}</p>
                    {mp.pacotes?.categoria && <p className="text-xs text-gray-400">{mp.pacotes.categoria}</p>}
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
                  <p className="text-xs text-gray-300 mt-1 text-right">{mp.sessoes_total} sessões no total</p>
                </div>
                {mp.data_expiracao && (
                  <p className="text-xs text-gray-400">Expira em {new Date(mp.data_expiracao).toLocaleDateString('pt-BR')}</p>
                )}
              </div>
            )
          })
        )}
      </div>

      <ModalExplicacao
        aberto={!!explicacao}
        onClose={() => setExplicacao(null)}
        titulo={explicacao?.titulo || ''}
        texto={explicacao?.conteudo || ''}
        cor={cor}
      />
    </div>
  )
}