// @ts-nocheck
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit3, Save, X } from 'lucide-react'

interface Balao {
  id: string
  texto: string
  cor: string
  emoji: string
  estilo: string
}

function QuemSomosContent() {
  const { profile, loading } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isPreview = searchParams.get('preview') === 'true'

  const [salao, setSalao] = useState<any>(null)
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

  // Estados para o modal de edição direto na página
  const [editando, setEditando] = useState(false)
  const [tituloEdit, setTituloEdit] = useState('')
  const [historiaEdit, setHistoriaEdit] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading) {
      carregarConteudo()
    }
  }, [profile, loading])

  async function carregarConteudo() {
    let salaoId: string | undefined

    const ehDonoOuFuncionario = profile?.tipo === 'dono_salao' || profile?.tipo === 'funcionario'

    if (ehDonoOuFuncionario && profile?.salao_id) {
      salaoId = profile.salao_id
    } else {
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
      if (qs) {
        setTituloEdit(qs.titulo || '')
        setHistoriaEdit(qs.historia || '')
      }
    }

    setCarregando(false)
  }

  async function salvarAlteracoes() {
    if (!salao) return
    setSalvando(true)

    const payload = {
      salao_id: salao.id,
      titulo: tituloEdit,
      historia: historiaEdit,
    }

    if (dados?.id) {
      await supabase.from('quem_somos').update(payload).eq('id', dados.id)
    } else {
      const { data: novo } = await supabase.from('quem_somos').insert(payload).select().single()
      if (novo) setDados(novo)
    }

    setDados((prev: any) => ({ ...prev, titulo: tituloEdit, historia: historiaEdit }))
    setSalvando(false)
    setEditando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const ehDono = profile?.tipo === 'dono_salao' || (salao && salao.dono_id === profile?.id)

  if (loading || carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12 bg-gray-50">
      <div className="px-4 pt-12 pb-5 flex items-center justify-between text-white shadow-sm"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)` }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-bold text-xl">{dados?.titulo || 'Nossa História'}</h1>
            <p className="text-white/80 text-xs mt-0.5">{salao?.nome || 'Salão de Beleza'}</p>
          </div>
        </div>

        {/* Botão de Editar visível para o dono do salão */}
        {ehDono && !isPreview && (
          <button onClick={() => setEditando(true)}
            className="px-3.5 py-2 rounded-xl bg-white text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition-transform shrink-0"
            style={{ color: cor }}>
            <Edit3 size={14} /> Editar
          </button>
        )}
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto flex flex-col gap-6">
        {dados?.fotos && dados.fotos.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {dados.fotos.map((url: string, index: number) => (
              <img key={index} src={url} alt="Foto do salão"
                className="w-64 h-48 rounded-3xl object-cover shadow-sm shrink-0" />
            ))}
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3">{dados?.titulo || 'Nossa História'}</h2>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
            {dados?.historia || 'A história do salão ainda não foi preenchida.'}
          </p>
        </div>

        {dados?.baloes && dados.baloes.length > 0 && (
          <div className="flex flex-col gap-3">
            {dados.baloes.map((b: Balao) => (
              <RenderBalao key={b.id} balao={b} />
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE EDIÇÃO PARA O DONO */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Editar Quem Somos</h3>
              <button onClick={() => setEditando(false)}><X size={22} className="text-gray-400" /></button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Título da Página</label>
                <input
                  type="text"
                  value={tituloEdit}
                  onChange={e => setTituloEdit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none"
                  style={{ borderColor: `${cor}66` }}
                  placeholder="Ex: Nossa História"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Texto da História</label>
                <textarea
                  rows={6}
                  value={historiaEdit}
                  onChange={e => setHistoriaEdit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none resize-none"
                  style={{ borderColor: `${cor}66` }}
                  placeholder="Conte a história do seu salão..."
                />
              </div>
            </div>

            <button
              onClick={salvarAlteracoes}
              disabled={salvando}
              className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 mt-2 disabled:opacity-50 shadow-md"
              style={{ backgroundColor: cor }}
            >
              {salvando ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={18} /> Salvar Alterações
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RenderBalao({ balao }: { balao: Balao }) {
  if (balao.estilo === 'citacao') {
    return (
      <div className="px-5 py-4 rounded-2xl border-l-4 bg-white shadow-sm border border-gray-100"
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

export default function QuemSomosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin border-pink-500" />
      </div>
    }>
      <QuemSomosContent />
    </Suspense>
  )
}
