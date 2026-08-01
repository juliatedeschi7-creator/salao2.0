'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Edit3 } from 'lucide-react'

interface Balao {
  id: string
  texto: string
  cor: string
  emoji: string
  estilo: string
}

export default function QuemSomosPage() {
  const { profile, loading } = useAuth()
  const searchParams = useSearchParams()
  const isPreview = searchParams.get('preview') === 'true'

  const [salao, setSalao] = useState<any>(null)
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarConteudo()
  }, [profile, loading])

  async function carregarConteudo() {
    let salaoId: string | undefined

    const ehDonoOuFuncionario = profile?.tipo === 'dono_salao' || profile?.tipo === 'funcionario'

    if (ehDonoOuFuncionario && profile?.salao_id) {
      salaoId = profile.salao_id
    } else {
      // Se for cliente final, busca o primeiro salão ou parâmetro padrão
      const { data: saloes } = await supabase.from('saloes').select('id').limit(1)
      if (saloes && saloes.length > 0) {
        salaoId = saloes[0].id
      }
    }

    if (salaoId) {
      const { data: sal } = await supabase.from('saloes').select('*').eq('id', salaoId).single()
      setSalao(sal)

      const { data: qs } = await supabase.from('quem_somos').select('*').eq('salao_id', salaoId).maybeSingle()
      setDados(qs)
    }

    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: '#f4f4f8' }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-5 flex items-center gap-3 text-white shadow-sm"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)` }}>
        <button onClick={() => window.history.back()}
          className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-xl">{dados?.titulo || 'Nossa História'}</h1>
          <p className="text-white/80 text-xs mt-0.5">{salao?.nome || 'Salão de Beleza'}</p>
        </div>
        {profile?.tipo === 'dono_salao' && !isPreview && (
          <button onClick={() => window.location.href = '/cliente/quem-somos/edicao'}
            className="px-3 py-2 rounded-xl bg-white text-xs font-bold flex items-center gap-1.5 shadow"
            style={{ color: cor }}>
            <Edit3 size={14} /> Editar
          </button>
        )}
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto flex flex-col gap-6">
        {/* Fotos */}
        {dados?.fotos && dados.fotos.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {dados.fotos.map((url: string, index: number) => (
              <img key={index} src={url} alt="Foto do salão"
                className="w-64 h-48 rounded-3xl object-cover shadow-sm shrink-0" />
            ))}
          </div>
        )}

        {/* História */}
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-3">{dados?.titulo || 'Nossa História'}</h2>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
            {dados?.historia || 'A história do salão ainda não foi preenchida.'}
          </p>
        </div>

        {/* Balões / Frases em destaque */}
        {dados?.baloes && dados.baloes.length > 0 && (
          <div className="flex flex-col gap-3">
            {dados.baloes.map((b: Balao) => (
              <RenderBalao key={b.id} balao={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RenderBalao({ balao }: { balao: Balao }) {
  if (balao.estilo === 'citacao') {
    return (
      <div className="px-5 py-4 rounded-2xl border-l-4 bg-white shadow-sm"
        style={{ borderColor: balao.cor }}>
        {balao.emoji && <span className="text-lg mr-2">{balao.emoji}</span>}
        <span className="text-sm font-medium italic" style={{ color: balao.cor }}>{balao.texto}</span>
      </div>
    )
  }
  if (balao.estilo === 'destaque') {
    return (
      <div className="px-5 py-4 rounded-2xl text-white shadow-sm"
        style={{ backgroundColor: balao.cor }}>
        {balao.emoji && <span className="text-lg mr-2">{balao.emoji}</span>}
        <span className="text-sm font-bold">{balao.texto}</span>
      </div>
    )
  }
  return (
    <div className="px-5 py-4 rounded-3xl rounded-bl-none text-white shadow-sm"
      style={{ backgroundColor: balao.cor }}>
      {balao.emoji && <span className="text-lg mr-2">{balao.emoji}</span>}
      <span className="text-sm font-medium">{balao.texto}</span>
    </div>
  )
}
