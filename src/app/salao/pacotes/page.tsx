'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Plus, Package, Edit2, Trash2, Users } from 'lucide-react'

export default function PacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', descricao: '', sessoes_inclusas: 1, preco: '', validade_dias: '', regras: '' })
  const [salvando, setSalvando] = useState(false)

useEffect(() => {
  if (loading) return
  if (!profile) return
  if (profile.role !== 'dono_salao' && profile.role !== 'funcionario') { router.push('/login'); return }
  if (profile.salao_id) carregarDados()
}, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: pacs } = await supabase.from('pacotes').select('*').eq('salao_id', profile!.salao_id!).eq('ativo', true).order('created_at', { ascending: false })
    setPacotes(pacs || [])
  }

  function abrirModal(p?: any) {
    if (p) {
      setEditando(p)
      setForm({ nome: p.nome, descricao: p.descricao || '', sessoes_inclusas: p.sessoes_inclusas, preco: p.preco.toString(), validade_dias: p.validade_dias?.toString() || '', regras: p.regras || '' })
    } else {
      setEditando(null)
      setForm({ nome: '', descricao: '', sessoes_inclusas: 1, preco: '', validade_dias: '', regras: '' })
    }
    setModal(true)
  }

  async function salvar() {
    if (!form.nome || !form.preco) return
    setSalvando(true)
    const dados = {
      salao_id: profile!.salao_id,
      nome: form.nome,
      descricao: form.descricao || null,
      sessoes_inclusas: form.sessoes_inclusas,
      preco: parseFloat(form.preco),
      validade_dias: form.validade_dias ? parseInt(form.validade_dias) : null,
      regras: form.regras || null,
      criado_por: profile!.id,
    }
    if (editando) await supabase.from('pacotes').update(dados).eq('id', editando.id)
    else await supabase.from('pacotes').insert(dados)
    setModal(false); setSalvando(false); carregarDados()
  }

  async function excluir(id: string) {
    await supabase.from('pacotes').update({ ativo: false }).eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Pacotes</h1>
        <button onClick={() => abrirModal()} className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <button onClick={() => router.push('/salao/pacotes/clientes')}
          className="card flex items-center gap-3 active:scale-95 transition-all">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: salao?.cor_secundaria || '#FCE4F3' }}>
            <Users size={20} style={{ color: cor }} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-gray-900">Pacotes por Cliente</p>
            <p className="text-xs text-gray-400">Ver sessoes, historico e vender pacotes</p>
          </div>
        </button>

        <p className="text-sm font-semibold text-gray-700 mt-2">Modelos de Pacotes</p>

        {pacotes.length === 0 ? (
          <div className="card text-center py-10"><Package size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhum pacote criado</p></div>
        ) : pacotes.map(p => (
          <div key={p.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900">{p.nome}</p>
                {p.descricao && <p className="text-sm text-gray-500">{p.descricao}</p>}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => abrirModal(p)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Edit2 size={14} className="text-gray-500" /></button>
                <button onClick={() => excluir(p.id)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.sessoes_inclusas} sessoes</span>
              {p.validade_dias && <span className="text-xs text-gray-400">Validade: {p.validade_dias} dias</span>}
            </div>
            <p className="font-bold" style={{ color: cor }}>R$ {p.preco.toFixed(2).replace('.', ',')}</p>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">{editando ? 'Editar Pacote' : 'Novo Pacote'}</h3>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nome do pacote</label><input className="input-field" placeholder="Ex: Pacote 10 sessoes Limpeza de Pele" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Descricao</label><textarea className="input-field resize-none" rows={3} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Sessoes inclusas</label><input className="input-field" type="number" min="1" value={form.sessoes_inclusas} onChange={e => setForm(p => ({ ...p, sessoes_inclusas: parseInt(e.target.value) }))} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Preco (R$)</label><input className="input-field" type="number" value={form.preco} onChange={e => setForm(p => ({ ...p, preco: e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Validade (dias, opcional)</label><input className="input-field" type="number" placeholder="Ex: 90" value={form.validade_dias} onChange={e => setForm(p => ({ ...p, validade_dias: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Regras (opcional)</label><textarea className="input-field resize-none" rows={2} placeholder="Ex: Nao acumula com outras promocoes" value={form.regras} onChange={e => setForm(p => ({ ...p, regras: e.target.value }))} /></div>
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