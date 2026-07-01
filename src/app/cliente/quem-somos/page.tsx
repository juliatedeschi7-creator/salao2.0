'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Heart } from 'lucide-react'

interface Balao {
  id: string
  texto: string
  cor: string
  emoji: string
  estilo: string
}

export default function QuemSomosClientePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [fotoAtiva, setFotoAtiva] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    // busca o salão pelo profile do cliente
    const { data: cli } = await supabase
      .from('clientes')
      .select('*, saloes(*)')
      .eq('profile_id', profile!.id)
      .maybeSingle()

    if (cli?.saloes) setSalao(cli.saloes)

    const salaoId = cli?.saloes?.id
    if (salaoId) {
      const { data } = await supabase.from('quem_somos').select('*').eq('salao_id', salaoId).maybeSingle()
      setDados(data)
    }
    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'

  const partes = salao?.nome?.split(' - ')
  const nomePrincipal = partes?.[0]
  const nomeSecundario = partes?.[1]

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  if (!dados || (!dados.historia && !dados.fotos?.length && !dados.baloes?.length)) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f4f4f8' }}>
        <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h1 className="text-white font-bold text-xl">{dados?.titulo || 'Quem Somos'}</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <Heart size={40} className="text-gray-200" />
          <p className="text-gray-400">Esta página ainda não foi preenchida pelo salão.</p>
          <button onClick={() => router.back()} className="text-sm font-medium" style={{ color: cor }}>Voltar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#f4f4f8' }}>
      {/* Header */}
      <div className="relative px-4 pt-12 pb-8 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, ${cor}bb 100%)` }}>
        <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full opacity-10 bg-white" />

        <button onClick={() => router.back()}
          className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-5">
          <ArrowLeft size={18} className="text-white" />
        </button>

        <div className="relative flex items-end gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center">
            <Heart size={24} className="text-white" />
          </div>
          <div>
            <p className="text-white/70 text-xs">{dados?.titulo || 'Quem Somos'}</p>
            <p className="text-white font-bold text-lg leading-tight">{nomePrincipal}</p>
            {nomeSecundario && <p className="text-white/60 text-xs">{nomeSecundario}</p>}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-5">

        {/* História */}
        {dados.historia && (
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{dados.historia}</p>
          </div>
        )}

        {/* Fotos */}
        {dados.fotos?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Nossos momentos</p>
            <div className="grid grid-cols-2 gap-2">
              {dados.fotos.map((url: string, i: number) => (
                <button key={i} onClick={() => setFotoAtiva(url)}
                  className="relative overflow-hidden rounded-2xl active:scale-95 transition-all"
                  style={{ aspectRatio: i === 0 ? '2/1' : '1/1', gridColumn: i === 0 ? 'span 2' : 'span 1' }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Balões */}
        {dados.baloes?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">O que nos move</p>
            <div className="flex flex-col gap-3">
              {dados.baloes.map((b: Balao, i: number) => (
                <div key={b.id}
                  className={`${i % 2 === 0 ? 'mr-8' : 'ml-8'}`}
                  style={{ animationDelay: `${i * 0.1}s` }}>
                  <BalaoVisual balao={b} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <Heart size={14} style={{ color: cor }} />
          <p className="text-xs text-gray-400">Com amor, {nomePrincipal}</p>
          <Heart size={14} style={{ color: cor }} />
        </div>
      </div>

      {/* Lightbox de foto */}
      {fotoAtiva && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setFotoAtiva(null)}>
          <button onClick={() => setFotoAtiva(null)}
            className="absolute top-6 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white text-xl">✕</span>
          </button>
          <img src={fotoAtiva} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  )
}

function BalaoVisual({ balao }: { balao: Balao }) {
  if (balao.estilo === 'citacao') {
    return (
      <div className="px-5 py-4 rounded-2xl border-l-4 bg-white shadow-sm"
        style={{ borderColor: balao.cor }}>
        {balao.emoji && <span className="text-2xl block mb-2">{balao.emoji}</span>}
        <p className="text-sm font-medium italic leading-relaxed" style={{ color: balao.cor }}>
          "{balao.texto}"
        </p>
      </div>
    )
  }
  if (balao.estilo === 'destaque') {
    return (
      <div className="px-5 py-4 rounded-2xl text-white shadow-md"
        style={{ background: `linear-gradient(135deg, ${balao.cor}, ${balao.cor}cc)` }}>
        {balao.emoji && <span className="text-2xl block mb-2">{balao.emoji}</span>}
        <p className="text-sm font-bold leading-relaxed">{balao.texto}</p>
      </div>
    )
  }
  // bolha
  return (
    <div className="px-5 py-4 rounded-3xl rounded-bl-none text-white shadow-md"
      style={{ background: `linear-gradient(135deg, ${balao.cor}, ${balao.cor}cc)` }}>
      {balao.emoji && <span className="text-xl mr-2">{balao.emoji}</span>}
      <span className="text-sm font-medium leading-relaxed">{balao.texto}</span>
    </div>
  )
}