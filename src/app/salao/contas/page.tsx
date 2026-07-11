'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, DollarSign, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'

export default function ContasPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [contas, setContas] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [filtro, setFiltro] = useState<'abertas' | 'pagas' | 'todas'>('abertas')
  const [modal, setModal] = useState(false)
  const [modalPagamento, setModalPagamento] = useState<any>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [form, setForm] = useState({ cliente_id: '', descricao: '', valor: '', parcelas: '1' })
  const [pagForm, setPagForm] = useState({
    valor: '', forma: 'pix', data: new Date().toISOString().split('T')[0]
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: clis } = await supabase.from('clientes').select('id, nome')
      .eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(clis || [])

    const { data: cnts } = await supabase
      .from('contas_clientes')
      .select('*, clientes(nome)')
      .eq('salao_id', profile!.salao_id!)
      .order('created_at', { ascending: false })
    setContas(cnts || [])
  }

  async function criarConta() {
    if (!form.cliente_id || !form.descricao || !form.valor) return
    setSalvando(true)
    const { error } = await supabase.from('contas_clientes').insert({
      salao_id: profile!.salao_id,
      cliente_id: form.cliente_id,
      descricao: form.descricao,
      valor_total: parseFloat(form.valor),
      valor_pago: 0,
      parcelas: parseInt(form.parcelas),
      status: 'aberta'
    })
    if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return }
    setModal(false)
    setSalvando(false)
    setForm({ cliente_id: '', descricao: '', valor: '', parcelas: '1' })
    carregarDados()
  }

  async function registrarPagamento() {
    if (!pagForm.valor || !modalPagamento) return
    setSalvando(true)
    const valorPagamento = parseFloat(pagForm.valor)
    const novoValorPago = (modalPagamento.valor_pago || 0) + valorPagamento
    const quitada = novoValorPago >= modalPagamento.valor_total

    const { error } = await supabase.from('contas_clientes').update({
      valor_pago: novoValorPago,
      status: quitada ? 'paga' : 'aberta',
      ultimo_pagamento: new Date().toISOString(),
      forma_pagamento: pagForm.forma
    }).eq('id', modalPagamento.id)

    if (error) { alert('Erro ao registrar: ' + error.message); setSalvando(false); return }
    setModalPagamento(null)
    setSalvando(false)
    setPagForm({ valor: '', forma: 'pix', data: new Date().toISOString().split('T')[0] })
    carregarDados()
  }

  async function marcarComoPaga(id: string, valorTotal: number) {
    await supabase.from('contas_clientes').update({
      valor_pago: valorTotal,
      status: 'paga',
      ultimo_pagamento: new Date().toISOString(),
    }).eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const fmt = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

  const filtradas = contas.filter(c =>
    filtro === 'todas' ? true :
    filtro === 'abertas' ? c.status === 'aberta' :
    c.status === 'paga'
  )

  const totalAberto = contas
    .filter(c => c.status === 'aberta')
    .reduce((acc, c) => acc + (c.valor_total - c.valor_pago), 0)

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Contas de Clientes</h1>
        <button onClick={() => setModal(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {totalAberto > 0 && (
          <div className="card border-l-4" style={{ borderColor: cor }}>
            <p className="text-xs text-gray-400">Total em aberto</p>
            <p className="text-2xl font-bold" style={{ color: cor }}>{fmt(totalAberto)}</p>
          </div>
        )}

        <div className="flex gap-2">
          {(['abertas', 'pagas', 'todas'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={'px-4 py-2 rounded-full text-sm font-medium transition-all ' +
                (filtro === f ? 'text-white' : 'bg-white text-gray-500')}
              style={filtro === f ? { backgroundColor: cor } : {}}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {filtradas.length === 0 ? (
          <div className="card text-center py-10">
            <DollarSign size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhuma conta encontrada</p>
          </div>
        ) : filtradas.map(c => {
          const saldo = c.valor_total - c.valor_pago
          const progresso = c.valor_total > 0 ? (c.valor_pago / c.valor_total) * 100 : 0
          const paga = c.status === 'paga'
          const aberta = expandido === c.id

          return (
            <div key={c.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{c.clientes?.nome}</p>
                  <p className="text-sm text-gray-500">{c.descricao}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                    (paga ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
                    {paga ? 'Paga' : 'Em aberto'}
                  </span>
                  <button onClick={() => setExpandido(aberta ? null : c.id)}>
                    {aberta
                      ? <ChevronUp size={16} className="text-gray-400" />
                      : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                </div>
              </div>

              {/* Barra de progresso */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Pago: {fmt(c.valor_pago)}</span>
                  <span>Total: {fmt(c.valor_total)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(progresso, 100)}%`, backgroundColor: paga ? '#22c55e' : cor }} />
                </div>
              </div>

              {/* Ações */}
              {!paga && (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-red-500">Falta: {fmt(saldo)}</p>
                  <div className="flex gap-2">
                    {saldo === c.valor_total && (
                      <button
                        onClick={() => marcarComoPaga(c.id, c.valor_total)}
                        className="px-3 py-2 rounded-xl border-2 text-xs font-medium"
                        style={{ borderColor: cor, color: cor }}>
                        Quitar
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setModalPagamento(c)
                        setPagForm({
                          valor: saldo.toFixed(2),
                          forma: 'pix',
                          data: new Date().toISOString().split('T')[0]
                        })
                      }}
                      className="px-4 py-2 rounded-xl text-white text-sm font-medium"
                      style={{ backgroundColor: cor }}>
                      Lançar pagamento
                    </button>
                  </div>
                </div>
              )}

              {/* Detalhes expandidos */}
              {aberta && (
                <div className="border-t border-gray-50 pt-3 flex flex-col gap-1.5">
                  {c.parcelas > 1 && (
                    <p className="text-xs text-gray-400">{c.parcelas} parcelas</p>
                  )}
                  {c.ultimo_pagamento && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock size={11} />
                      <span>
                        Último pagamento: {new Date(c.ultimo_pagamento).toLocaleDateString('pt-BR')}
                        {c.forma_pagamento && ` via ${c.forma_pagamento}`}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-gray-300">
                    Criada em {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </p>
                  {paga && (
                    <button
                      onClick={async () => {
                        await supabase.from('contas_clientes').update({
                          status: 'aberta',
                          valor_pago: 0,
                          ultimo_pagamento: null,
                          forma_pagamento: null
                        }).eq('id', c.id)
                        carregarDados()
                      }}
                      className="text-xs text-gray-400 underline text-left mt-1">
                      Reabrir conta
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal nova conta */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">Nova Conta</h3>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Cliente</label>
              <select className="input-field" value={form.cliente_id}
                onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descrição</label>
              <input className="input-field" placeholder="Ex: Luzes + hidratação"
                value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Valor total (R$)</label>
                <input className="input-field" type="number"
                  value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Parcelas</label>
                <input className="input-field" type="number" min="1"
                  value={form.parcelas} onChange={e => setForm(p => ({ ...p, parcelas: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={criarConta} disabled={salvando || !form.cliente_id || !form.descricao || !form.valor}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lançar pagamento */}
      {modalPagamento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Lançar Pagamento</h3>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="font-semibold text-gray-900">{modalPagamento.clientes?.nome}</p>
              <p className="text-sm text-gray-500">{modalPagamento.descricao}</p>
              <p className="text-xs text-gray-400 mt-1">
                Falta: {fmt(modalPagamento.valor_total - modalPagamento.valor_pago)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Valor recebido (R$)</label>
              <input className="input-field" type="number"
                value={pagForm.valor} onChange={e => setPagForm(p => ({ ...p, valor: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Forma de pagamento</label>
              <div className="flex gap-2">
                {['pix', 'dinheiro', 'cartao'].map(f => (
                  <button key={f} onClick={() => setPagForm(p => ({ ...p, forma: f }))}
                    className={'flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ' +
                      (pagForm.forma === f ? 'text-white border-transparent' : 'border-gray-200 text-gray-500')}
                    style={pagForm.forma === f ? { backgroundColor: cor, borderColor: cor } : {}}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalPagamento(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={registrarPagamento} disabled={salvando || !pagForm.valor}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Registrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
