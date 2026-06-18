'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Trash2, Package2 } from 'lucide-react'

export default function CombosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [combos, setCombos] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', descricao: '', preco: '', servicosIds: [] as string[] })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: cmbs } = await supabase.from('combos').select('*').eq('salao_id', profile!.salao_id!).eq('ativo', true).order('created_at', { ascending: false })
    setCombos(cmbs || [])
    const { data: srvs } = await supabase.from('servicos').select('id, nome').eq('salao_id', profile!.salao_id!).eq('ativo', true)
    setServicos(srvs || [])
  }

  function abrirModal(c?: any) {
    if (c) { setEditando(c); setForm({ nome: c.nome, descricao: c.descricao || '', preco: c.preco.toString(), servicosIds: c.servicos_ids || [] }) }
    else { setEditando(null); setForm({ nome: '', descricao: '', preco: '', servicosIds: [] }) }
    setModal(true)
  }

  function toggleServico(id: string) {
    setForm(p => ({
      ...p,
      servicosIds: p.servicosIds.includes(id) ? p.servicosIds.filter(s => s !== id) : [...p.servicosIds, id]
    }))
  }

  async function salvar() {
    if (!form.nome || !form.preco) return
    setSalvando(true)
    const dados = { salao_id: profile!.salao_id, nome: form.nome, descricao: form.descricao || null, preco: parseFloat(form.preco), servicos_ids: form.servicosIds }
    if (editando) await supabase.from('combos').update(dados).eq('id', editando.id)
    else await supabase.from('combos').insert(dados)
    setModal(false); setSalvando(false); carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Combos Promocionais</h1>
        <button onClick={() => abrirModal()} className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {combos.length === 0 ? (
          <div className="card text-center py-10">
            <Package2 size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum combo criado</p>
            <button onClick={() => abrirModal()} className="mt-3 px-4 py-2 rounded-full text-sm font-medium text-white" style={{ backgroundColor: cor }}>+ Criar combo</button>
          </div>
        ) : combos.map(c => {
          const srvsDoCombo = servicos.filter(s => c.servicos_ids?.includes(s.id))
          return (
            <div key={c.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{c.nome}</p>
                  {c.descricao && <p className="text-sm text-gray-500">{c.descricao}</p>}
                  {srvsDoCombo.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">Inclui: {srvsDoCombo.map(s => s.nome).join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-1.5 ml-2">
                  <button onClick={() => abrirModal(c)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Edit2 size={14} className="text-gray-500" /></button>
                  <button onClick={() => { supabase.from('combos').update({ ativo: false }).eq('id', c.id); carregarDados() }} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
              <p className="font-bold" style={{ color: cor }}>R$ {c.preco.toFixed(2).replace('.', ',')}</p>
            </div>
          )
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">{editando ? 'Editar Combo' : 'Novo Combo'}</h3>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nome</label><input className="input-field" placeholder="Ex: Combo Noiva Completo" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Descricao</label><textarea className="input-field resize-none" rows={2} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Preco (R$)</label><input className="input-field" type="number" value={form.preco} onChange={e => setForm(p => ({ ...p, preco: e.target.value }))} /></div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Servicos incluidos</label>
              {servicos.map(s => (
                <button key={s.id} onClick={() => toggleServico(s.id)}
                  className={'w-full text-left px-4 py-3 rounded-xl mb-2 text-sm font-medium border-2 transition-all ' +
                    (form.servicosIds.includes(s.id) ? 'text-white border-transparent' : 'border-gray-200 text-gray-600')}
                  style={form.servicosIds.includes(s.id) ? { backgroundColor: cor, borderColor: cor } : {}}>
                  {s.nome}
                </button>
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
