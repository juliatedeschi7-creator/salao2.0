'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, ChevronLeft, ChevronRight } from 'lucide-react'

type Grupo = {
  grupo_id: string
  data: string
  descricao?: string
  antes?: string
  depois?: string
}

export default function ClienteEvolucaoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indexAtivo, setIndexAtivo] = useState(0)
  const [ladoAtivo, setLadoAtivo] = useState<Record<string, 'antes' | 'depois'>>({})

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes')
      .select('*, saloes(*)').eq('profile_id', profile!.id).single()
    if (!cli) { setCarregando(false); return }
    setSalao(cli.saloes)

    const { data: evs } = await supabase.from('evolucoes')
      .select('*')
      .eq('cliente_id', cli.id)
      .eq('visivel_cliente', true)
      .order('created_at', { ascending: false })

    if (!evs) { setCarregando(false); return }

    const mapa: Record<string, Grupo> = {}
    for (const ev of evs) {
      if (!mapa[ev.grupo_id]) {
        mapa[ev.grupo_id] = {
          grupo_id: ev.grupo_id,
          data: ev.created_at,
          descricao: ev.descricao
        }
      }
      if (ev.tipo === 'antes') mapa[ev.grupo_id].antes = ev.url
      if (ev.tipo === 'depois') mapa[ev.grupo_id].depois = ev.url
    }
    setGrupos(Object.values(mapa).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()))
    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Minha evolução</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1,2].map(i => <div key={i} className="bg-white rounded-2xl h-64 animate-pulse" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="relative overflow-hidden px-4 pt-12 pb-6 flex items-center gap-3"
        style={{ background: `linear-gradient(135deg, ${cor}, ${cor}bb)` }}>
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10 bg-white" />
        <button onClick={() => router.back()}
          className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="relative flex-1">
          <h1 className="font-bold text-white text-lg">Minha evolução</h1>
          <p className="text-white/70 text-xs">{grupos.length} registro{grupos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <Camera size={18} className="text-white" />
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="mx-4 mt-8 bg-white rounded-3xl p-8 text-center flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
            style={{ backgroundColor: `${cor}15` }}>📷</div>
          <div>
            <p className="font-bold text-gray-900">Nenhuma evolução ainda</p>
            <p className="text-gray-400 text-sm mt-1">Suas fotos de antes e depois aparecerão aqui conforme os atendimentos forem registrados</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 flex flex-col gap-4">

          {/* Navegação do registro atual */}
          {grupos.length > 1 && (
            <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
              <button onClick={() => setIndexAtivo(Math.max(0, indexAtivo - 1))}
                disabled={indexAtivo === 0}
                className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30"
                style={{ backgroundColor: `${cor}15` }}>
                <ChevronLeft size={18} style={{ color: cor }} />
              </button>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900">
                  {new Date(grupos[indexAtivo].data).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-400">{indexAtivo + 1} de {grupos.length}</p>
              </div>
              <button onClick={() => setIndexAtivo(Math.min(grupos.length - 1, indexAtivo + 1))}
                disabled={indexAtivo === grupos.length - 1}
                className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30"
                style={{ backgroundColor: `${cor}15` }}>
                <ChevronRight size={18} style={{ color: cor }} />
              </button>
            </div>
          )}

          {/* Foto principal com toggle antes/depois */}
          {(() => {
            const g = grupos[indexAtivo]
            const lado = ladoAtivo[g.grupo_id] || (g.depois ? 'depois' : 'antes')
            const urlAtiva = lado === 'antes' ? g.antes : g.depois
            const temAmbos = !!(g.antes && g.depois)

            return (
              <div className="flex flex-col gap-3">
                <div className="relative bg-white rounded-3xl overflow-hidden shadow-sm">
                  {urlAtiva ? (
                    <img src={urlAtiva} alt={lado}
                      className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                      <p className="text-gray-400 text-sm">Foto {lado} não disponível</p>
                    </div>
                  )}

                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg"
                      style={{ backgroundColor: lado === 'antes' ? '#6b7280' : cor }}>
                      {lado === 'antes' ? '📷 Antes' : '✨ Depois'}
                    </span>
                  </div>
                </div>

                {temAmbos && (
                  <div className="flex gap-2">
                    <button onClick={() => setLadoAtivo(prev => ({ ...prev, [g.grupo_id]: 'antes' }))}
                      className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                      style={lado === 'antes'
                        ? { backgroundColor: '#6b7280', color: 'white' }
                        : { backgroundColor: 'white', color: '#9ca3af' }}>
                      📷 Ver Antes
                    </button>
                    <button onClick={() => setLadoAtivo(prev => ({ ...prev, [g.grupo_id]: 'depois' }))}
                      className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                      style={lado === 'depois'
                        ? { backgroundColor: cor, color: 'white' }
                        : { backgroundColor: 'white', color: '#9ca3af' }}>
                      ✨ Ver Depois
                    </button>
                  </div>
                )}

                {g.descricao && (
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                    <p className="text-xs font-medium text-gray-400 mb-1">Observação do profissional</p>
                    <p className="text-sm text-gray-700">{g.descricao}</p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Linha do tempo compacta dos outros registros */}
          {grupos.length > 1 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 mb-3">Todos os registros</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {grupos.map((g, i) => {
                  const url = g.depois || g.antes
                  return (
                    <button key={g.grupo_id} onClick={() => setIndexAtivo(i)}
                      className="shrink-0 flex flex-col items-center gap-1">
                      <div className={'w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ' +
                        (i === indexAtivo ? 'scale-110' : 'opacity-60')}
                        style={{ borderColor: i === indexAtivo ? cor : 'transparent' }}>
                        {url
                          ? <img src={url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-lg">📷</div>}
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(g.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
