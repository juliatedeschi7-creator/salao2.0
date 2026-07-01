'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Trash2, X } from 'lucide-react'

const CATEGORIAS_ENTRADA = ['Serviço', 'Pacote', 'Produto', 'Outro']
const CATEGORIAS_SAIDA = ['Aluguel', 'Material', 'Salário', 'Conta', 'Compra', 'Outro']

export default function FinanceiroPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState('Serviço')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) inicializar()
  }, [loading, filtroMes])

  async function inicializar() {
    setCarregando(true)
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    await carregar()
    setCarregando(false)
  }

  async function carregar() {
    const inicio = filtroMes + '-01'
    const fim = new Date(filtroMes + '-01')
    fim.setMonth(fim.getMonth() + 1)
    const fimStr = fim.toISOString().slice(0, 10)
    const { data } = await supabase.from('financeiro')
      .select('*').eq('salao_id', profile!.salao_id!)
      .gte('data', inicio).lt('data', fimStr)
      .order('data', { ascending: false })
    setLancamentos(data || [])
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const { error } = await supabase.from('financeiro').insert({
      salao_id: profile!.salao_id,
      descricao, valor: parseFloat(valor.replace(',', '.')),
      tipo, categoria, data
    })
    if (error) alert('Erro: ' + error.message)
    setSalvando(false)
    setModal(false)
    setDescricao(''); setValor(''); setCategoria('Serviço')
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir lançamento?')) return
    await supabase.from('financeiro').delete().eq('id', id)
    carregar()
  }

  const entradas = lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0)
  const saidas = lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0)
  const saldo = entradas - saidas

  const cor = salao?.cor_primaria || '#E91E8C'
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  })

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Financeiro</h1>
        <button onClick={() => { setModal(true); setTipo('entrada') }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium"
          style={{ backgroundColor: cor }}>
          <Plus size={14} />Lançar
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Seletor de mês */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {meses.map(m => (
            <button key={m} onClick={() => setFiltroMes(m)}
              className={'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 ' +
                (filtroMes === m ? 'text-white' : 'bg-white text-gray-500')}
              style={filtroMes === m ? { backgroundColor: cor } : {}}>
              {new Date(m + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')}
            </button>
          ))}
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-2xl p-3 text-center">
            <p className="text-xs text-green-600 font-medium">Entradas</p>
            <p className="font-bold text-green-700 text-sm mt-1">{fmt(entradas)}</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-3 text-center">
            <p className="text-xs text-red-500 font-medium">Saídas</p>
            <p className="font-bold text-red-600 text-sm mt-1">{fmt(saidas)}</p>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: saldo >= 0 ? '#f0fdf4' : '#fff1f2' }}>
            <p className="text-xs font-medium" style={{ color: saldo >= 0 ? '#16a34a' : '#e11d48' }}>Saldo</p>
            <p className="font-bold text-sm mt-1" style={{ color: saldo >= 0 ? '#15803d' : '#be123c' }}>{fmt(saldo)}</p>
          </div>
        </div>

        {/* Lista */}
        <div className="flex flex-col gap-2">
          {carregando ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor, borderTopColor: 'transparent' }} />
            </div>
          ) : lancamentos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-gray-400 text-sm">Nenhum lançamento neste mês</p>
            </div>
          ) : lancamentos.map(l => (
            <div key={l.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
              <div className={'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ' +
                (l.tipo === 'entrada' ? 'bg-green-50' : 'bg-red-50')}>
                {l.tipo === 'entrada'
                  ? <TrendingUp size={16} className="text-green-600" />
                  : <TrendingDown size={16} className="text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{l.descricao || l.categoria}</p>
                <p className="text-xs text-gray-400">
                  {l.categoria} · {new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className={'font-bold text-sm ' + (l.tipo === 'entrada' ? 'text-green-600' : 'text-red-500')}>
                  {l.tipo === 'saida' ? '-' : '+'}{fmt(l.valor)}
                </p>
                <button onClick={() => excluir(l.id)} className="text-gray-300 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal lançamento */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Novo lançamento</h3>
              <button onClick={() => setModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
              {(['entrada', 'saida'] as const).map(t => (
                <button key={t} onClick={() => { setTipo(t); setCategoria(t === 'entrada' ? 'Serviço' : 'Aluguel') }}
                  className={'flex-1 py-2 rounded-xl text-sm font-semibold transition-all ' +
                    (tipo === t ? 'bg-white shadow-sm' : 'text-gray-400')}
                  style={tipo === t ? { color: t === 'entrada' ? '#16a34a' : '#e11d48' } : {}}>
                  {t === 'entrada' ? '+ Entrada' : '- Saída'}
                </button>
              ))}
            </div>

            <form onSubmit={salvar} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</label>
                <input value={descricao} onChange={e => setDescricao(e.target.value)}
                  placeholder="Ex: Coloração cliente Ana"
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor (R$)</label>
                  <input value={valor} onChange={e => setValor(e.target.value)} required
                    placeholder="0,00" inputMode="decimal"
                    className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</label>
                  <input type="date" value={data} onChange={e => setData(e.target.value)} required
                    className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria</label>
                <select value={categoria} onChange={e => setCategoria(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none">
                  {(tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setModal(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="flex-1 py-3 rounded-2xl text-white font-medium"
                  style={{ backgroundColor: cor }}>
                  {salvando ? '...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}