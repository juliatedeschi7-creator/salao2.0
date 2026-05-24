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
  const [form, setForm] = useState({ nome: '', descricao: '', regras: '', categoria: '', sessoes: 10, validade_dias: 90, preco: '', status: 'ativo' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: pacs } = await supabase.from('pacotes').select('*').eq('salao_id', profile!.salao_id!).order('nome')
    setPacotes(pacs || [])
  }

  function abrirModal(p?: any) {
    if (p) { setEditando(p); setForm({ nome: p.nome, descricao: p.descricao || '', regras: p.regras || '', categoria: p.categoria || '', sessoes: p.sessoes, validade_dias: p.validade_dias, preco: p.preco.toString(), status: p.status }) }
    else { setEditando(null); setForm({ nome: '', descricao: '', regras: '', categoria: '', sessoes: 10, validade_dias: 90, preco: '', status: 'ativo' }) }
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome || !form.preco) return
    setSalvando(true)
    const dados = { salao_id: profile!.salao_id, nome: form.nome, descricao: form.descricao || null, regras: form.regras || null, categoria: form.categoria || null, sessoes: form.sessoes, validade_dias: form.validade_dias, preco: parseFloat(form.preco), status: form.status }
    if (editando) await supabase.from('pacotes').update(dados).eq('id', editando.id)
    else await supabase.from('pacotes').insert(dados)
    setModal(false); setSalvando(false); carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen pb-8 bg-[#f8f9fa]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Pacotes</h1>
        <button onClick={() => abrirModal()} className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}><Plus size={18} /></button>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <button onClick={() => router.push('/salao/pacotes/clientes')}
          className="card flex items-center gap-3 active:scale-95 transition-all">
          <Package size={20} style={{ color: cor }} />
          <div className="flex-1 text-left">
            <p className="font-semibold text-gray-900">Pacotes por Cliente</p>
            <p className="text-xs text-gray-400">Atribuir e gerenciar sessoes</p>
          </div>
          <span className="text-gray-300">›</span>
        </button>

        {pacotes.length === 0 ? (
          <div className="card text-center py-10"><Package size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhum pacote cadastrado</p></div>
        ) : pacotes.map(p => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900">{p.nome}</p>
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (p.status === 'ativo' ? 'bg-green-50 text-green-600' : p.status === 'rascunho' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-400')}>{p.status}</span>
                </div>
                {p.categoria && <p className="text-xs text-gray-400 mt-0.5">{p.categoria}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => abrirModal(p)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Edit2 size={14} className="text-gray-500" /></button>
                <button onClick={() => { supabase.from('pacotes').update({ status: 'inativo' }).eq('id', p.id); carregarDados() }} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-gray-50 rounded-xl p-2 text-center"><p className="text-xs text-gray-400">Sessoes</p><p className="font-bold text-gray-900">{p.sessoes}</p></div>
              <div className="bg-gray-50 rounded-xl p-2 text-center"><p className="text-xs text-gray-400">Validade</p><p className="font-bold text-gray-900">{p.validade_dias}d</p></div>
              <div className="rounded-xl p-2 text-center" style={{ backgroundColor: salao?.cor_secundaria || '#FCE4F3' }}><p className="text-xs text-gray-400">Preco</p><p className="font-bold" style={{ color: cor }}>R$ {p.preco.toFixed(2).replace('.', ',')}</p></div>
            </div>
            {p.regras && <p className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-2">{p.regras.substring(0, 80)}{p.regras.length > 80 ? '...' : ''}</p>}
          </div>
        ))}
      </div>
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">{editando ? 'Editar Pacote' : 'Novo Pacote'}</h3>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nome</label><input className="input-field" placeholder="Ex: Manicure Express
