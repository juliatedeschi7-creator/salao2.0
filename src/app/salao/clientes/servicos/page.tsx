'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Scissors, Edit2, Trash2 } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { Home, Calendar, Users, BarChart2, Settings } from 'lucide-react'

const CATEGORIAS = ['Cabelo', 'Manicure', 'Pedicure', 'Estética', 'Sobrancelha', 'Maquiagem', 'Massagem', 'Outro']

export default function ServicosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({
    nome: '', descricao: '', categoria: 'Cabelo',
    duracao_minutos: 60, preco: '', custo_material: '', comissao_percentual: ''
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*')
      .eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: srv } = await supabase.from('servicos').select('*')
      .eq('salao_id', profile!.salao_id!).order('nome')
    setServicos(srv || [])
  }

  function abrirModal(servico?: any) {
    if (servico) {
      setEditando(servico)
      setForm({
        nome: servico.nome,
        descricao: servico.descricao || '',
        categoria: servico.categoria,
        duracao_minutos: servico.duracao_minutos,
        preco: servico.preco.toString(),
        custo_material: servico.custo_material?.toString() || '',
        comissao_percentual: servico.comissao_percentual?.toString() || '',
      })
    } else {
      setEditando(null)
      setForm({ nome: '', descricao: '', categoria: 'Cabelo', duracao_minutos: 60, preco: '', custo_material: '', comissao_percentual: '' })
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
      categoria: form.categoria,
      duracao_minutos: form.duracao_minutos,
      preco: parseFloat(form.preco),
      custo_material: parseFloat(form.custo_material || '0'),
      comissao_percentual: parseFloat(form.comissao_percentual || '0'),
    }

    if (editando) {
      await supabase.from('servicos').update(dados).eq('id', editando.id)
    } else {
      await supabase.from('servicos').insert(dados)
    }

    setModal(false)
    setSalvando(false)
    carregarDados()
  }

  async function excluirServico(id: string) {
    await supabase.from('servicos').update({ ativo: false }).eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const categorias = ['Todos', ...CATEGORIAS]
  const servicosFiltrados = servicos.filter(s =>
    categoriaFiltro === 'Todos' || s.categoria === categoriaFiltro
  )

  const navItems = [
    { icon: Home, label: 'Início', href: '/salao' },
    { icon: Calendar, label: 'Agenda', href: '/salao/agenda' },
    { icon: Users, label: 'Clientes', href: '/salao/clientes' },
    { icon: BarChart2, label: 'Finanças', href: '/salao/financeiro' },
    { icon: Settings, label: 'Ajustes', href: '/salao/configuracoes' },
  ]

  return (
    <div className="min-h-screen bg-[#f8f4f6] pb-20">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Serviços</h1>
        <button onClick={() => abrirModal()}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Filtro categorias */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categorias.map(c => (
            <button key={c} onClick={() => setCategoriaFiltro(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${categoriaFiltro === c ? 'text-white' : 'bg-white text-gray-500'}`}
              style={categoriaFiltro === c ? { backgroundColor: cor } : {}}>
              {c}
            </button>
          ))}
        </div>

        {servicosFiltrados.length === 0 ? (
          <div className="card text-center py-10">
            <Scissors size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum serviço cadastrado</p>
            <button onClick={() => abrirModal()}
              className="mt-3 px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: cor }}>
              + Adicionar serviço
            </button>
          </div>
        ) : (
          servicosFiltrados.map(s => (
            <div key={s.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{s.nome}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {s.categoria}
                    </span>
                  </div>
                  {s.descricao && (
                    <p className="text-sm text-gray-400 mt-0.5">{s.descricao}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-bold" style={{ color: cor }}>
                      R$ {s.preco.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-xs text-gray-400">{s.duracao_minutos} min</span>
                    {s.comissao_percentual > 0 && (
                      <span className="text-xs text-gray-400">Comissão: {s.comissao_percentual}%</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => abrirModal(s)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Edit2 size={14} className="text-gray-500" />
                  </button>
                  <button onClick={() => excluirServico(s.id)}
                    className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">
              {editando ? 'Editar Serviço' : 'Novo Serviço'}
            </h3>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Nome</label>
              <input className="input-field" placeholder="Ex: Corte Feminino"
                value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Categoria</label>
              <select className="input-field" value={form.categoria}
                onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Descrição</label>
              <textarea className="input-field resize-none" rows={2}
                placeholder="Descrição opcional..."
                value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Preço (R$)</label>
                <input className="input-field" type="number" placeholder="0,00"
                  value={form.preco} onChange={e => setForm(p => ({ ...p, preco: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Duração (min)</label>
                <input className="input-field" type="number" placeholder="60"
                  value={form.duracao_minutos}
                  onChange={e => setForm(p => ({ ...p, duracao_minutos: parseInt(e.target.value) }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Custo material</label>
                <input className="input-field" type="number" placeholder="0,00"
                  value={form.custo_material}
                  onChange={e => setForm(p => ({ ...p, custo_material: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Comissão %</label>
                <input className="input-field" type="number" placeholder="0"
                  value={form.comissao_percentual}
                  onChange={e => setForm(p => ({ ...p, comissao_percentual: e.target.value }))} />
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

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}
