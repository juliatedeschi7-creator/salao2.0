'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  Notebook, Plus, Search, Trash2, Edit2, Image as ImageIcon, 
  X, ArrowLeft, BookOpen, Tag, Check, Sparkles 
} from 'lucide-react'

const CATEGORIAS_SUGERIDAS = [
  'Geral', 'Cabelo', 'Unhas', 'Estética', 'Sobrancelha / Cílios', 'Atendimento', 'Limpeza / Organização'
]

export default function GuiaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  
  const [salao, setSalao] = useState<any>(null)
  const [guias, setGuias] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState('Todas')

  // Modais
  const [modalFormAberto, setModalFormAberto] = useState(false)
  const [guiaLeitura, setGuiaLeitura] = useState<any | null>(null)
  const [idEditando, setIdEditando] = useState<string | null>(null)

  // Formulário
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('Geral')
  const [conteudo, setConteudo] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    const [salRes, guiasRes] = await Promise.all([
      supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
      supabase.from('guias').select('*').eq('salao_id', profile!.salao_id!).order('created_at', { ascending: false })
    ])

    setSalao(salRes.data)
    setGuias(guiasRes.data || [])
    setCarregando(false)
  }

  function abrirModalCriar() {
    setIdEditando(null)
    setTitulo('')
    setCategoria('Geral')
    setConteudo('')
    setImagemUrl('')
    setModalFormAberto(true)
  }

  function abrirModalEditar(g: any) {
    setIdEditando(g.id)
    setTitulo(g.titulo)
    setCategoria(g.categoria || 'Geral')
    setConteudo(g.conteudo)
    setImagemUrl(g.imagem_url || '')
    setModalFormAberto(true)
  }

  async function handleSalvarGuia(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !conteudo.trim()) {
      alert('Preencha o título e as instruções do guia.')
      return
    }

    setSalvando(true)

    try {
      const dadosGuia = {
        salao_id: profile!.salao_id,
        titulo: titulo.trim(),
        categoria: categoria.trim() || 'Geral',
        conteudo: conteudo.trim(),
        imagem_url: imagemUrl.trim() || null
      }

      if (idEditando) {
        const { error } = await supabase.from('guias').update(dadosGuia).eq('id', idEditando)
        if (error) throw error
      } else {
        const { error } = await supabase.from('guias').insert([dadosGuia])
        if (error) throw error
      }

      setModalFormAberto(false)
      carregarDados()
    } catch (err: any) {
      alert('Erro ao salvar o guia: ' + (err.message || 'Tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluirGuia(id: string) {
    if (!confirm('Deseja realmente excluir este guia?')) return

    try {
      const { error } = await supabase.from('guias').delete().eq('id', id)
      if (error) throw error
      if (guiaLeitura?.id === id) setGuiaLeitura(null)
      carregarDados()
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  // Filtragem
  const guiasFiltrados = guias.filter(g => {
    const atendeBusca = g.titulo.toLowerCase().includes(busca.toLowerCase()) || 
                       g.conteudo.toLowerCase().includes(busca.toLowerCase())
    const atendeCat = catFiltro === 'Todas' || g.categoria === catFiltro
    return atendeBusca && atendeCat
  })

  const categoriasDisponiveis = ['Todas', ...Array.from(new Set([...CATEGORIAS_SUGERIDAS, ...guias.map(g => g.categoria)]))]

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: cor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Notebook size={22} style={{ color: cor }} />
            <h1 className="font-bold text-gray-900 text-lg">Guia & Procedimentos</h1>
          </div>
        </div>

        <button
          onClick={abrirModalCriar}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-xs font-bold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Novo Guia
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">

        {/* BARRA DE PESQUISA */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar passo a passo, tarefa, produto..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-gray-100 text-sm focus:outline-none shadow-sm"
          />
        </div>

        {/* FILTRO DE CATEGORIAS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categoriasDisponiveis.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFiltro(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                catFiltro === cat ? 'text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-100'
              }`}
              style={{ backgroundColor: catFiltro === cat ? cor : undefined }}>
              {cat}
            </button>
          ))}
        </div>

        {/* LISTAGEM DE GUIAS */}
        {guiasFiltrados.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center space-y-3 mt-4 shadow-sm">
            <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto" style={{ color: cor }}>
              <Notebook size={28} />
            </div>
            <h3 className="font-bold text-gray-800 text-base">Nenhum guia encontrado</h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {busca || catFiltro !== 'Todas' 
                ? 'Tente mudar a busca ou os filtros acima.' 
                : 'Cadastre o primeiro guia de instrução para sua equipe (ex: Protocolo de Lavatório, Higienização, etc).'}
            </p>
            <button
              onClick={abrirModalCriar}
              className="mt-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
              style={{ backgroundColor: cor }}>
              <Plus size={16} /> Cadastrar Guia
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guiasFiltrados.map(g => (
              <div 
                key={g.id} 
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:border-pink-200 transition-all cursor-pointer"
                onClick={() => setGuiaLeitura(g)}>
                
                {/* FOTO DO GUIA (SE HOUVER) */}
                {g.imagem_url && (
                  <div className="h-44 w-full bg-gray-100 relative overflow-hidden">
                    <img src={g.imagem_url} alt={g.titulo} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-100">
                        {g.categoria || 'Geral'}
                      </span>
                      
                      {/* BOTÕES DE AÇÃO RÁPIDA */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => abrirModalEditar(g)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleExcluirGuia(g.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <h2 className="font-bold text-gray-900 text-base leading-snug">{g.titulo}</h2>
                    <p className="text-xs text-gray-500 line-clamp-3 mt-1.5 leading-relaxed">
                      {g.conteudo}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-gray-50 flex items-center justify-between text-xs font-semibold" style={{ color: cor }}>
                    <span className="flex items-center gap-1"><BookOpen size={14} /> Ler instrução</span>
                    <span className="text-[10px] text-gray-300 font-normal">
                      {new Date(g.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MODAL DE LEITURA COMPLETA ───────────────────────────────── */}
      {guiaLeitura && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl my-auto">
            
            {guiaLeitura.imagem_url && (
              <div className="w-full max-h-72 bg-gray-900 relative">
                <img src={guiaLeitura.imagem_url} alt={guiaLeitura.titulo} className="w-full h-full object-contain" />
                <button 
                  onClick={() => setGuiaLeitura(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm">
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="p-6 space-y-4">
              {!guiaLeitura.imagem_url && (
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-pink-50 text-pink-700">
                    {guiaLeitura.categoria}
                  </span>
                  <button onClick={() => setGuiaLeitura(null)}>
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>
              )}

              {guiaLeitura.imagem_url && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-pink-50 text-pink-700 inline-block">
                  {guiaLeitura.categoria}
                </span>
              )}

              <h2 className="text-xl font-bold text-gray-900 leading-tight">{guiaLeitura.titulo}</h2>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {guiaLeitura.conteudo}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button 
                  onClick={() => {
                    const g = guiaLeitura
                    setGuiaLeitura(null)
                    abrirModalEditar(g)
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900">
                  <Edit2 size={15} /> Editar Guia
                </button>

                <button 
                  onClick={() => setGuiaLeitura(null)}
                  className="px-5 py-2.5 rounded-xl text-white text-xs font-bold"
                  style={{ backgroundColor: cor }}>
                  Entendi / Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CRIAR / EDITAR GUIA ────────────────────────────── */}
      {modalFormAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form 
            onSubmit={handleSalvarGuia} 
            className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-xl space-y-4 my-auto">
            
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Notebook size={20} style={{ color: cor }} /> 
                {idEditando ? 'Editar Guia' : 'Novo Guia de Tarefa'}
              </h3>
              <button type="button" onClick={() => setModalFormAberto(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* TÍTULO */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Título do Guia / Tarefa *</label>
              <input
                type="text"
                placeholder="Ex: Passo a Passo de Morena Iluminada"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* CATEGORIA */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Categoria</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none bg-white">
                {CATEGORIAS_SUGERIDAS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* LINK DA FOTO */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">URL / Link da Foto (Opcional)</label>
              <div className="relative">
                <ImageIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  placeholder="https://exemplo.com/foto.jpg"
                  value={imagemUrl}
                  onChange={e => setImagemUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Cole o link de uma imagem da internet ou do Pinterest para ilustrar.
              </p>
            </div>

            {/* PREVIEW DA FOTO */}
            {imagemUrl && (
              <div className="h-32 w-full rounded-xl bg-gray-100 overflow-hidden border">
                <img src={imagemUrl} alt="Preview" className="w-full h-full object-cover" onError={() => {}} />
              </div>
            )}

            {/* INSTRUÇÕES / CONTEÚDO */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Instruções / Passo a Passo *</label>
              <textarea
                rows={5}
                placeholder="Descreva detalhadamente o processo, produtos utilizados, tempo de pausa e recomendações..."
                value={conteudo}
                onChange={e => setConteudo(e.target.value)}
                required
                className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* BOTÕES */}
            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setModalFormAberto(false)} 
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium">
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={salvando}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-medium" 
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar Guia'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
