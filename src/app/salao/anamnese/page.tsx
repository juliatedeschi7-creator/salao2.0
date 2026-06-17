'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, FileText, Trash2, Edit2 } from 'lucide-react'

export default function AnamnesePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [fichas, setFichas] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [perguntas, setPerguntas] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: fs } = await supabase.from('fichas_anamnese').select('*').eq('salao_id', profile!.salao_id!).order('created_at', { ascending: false })
    setFichas(fs || [])
  }

  function abrirModal(f?: any) {
    if (f) { setEditando(f); setTitulo(f.titulo); setCategoria(f.categoria); setPerguntas(f.perguntas || []) }
    else { setEditando(null); setTitulo(''); setCategoria(''); setPerguntas([]) }
    setModal(true)
  }

  function adicionarPergunta() {
    setPerguntas(prev => [...prev, { id: Date.now().toString(), pergunta: '', tipo: 'texto', opcoes: [] }])
  }

  function atualizarPergunta(id: string, campo: string, valor: any) {
    setPerguntas(prev => prev.map(p => p.id === id ? { ...p, [campo]: valor } : p))
  }

  function removerPergunta(id: string) {
    setPerguntas(prev => prev.filter(p => p.id !== id))
  }

  async function salvar() {
    if (!titulo || !categoria) return
    setSalvando(true)
    const dados = { salao_id: profile!.salao_id, titulo, categoria, perguntas, ativa: true }
    if (editando) await supabase.from('fichas_anamnese').update({ ...dados, versao: (editando.versao || 1) + 1 }).eq('id', editando.id)
    else await supabase.from('fichas_anamnese').insert(dados)
    setModal(false); setSalvando(false); carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Fichas de Anamnese</h1>
        <button onClick={() => abrirModal()}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {fichas.length === 0 ? (
          <div className="card text-center py-10">
            <FileText size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhuma ficha criada</p>
          </div>
        ) : fichas.map(f => (
          <div key={f.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900">{f.titulo}</p>
                <p className="text-xs text-gray-400">{f.categoria} • {(f.perguntas || []).length} perguntas • v{f.versao}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => abrirModal(f)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Edit2 size={14} className="text-gray-500" /></button>
                <button onClick={() => { supabase.from('fichas_anamnese').update({ ativa: false }).eq('id', f.id); carregarDados() }}
                  className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            </div>
            <button onClick={() => router.push('/salao/anamnese/responder?ficha=' + f.id)}
              className="text-sm font-medium" style={{ color: cor }}>
              Ver respostas dos clientes
            </button>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">{editando ? 'Editar Ficha' : 'Nova Ficha'}</h3>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Titulo</label><input className="input-field" placeholder="Ex: Avaliacao inicial" value={titulo} onChange={e => setTitulo(e.target.value)} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Categoria</label><input className="input-field" placeholder="Ex: Estetica, Cabelo..." value={categoria} onChange={e => setCategoria(e.target.value)} /></div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Perguntas</p>
                <button onClick={adicionarPergunta} className="text-sm font-medium" style={{ color: cor }}>+ Adicionar</button>
              </div>
              {perguntas.map((p, i) => (
                <div key={p.id} className="bg-gray-50 rounded-xl p-3 mb-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">Pergunta {i + 1}</p>
                    <button onClick={() => removerPergunta(p.id)}><Trash2 size={14} className="text-red-400" /></button>
                  </div>
                  <input className="input-field" placeholder="Digite a pergunta..." value={p.pergunta} onChange={e => atualizarPergunta(p.id, 'pergunta', e.target.value)} />
                  <select className="input-field" value={p.tipo} onChange={e => atualizarPergunta(p.id, 'tipo', e.target.value)}>
                    <option value="texto">Texto livre</option>
                    <option value="boolean">Sim / Nao</option>
                    <option value="select">Multipla escolha</option>
                  </select>
                  {p.tipo === 'select' && (
                    <input className="input-field" placeholder="Opcoes separadas por virgula"
                      value={p.opcoes?.join(', ') || ''}
                      onChange={e => atualizarPergunta(p.id, 'opcoes', e.target.value.split(',').map((o: string) => o.trim()))} />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>{salvando ? '...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
