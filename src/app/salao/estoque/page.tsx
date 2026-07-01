'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, AlertTriangle, Package, X, Minus } from 'lucide-react'

const TIPOS = ['Produto', 'Tinta', 'Insumo', 'Equipamento', 'Outro']

export default function EstoquePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [itens, setItens] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalMovimento, setModalMovimento] = useState<any>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('Produto')
  const [quantidade, setQuantidade] = useState('')
  const [quantidadeMinima, setQuantidadeMinima] = useState('5')
  const [precoCusto, setPrecoCusto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [qtdMovimento, setQtdMovimento] = useState('')
  const [tipoMovimento, setTipoMovimento] = useState<'add' | 'sub'>('add')

  useEffect(() => {
    if (!loading && profile?.salao_id) inicializar()
  }, [loading])

  async function inicializar() {
    setCarregando(true)
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    await carregar()
    setCarregando(false)
  }

  async function carregar() {
    const { data } = await supabase.from('estoque')
      .select('*').eq('salao_id', profile!.salao_id!)
      .order('nome')
    setItens(data || [])
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const { error } = await supabase.from('estoque').insert({
      salao_id: profile!.salao_id,
      nome, tipo,
      quantidade: parseInt(quantidade) || 0,
      quantidade_minima: parseInt(quantidadeMinima) || 5,
      preco_custo: parseFloat(precoCusto.replace(',', '.')) || 0
    })
    if (error) alert('Erro: ' + error.message)
    setSalvando(false)
    setModal(false)
    setNome(''); setQuantidade(''); setPrecoCusto('')
    carregar()
  }

  async function moverEstoque() {
    if (!modalMovimento || !qtdMovimento) return
    const qtd = parseInt(qtdMovimento)
    const novaQtd = tipoMovimento === 'add'
      ? modalMovimento.quantidade + qtd
      : Math.max(0, modalMovimento.quantidade - qtd)
    await supabase.from('estoque').update({ quantidade: novaQtd }).eq('id', modalMovimento.id)
    setModalMovimento(null)
    setQtdMovimento('')
    carregar()
  }

  const baixoEstoque = itens.filter(i => i.quantidade <= i.quantidade_minima)
  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Estoque</h1>
        {baixoEstoque.length > 0 && (
          <span className="bg-orange-100 text-orange-600 text-xs px-2.5 py-1 rounded-full font-bold">
            {baixoEstoque.length} em falta
          </span>
        )}
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium"
          style={{ backgroundColor: cor }}>
          <Plus size={14} />Produto
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {baixoEstoque.length > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-700">Estoque baixo</p>
              <p className="text-xs text-orange-500 mt-0.5">
                {baixoEstoque.map(i => i.nome).join(', ')}
              </p>
            </div>
          </div>
        )}

        {carregando ? (
          <div className="flex justify-center py-8">
            <div className="w-7 h-7 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor, borderTopColor: 'transparent' }} />
          </div>
        ) : itens.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Package size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-gray-400 text-sm">Nenhum produto no estoque</p>
          </div>
        ) : itens.map(item => (
          <div key={item.id} className={'bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 ' +
            (item.quantidade <= item.quantidade_minima ? 'border border-orange-100' : '')}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: salao?.cor_secundaria || '#FCE4F3' }}>
              <Package size={18} style={{ color: cor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{item.nome}</p>
              <p className="text-xs text-gray-400">{item.tipo} · mín: {item.quantidade_minima}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => { setModalMovimento(item); setTipoMovimento('sub') }}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                <Minus size={14} className="text-gray-600" />
              </button>
              <span className={'font-bold text-lg w-8 text-center ' +
                (item.quantidade <= item.quantidade_minima ? 'text-orange-500' : 'text-gray-900')}>
                {item.quantidade}
              </span>
              <button onClick={() => { setModalMovimento(item); setTipoMovimento('add') }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: cor }}>
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal novo produto */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Novo produto</h3>
              <button onClick={() => setModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={salvar} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Tinta louro 8.0"
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none">
                  {TIPOS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Qtd</label>
                  <input value={quantidade} onChange={e => setQuantidade(e.target.value)} required
                    placeholder="0" inputMode="numeric"
                    className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mínimo</label>
                  <input value={quantidadeMinima} onChange={e => setQuantidadeMinima(e.target.value)}
                    placeholder="5" inputMode="numeric"
                    className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custo</label>
                  <input value={precoCusto} onChange={e => setPrecoCusto(e.target.value)}
                    placeholder="0,00" inputMode="decimal"
                    className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-1">
                <button type="button" onClick={() => setModal(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
                <button type="submit" disabled={salvando}
                  className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>
                  {salvando ? '...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal movimento */}
      {modalMovimento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">
              {tipoMovimento === 'add' ? 'Adicionar ao estoque' : 'Retirar do estoque'}
            </h3>
            <p className="text-sm text-gray-500">{modalMovimento.nome} · estoque atual: {modalMovimento.quantidade}</p>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantidade</label>
              <input value={qtdMovimento} onChange={e => setQtdMovimento(e.target.value)}
                placeholder="0" inputMode="numeric" autoFocus
                className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none text-center text-2xl font-bold" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModalMovimento(null); setQtdMovimento('') }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={moverEstoque}
                className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}