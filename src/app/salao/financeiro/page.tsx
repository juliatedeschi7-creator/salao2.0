'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { Home, Calendar, Users, BarChart2, Settings } from 'lucide-react'

export default function FinanceiroPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes' | 'ano'>('mes')
  const [transacoes, setTransacoes] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ tipo: 'receita', categoria: '', descricao: '', valor: '', forma_pagamento: '', data_hora: new Date().toISOString().slice(0, 16) })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading, periodo])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const agora = new Date()
    let inicio = new Date()
    if (periodo === 'dia') inicio.setHours(0, 0, 0, 0)
    else if (periodo === 'semana') inicio.setDate(agora.getDate() - 7)
    else if (periodo === 'mes') inicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
    else inicio = new Date(agora.getFullYear(), 0, 1)
    const { data: trans } = await supabase.from('transacoes').select('*').eq('salao_id', profile!.salao_id!).gte('data_hora', inicio.toISOString()).order('data_hora', { ascending: false })
    setTransacoes(trans || [])
  }

  async function handleSalvar() {
    if (!form.descricao || !form.valor) return
    setSalvando(true)
    await supabase.from('transacoes').insert({ salao_id: profile!.salao_id, tipo: form.tipo, categoria: form.categoria || null, descricao: form.descricao, valor: parseFloat(form.valor), forma_pagamento: form.forma_pagamento || null, data_hora: new Date(form.data_hora).toISOString() })
    setModal(false); setSalvando(false)
    setForm({ tipo: 'receita', categoria: '', descricao: '', valor: '', forma_pagamento: '', data_hora: new Date().toISOString().slice(0, 16) })
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((a, t) => a + (t.valor as number), 0)
  const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((a, t) => a + (t.valor as number), 0)
  const lucro = receitas - despesas
  const ticketMedio = transacoes.filter(t => t.tipo === 'receita').length > 0 ? receitas / transacoes.filter(t => t.tipo === 'receita').length : 0

  const navItems = [
    { icon: Home, label: 'Inicio', href: '/salao' },
    { icon: Calendar, label: 'Agenda', href: '/salao/agenda' },
    { icon: Users, label: 'Clientes', href: '/salao/clientes' },
    { icon: BarChart2, label: 'Financas', href: '/salao/financeiro' },
    { icon: Settings, label: 'Ajustes', href: '/salao/configuracoes' },
  ]

  return (
    <div className="min-h-screen pb-20 bg-[#f8f9fa]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Financeiro</h1>
        <button onClick={() => setModal(true)} className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}><Plus size={18} /></button>
      </div>
      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="flex bg-white rounded-2xl p-1 gap-1">
          {(['dia', 'semana', 'mes', 'ano'] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
              style={periodo === p ? { backgroundColor: cor, color: 'white' } : { color: '#9ca3af' }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="rounded-2xl p-5" style={{ backgroundColor: cor }}>
          <p className="text-white/70 text-sm">Lucro Liquido</p>
          <p className="text-white text-3xl font-bold mt-1">R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card"><div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-green-500" /><p className="text-xs text-gray-400">Receitas</p></div><p className="text-xl font-bold text-gray-900">R$ {receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
          <div className="card"><div className="flex items-center gap-2 mb-1"><TrendingDown size={14} className="text-red-400" /><p className="text-xs text-gray-400">Despesas</p></div><p className="text-xl font-bold text-gray-900">R$ {despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
        </div>

        <div className="card flex items-center gap-3">
          <DollarSign size={18} style={{ color: cor }} />
          <div><p className="text-xs text-gray-400">Ticket Medio</p><p className="font-bold text-gray-900">R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
          <button onClick={() => router.push('/salao/financeiro/relatorios')} className="ml-auto text-sm font-medium" style={{ color: cor }}>Relatorios</button>
        </div>

        <p className="font-bold text-gray-900">Transacoes Recentes</p>
        {transacoes.length === 0 ? (
          <div className="card text-center py-8"><p className="text-gray-400">Nenhuma transacao no periodo</p></div>
        ) : transacoes.slice(0, 20).map(t => (
          <div key={t.id} className="card flex items-center gap-3">
            <div className={'w-10 h-10 rounded-full flex items-center justify-center ' + (t.tipo === 'receita' ? 'bg-green-50' : 'bg-red-50')}>
              {t.tipo === 'receita' ? <TrendingUp size={18} className="text-green-500" /> : <TrendingDown size={18} className="text-red-400" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 text-sm">{t.descricao}</p>
              <p className="text-xs text-gray-400">{new Date(t.data_hora).toLocaleDateString('pt-BR')}{t.forma_pagamento && ' - ' + t.forma_pagamento.replace('_', ' ')}</p>
            </div>
            <p className={'font-bold ' + (t.tipo === 'receita' ? 'text-green-500' : 'text-red-400')}>
              {t.tipo === 'receita' ? '+' : '-'} R$ {t.valor.toFixed(2).replace('.', ',')}
            </p>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">Novo Lancamento</h3>
            <div className="flex gap-2">
              {[{ key: 'receita', label: 'Receita', cor: 'bg-green-50 text-green-600 border-green-200' }, { key: 'despesa', label: 'Despesa', cor: 'bg-red-50 text-red-500 border-red-200' }].map(t => (
                <button key={t.key} onClick={() => setForm(p => ({ ...p, tipo: t.key }))}
                  className={'flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ' + (form.tipo === t.key ? t.cor : 'border-gray-200 text-gray-400')}>
                  {t.label}
                </button>
              ))}
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Descricao</label><input className="input-field" placeholder="Ex: Corte feminino" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Valor (R$)</label><input className="input-field" type="number" placeholder="0,00" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Categoria</label><input className="input-field" placeholder="Ex: Servico" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Forma de pagamento</label>
              <select className="input-field" value={form.forma_pagamento} onChange={e => setForm(p => ({ ...p, forma_pagamento: e.target.value }))}>
                <option value="">Selecione...</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartao de Credito</option>
                <option value="cartao_debito">Cartao de Debito</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Data e hora</label><input className="input-field" type="datetime-local" value={form.data_hora} onChange={e => setForm(p => ({ ...p, data_hora: e.target.value }))} /></div>
            <div className="flex gap-3">
              <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>{salvando ? '...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}
