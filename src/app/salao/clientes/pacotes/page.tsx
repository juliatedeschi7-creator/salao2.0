'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Package, Edit2, Trash2 } from 'lucide-react'

export default function PacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({
    nome: '', descricao: '', regras: '', categoria: '',
    sessoes: 10, validade_dias: 90, preco: '', status: 'ativo'
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*')
      .eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: pacs } = await supabase.from('pacotes').select('*')
      .eq('salao_id', profile!.salao_id!).order('nome')
    setPacotes(pacs || [])
  }

  function abrirModal(pacote?: any) {
    if (pacote) {
      setEditando(pacote)
      setForm({
        nome: pacote.nome,
        descricao: pacote.descricao || '',
        regras: pacote.regras || '',
        categoria: pacote.categoria || '',
        sessoes: pacote.sessoes,
        validade_dias: pacote.validade_dias,
        preco: pacote.preco.toString(),
        status: pacote.status,
      })
    } else {
      setEditando(null)
      setForm({ nome: '', descricao: '', regras: '', categoria: '', sessoes: 10, validade_dias: 90, preco: '', status: 'ativo' })
    }
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome || !form.preco) return
    setSalvando(true)

    const dados = {
      salao_id: profile!.salao_id,
      nome: form.nome,
      descricao: form.descricao || null,
      regras: form.regras || null,
      categoria: form.categoria || null,
      sessoes: form.sessoes,
      validade_dias: form.validade_dias,
      preco: parseFloat(form.preco),
      status: form.status,
    }

    if (editando) {
      await supabase.from('pacotes').update(dados).eq('id', editando.id)
    } else {
      await supabase.from('pacotes').insert(dados)
    }

    setModal(false)
    setSalvando(false)
    carregarDados()
  }

  async function excluir(id: string) {
    await supabase.from('pacotes').update({ status: 'inativo' }).eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f4f6] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Pacotes</h1>
        <button onClick={() => abrirModal()}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {pacotes.length === 0 ? (
          <div className="card text-center py-10">
            <Package size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum pacote cadastrado</p>
            <button onClick={() => abrirModal()}
              className="mt-3 px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: cor }}>
              + Criar pacote
            </button>
          </div>
        ) : (
          pacotes.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{p.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'ativo' ? 'bg-green-50 text-green-600' : p.status === 'rascunho' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-400'}`}>
                      {p.status}
                    </span>
                  </div>
                  {p.categoria && (
                    <p className="text-xs text-gray-400 mt-0.5">{p.categoria}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => abrirModal(p)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Edit2 size={14} className="text-gray-500" />
                  </button>
                  <button onClick={() => excluir(p.id)}
                    className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-400">Sessões</p>
                  <p className="font-bold text-gray-900">{p.sessoes}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-400">Validade</p>
                  <p className="font-bold text-gray-900">{p.validade_dias}d</p>
                </div>
                <div className="rounded-xl p-2 text-center" style={{ backgroundColor: salao?.cor_secundaria || '#FCE4F3' }}>
                  <p className="text-xs text-gray-400">Preço</p>
                  <p className="font-bold" style={{ color: cor }}>R$ {p.preco.toFixed(2).replace('.', ',')}</p>
                </div>
              </div>

              {p.regras && (
                <p className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-2">
                  📋 {p.regras.substring(0, 80)}{p.regras.length > 80 ? '...' : ''}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">
              {editando ? 'Editar Pacote' : 'Novo Pacote'}
            </h3>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Nome</label>
              <input className="input-field" placeholder="Ex: Manicure Express 10x"
                value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Categoria</label>
              <input className="input-field" placeholder="Ex: Unhas, Cabelo..."
                value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Descrição</label>
              <textarea className="input-field resize-none" rows={2}
                placeholder="Descrição do pacote..."
                value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Regras do pacote
              </label>
              <textarea className="input-field resize-none" rows={3}
                placeholder="Ex: Pacote não transferível, válido por 90 dias..."
                value={form.regras} onChange={e => setForm(p => ({ ...p, regras: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Sessões</label>
                <input className="input-field" type="number"
                  value={form.sessoes}
                  onChange={e => setForm(p => ({ ...p, sessoes: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Validade (dias)</label>
                <input className="input-field" type="number"
                  value={form.validade_dias}
                  onChange={e => setForm(p => ({ ...p, validade_dias: parseInt(e.target.value) }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Preço (R$)</label>
                <input className="input-field" type="number" placeholder="0,00"
                  value={form.preco} onChange={e => setForm(p => ({ ...p, preco: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Status</label>
                <select className="input-field" value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="ativo">Ativo</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={salvando}
                className="flex-1 py-3 rounded-2xl text-white font-medium"
                style={{ backgroundColor: cor }}>
                {salvando ? '...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
