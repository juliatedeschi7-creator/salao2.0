'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Sparkles, Calendar, ChevronLeft, ChevronRight, Heart } from 'lucide-react'

type GrupoEvolucao = {
  grupo_id: string
  data: string
  descricao?: string
  antes?: string
  depois?: string
}

export default function EvolucaoClientePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [evolucoes, setEvolucoes] = useState<GrupoEvolucao[]>([])
  const [indexAtivo, setIndexAtivo] = useState(0)
  const [ladoAtivo, setLadoAtivo] = useState<Record<string, 'antes' | 'depois'>>({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    carregarEvolucao()
  }, [loading, profile])

  async function carregarEvolucao() {
    setCarregando(true)

    // Dados do salão
    if (profile?.salao_id) {
      const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile.salao_id).single()
      setSalao(sal)
    }

    // Busca evoluções visíveis para a cliente logada
    const { data: evs } = await supabase
      .from('evolucoes')
      .select('*')
      .eq('cliente_id', profile!.id)
      .eq('visivel_cliente', true)
      .order('created_at', { ascending: false })

    if (evs) {
      const mapa: Record<string, GrupoEvolucao> = {}
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

      const lista = Object.values(mapa).sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      )
      setEvolucoes(lista)
    }

    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
      </div>
    )
  }

  const g = evolucoes[indexAtivo]
  const lado = g ? (ladoAtivo[g.grupo_id] || (g.depois ? 'depois' : 'antes')) : 'depois'
  const urlAtiva = g ? (lado === 'antes' ? g.antes : g.depois) : null
  const temAmbos = g ? !!(g.antes && g.depois) : false

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles size={20} style={{ color: cor }} />
            <h1 className="font-bold text-gray-900 text-lg">Minha Evolução</h1>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-5">
        {/* BANNER */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-400 p-5 rounded-3xl text-white shadow-sm space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-90">
            <Heart size={14} /> Seus Resultados
          </div>
          <h2 className="text-lg font-bold">Acompanhe sua transformação</h2>
          <p className="text-xs opacity-90 leading-relaxed">
            Confira o histórico de resultados e fotos registradas pela nossa equipe.
          </p>
        </div>

        {evolucoes.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto" style={{ color: cor }}>
              <Camera size={24} />
            </div>
            <h3 className="font-bold text-gray-800 text-sm">Nenhum registro disponível</h3>
            <p className="text-xs text-gray-400">
              Assim que o profissional registrar suas fotos e liberar o acesso, elas aparecerão aqui!
            </p>
          </div>
        ) : (
          <>
            {/* MINIATURAS DAS SESSÕES */}
            {evolucoes.length > 1 && (
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 mb-2">Histórico de Atendimentos</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {evolucoes.map((item, i) => {
                    const url = item.depois || item.antes
                    const selecionado = i === indexAtivo
                    return (
                      <button
                        key={item.grupo_id}
                        onClick={() => setIndexAtivo(i)}
                        className="shrink-0 flex flex-col items-center gap-1">
                        <div
                          className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${selecionado ? 'scale-105' : 'opacity-40'}`}
                          style={{ borderColor: selecionado ? cor : 'transparent' }}>
                          {url ? (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs">📷</div>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {new Date(item.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* CARD PRINCIPAL DA FOTO */}
            {g && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                    <Calendar size={14} style={{ color: cor }} />
                    {new Date(g.data).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {/* IMAGEM EXIBIDA */}
                <div className="relative bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                  {urlAtiva ? (
                    <img src={urlAtiva} alt={lado} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 flex flex-col items-center justify-center gap-2">
                      <Camera size={32} className="text-gray-300" />
                      <p className="text-xs text-gray-400">Foto {lado} não disponível</p>
                    </div>
                  )}

                  <div className="absolute top-3 left-3">
                    <span
                      className="px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-md"
                      style={{ backgroundColor: lado === 'antes' ? '#6b7280' : cor }}>
                      {lado === 'antes' ? '📷 Antes' : '✨ Depois'}
                    </span>
                  </div>
                </div>

                {/* BOTÕES ANTES / DEPOIS */}
                {temAmbos && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLadoAtivo(prev => ({ ...prev, [g.grupo_id]: 'antes' }))}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                      style={lado === 'antes' ? { backgroundColor: '#6b7280', color: 'white' } : { backgroundColor: 'white', color: '#9ca3af' }}>
                      📷 Fotos Antes
                    </button>
                    <button
                      onClick={() => setLadoAtivo(prev => ({ ...prev, [g.grupo_id]: 'depois' }))}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                      style={lado === 'depois' ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#9ca3af' }}>
                      ✨ Fotos Depois
                    </button>
                  </div>
                )}

                {/* OBSERVAÇÕES DO PROFISSIONAL */}
                {g.descricao && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Observação do Profissional
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed">{g.descricao}</p>
                  </div>
                )}

                {/* NAVEGAÇÃO DE PÁGINAS */}
                {evolucoes.length > 1 && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setIndexAtivo(Math.max(0, indexAtivo - 1))}
                      disabled={indexAtivo === 0}
                      className="flex-1 py-2.5 rounded-xl bg-white text-xs font-bold text-gray-600 flex items-center justify-center gap-1 disabled:opacity-30 shadow-sm border border-gray-100">
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <button
                      onClick={() => setIndexAtivo(Math.min(evolucoes.length - 1, indexAtivo + 1))}
                      disabled={indexAtivo === evolucoes.length - 1}
                      className="flex-1 py-2.5 rounded-xl bg-white text-xs font-bold text-gray-600 flex items-center justify-center gap-1 disabled:opacity-30 shadow-sm border border-gray-100">
                      Próximo <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

