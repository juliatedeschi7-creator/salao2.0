'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Plus, CheckSquare, Square, Trash2, 
  History, Clock, CheckCircle2, AlertCircle, X, Sparkles
} from 'lucide-react'

export default function LembretesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [lembretes, setLembretes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'pendentes' | 'historico'>('pendentes')
  const [modalNovo, setModalNovo] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    if (profile.salao_id) carregarLembretes()
  }, [loading, profile])

  async function carregarLembretes() {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('lembretes')
        .select('*')
        .eq('salao_id', profile!.salao_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLembretes(data || [])
    } catch (err: any) {
      console.error('Erro ao carregar lembretes:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function criarLembrete(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return

    setSalvando(true)
    try {
      const { error } = await supabase.from('lembretes').insert({
        salao_id: profile!.salao_id,
        criado_por: profile!.id,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        concluido: false
      })

      if (error) throw error

      setTitulo('')
      setDescricao('')
      setModalNovo(false)
      carregarLembretes()
    } catch (err: any) {
      alert('Erro ao criar lembrete: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function alternarConcluido(lembrete: any) {
    const novoStatus = !lembrete.concluido
    
    // Atualização otimista na tela
    setLembretes(prev => prev.map(l => l.id === lembrete.id ? {
      ...l,
      concluido: novoStatus,
      concluido_em: novoStatus ? new Date().toISOString() : null
    } : l))

    try {
      const { error } = await supabase.from('lembretes').update({
        concluido: novoStatus,
        concluido_por: novoStatus ? profile!.id : null,
        concluido_em: novoStatus ? new Date().toISOString() : null
      }).eq('id', lembrete.id)

      if (error) throw error
    } catch (err) {
      carregarLembretes() // Reverte em caso de erro
    }
  }

  async function excluirLembrete(id: string) {
    if (!confirm('Deseja excluir este lembrete?')) return

    setLembretes(prev => prev.filter(l => l.id !== id))
    await supabase.from('lembretes').delete().eq('id', id)
  }

  const pendentes = lembretes.filter(l => !l.concluido)
  const historico = lembretes.filter(l => l.concluido)

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* Topbar */}
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Lembretes & Tarefas</h1>
        <button 
          onClick={() => setModalNovo(true)}
          className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform">
          <Plus size={20} />
        </button>
      </div>

      {/* Abas */}
      <div className="px-4 mt-4 flex gap-2">
        <button 
          onClick={() => setAba('pendentes')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            aba === 'pendentes' ? 'bg-pink-500 text-white shadow-sm' : 'bg-white text-gray-400'
          }`}>
          <CheckSquare size={16} />
          Checklist ({pendentes.length})
        </button>
        <button 
          onClick={() => setAba('historico')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            aba === 'historico' ? 'bg-pink-500 text-white shadow-sm' : 'bg-white text-gray-400'
          }`}>
          <History size={16} />
          Histórico ({historico.length})
        </button>
      </div>

      {/* Lista de Lembretes */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {carregando ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-white rounded-2xl p-4 animate-pulse flex items-center gap-3">
                <div className="w-5 h-5 bg-gray-200 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : aba === 'pendentes' ? (
          pendentes.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center flex flex-col items-center">
              <CheckCircle2 size={40} className="text-emerald-400 mb-2" />
              <p className="font-semibold text-gray-700">Tudo em dia!</p>
              <p className="text-xs text-gray-400 mt-1">Nenhum lembrete pendente para o salão no momento.</p>
            </div>
          ) : (
            pendentes.map(l => (
              <div key={l.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
                <button 
                  onClick={() => alternarConcluido(l)}
                  className="mt-0.5 text-gray-300 hover:text-pink-500 transition-colors">
                  <Square size={22} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 leading-snug">{l.titulo}</p>
                  {l.descricao && <p className="text-xs text-gray-500 mt-1">{l.descricao}</p>}
                  <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                    <Clock size={11} /> Criado em {new Date(l.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button 
                  onClick={() => excluirLembrete(l.id)}
                  className="text-gray-300 hover:text-red-500 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )
        ) : (
          historico.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">
              Nenhum lembrete concluído ainda.
            </div>
          ) : (
            historico.map(l => (
              <div key={l.id} className="bg-white/70 rounded-2xl p-4 border border-gray-100 flex items-start gap-3 opacity-75">
                <button 
                  onClick={() => alternarConcluido(l)}
                  className="mt-0.5 text-emerald-500 transition-colors">
                  <CheckSquare size={22} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-600 line-through leading-snug">{l.titulo}</p>
                  {l.descricao && <p className="text-xs text-gray-400 mt-1">{l.descricao}</p>}
                  {l.concluido_em && (
                    <p className="text-[10px] text-emerald-600 mt-2">
                      Concluído em {new Date(l.concluido_em).toLocaleDateString('pt-BR')} às {new Date(l.concluido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => excluirLembrete(l.id)}
                  className="text-gray-300 hover:text-red-500 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )
        )}
      </div>

      {/* Modal Criar Lembrete */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form onSubmit={criarLembrete} className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Novo Lembrete</h3>
              <button type="button" onClick={() => setModalNovo(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Título / Tarefa *</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Comprar toalhas novas, Limpar recepção..."
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Detalhes (Opcional)</label>
              <textarea 
                rows={3}
                placeholder="Ex: Pegar com o fornecedor X no período da manhã"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
              />
            </div>

            <button 
              type="submit"
              disabled={salvando || !titulo.trim()}
              className="w-full py-3.5 bg-pink-500 text-white font-semibold rounded-2xl shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
              {salvando ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus size={18} />
                  Adicionar Lembrete
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
