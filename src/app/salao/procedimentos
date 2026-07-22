'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Plus, Edit2, Trash2, BookOpen, Search, X, CheckSquare, ListPlus } from 'lucide-react'

export default function GestaoProcedimentosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [procedimentos, setProcedimentos] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')
  
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  // Form State
  const [form, setForm] = useState({
    titulo: '',
    categoria: 'Biossegurança',
    conteudo: '',
    regras: ['']
  })

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    const [salRes, procRes] = await Promise.all([
      supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
      supabase.from('procedimentos')
        .select('*')
        .eq('salao_id', profile!.salao_id!)
        .eq('ativo', true)
        .order('categoria', { ascending: true })
        .order('titulo', { ascending: true })
    ])

    setSalao(salRes.data)
    setProcedimentos(procRes.data || [])
    setCarregando(false)
  }

  function abrirModal(p?: any) {
    if (p) {
      setEditando(p)
      setForm({
        titulo: p.titulo,
        categoria: p.categoria || 'Biossegurança',
        conteudo: p.conteudo || '',
        regras: p.regras && p.regras.length > 0 ? [...p.regras] : ['']
      })
    } else {
      setEditando(null)
      setForm({
        titulo: '',
        categoria: 'Biossegurança',
        conteudo: '',
        regras: ['']
      })
    }
    setModal(true)
  }

  function adicionarRegra() {
    setForm(prev => ({ ...prev, regras: [...prev.regras, ''] }))
  }

  function atualizarRegra(index: number, valor: string) {
    const novasRegras = [...form.regras]
    novasRegras[index] = valor
    setForm(prev => ({ ...prev, regras: novasRegras }))
  }

  function removerRegra(index: number) {
    setForm(prev => ({ ...prev, regras: prev.regras.filter((_, i) => i !== index) }))
  }

  async function handleSalvar() {
    if (!form.titulo.trim()) { alert('Preencha o título do procedimento.'); return }

    setSalvando(true)
    const regrasFiltradas = form.regras.filter(r => r.trim() !== '')

    const dados = {
      salao_id: profile!.salao_id,
      titulo: form.titulo,
      categoria: form.categoria,
      conteudo: form.conteudo,
      regras: regrasFiltradas,
      criado_por: profile!.id
    }

    if (editando) {
      await supabase.from('procedimentos').update(dados).eq('id', editando.id)
    } else {
      await supabase.from('procedimentos').insert(dados)
    }

    setSalvando(false)
    setModal(false)
    carregarDados()
  }

  async function excluir(id: string) {
    if (!confirm('Deseja realmente remover este documento?')) return
    await supabase.from('procedimentos').update({ ativo: false }).eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  const categoriasUnicas = ['Todos', ...Array.from(new Set(procedimentos.map(p => p.categoria || 'Geral')))]

  const filtrados = procedimentos.filter(p => {
    const combinaBusca = p.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                          p.conteudo?.toLowerCase().includes(busca.toLowerCase())
    const combinaCat = categoriaFiltro === 'Todos' || p.categoria === categoriaFiltro
    return combinaBusca && combinaCat
  })

  if (loading || carregando) return (
    <div className="min-h-screen bg-[#f8f9fa] p-4 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-xl mb-4 w-1/2" />
      <div className="h-20 bg-gray-200 rounded-2xl mb-3" />
      <div className="h-20 bg-gray-200 rounded-2xl" />
    </div>
  )

  return (
    <div className="min-h-screen pb-12 bg-[#f8f9fa]">
      {/* Topo */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Documentos & POPs</h1>
            <p className="text-xs text-gray-500">Procedimentos internos do salão</p>
          </div>
        </div>
        <button onClick={() => abrirModal()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Novo Documento
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por título ou instrução..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
          />
        </div>

        {/* Filtros de Categoria */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categoriasUnicas.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={categoriaFiltro === cat ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#6b7280' }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Lista de Documentos */}
        {filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <BookOpen size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-500">Nenhum documento encontrado.</p>
          </div>
        ) : (
          filtrados.map(p => (
            <div key={p.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wider">
                    {p.categoria}
                  </span>
                  <h3 className="font-bold text-gray-900 text-base mt-1">{p.titulo}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => abrirModal(p)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Edit2 size={14} className="text-gray-600" />
                  </button>
                  <button onClick={() => excluir(p.id)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>

              {p.conteudo && (
                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2.5 rounded-xl">
                  {p.conteudo}
                </p>
              )}

              {p.regras && p.regras.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <CheckSquare size={13} style={{ color: cor }} /> Regras e Instruções:
                  </p>
                  <ul className="space-y-1">
                    {p.regras.map((regra: string, idx: number) => (
                      <li key={idx} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5" />
                        <span>{regra}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Criar / Editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg">{editando ? 'Editar Documento' : 'Novo Documento'}</h3>
              <button onClick={() => setModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Título *</label>
              <input
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none"
                placeholder="Ex: Esterilização de Materiais"
                value={form.titulo}
                onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Categoria</label>
              <input
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none"
                placeholder="Ex: Biossegurança, Limpeza, Atendimento"
                value={form.categoria}
                onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Resumo / Observação Geral</label>
              <textarea
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none resize-none"
                placeholder="Ex: Procedimento obrigatório para todas as manicures e esteticistas."
                value={form.conteudo}
                onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))}
              />
            </div>

            {/* Lista Dinâmica de Regras */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 block">Regras / Instruções Passo a Passo</label>
              {form.regras.map((regra, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400 w-5 text-center">{idx + 1}.</span>
                  <input
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none"
                    placeholder={`Regra ${idx + 1} (ex: Usar luvas de nitrilo)`}
                    value={regra}
                    onChange={e => atualizarRegra(idx, e.target.value)}
                  />
                  {form.regras.length > 1 && (
                    <button onClick={() => removerRegra(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={adicionarRegra}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 mt-2 py-1 px-2 rounded-lg hover:bg-violet-50 transition-all"
                style={{ color: cor }}>
                <ListPlus size={16} /> Adicionar outra regra
              </button>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={salvando} className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm" style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar Documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
