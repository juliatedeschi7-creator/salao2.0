'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Plus, DollarSign, Check, X, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'

const meioPagamentoLabel: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  transferencia: 'Transferência'
}

function fmt(v: number) {
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`
}

export default function ContasPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [contas, setContas] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [pagamentos, setPagamentos] = useState<Record<string, any[]>>({})
  const [filtro, setFiltro] = useState<'abertas' | 'pagas' | 'todas'>('abertas')
  const [modal, setModal] = useState(false)
  const [modalPagamento, setModalPagamento] = useState<any>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [erroPagamento, setErroPagamento] = useState('')
  const [form, setForm] = useState({
    cliente_id: '', descricao: '', valor: '', tipo: 'debito'
  })
  const [formPagamento, setFormPagamento] = useState({
    valor: '',
    meio_pagamento: 'pix',
    data_pagamento: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: clis } = await supabase.from('clientes').select('id, nome').eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(clis || [])
    const { data: cnts } = await supabase.from('contas_clientes')
      .select('*, clientes(nome)')
      .eq('salao_id', profile!.salao_id!)
      .order('created_at', { ascending: false })
    setContas(cnts || [])

    if (cnts && cnts.length > 0) {
      const ids = cnts.map((c: any) => c.id)
      const { data: pags } = await supabase.from('pagamentos_conta')
        .select('*')
        .in('conta_id', ids)
        .order('data_pagamento', { ascending: true })
      const agrupado: Record<string, any[]> = {}
      ;(pags || []).forEach((p: any) => {
        if (!agrupado[p.conta_id]) agrupado[p.conta_id] = []
        agrupado[p.conta_id].push(p)
      })
      setPagamentos(agrupado)
    } else {
      setPagamentos({})
    }
  }

  async function salvar() {
    setErro('')
    if (!form.cliente_id || !form.valor || !form.descricao) {
      setErro('Preencha todos os campos.')
      return
    }
    setSalvando(true)
    const { error } = await supabase.from('contas_clientes').insert({
      salao_id: profile!.salao_id,
      cliente_id: form.cliente_id,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      valor_pago: 0,
      status: 'pendente',
      tipo: form.tipo
    })
    if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return }
    setModal(false); setSalvando(false)
    setForm({ cliente_id: '', descricao: '', valor: '', tipo: 'debito' })
    carregarDados()
  }

  function abrirModalPagamento(conta: any) {
    const restante = Number(conta.valor) - Number(conta.valor_pago || 0)
    setModalPagamento(conta)
    setErroPagamento('')
    setFormPagamento({
      valor: restante.toFixed(2),
      meio_pagamento: 'pix',
      data_pagamento: new Date().toISOString().split('T')[0]
    })
  }

  async function registrarPagamento(conta: any) {
    setErroPagamento('')
    const valorPagoAgora = parseFloat(formPagamento.valor)
    if (!valorPagoAgora || valorPagoAgora <= 0) {
      setErroPagamento('Informe um valor válido.')
      return
    }
    setSalvando(true)
    const jaPago = Number(conta.valor_pago || 0)
    const novoValorPago = jaPago + valorPagoAgora
    const quitado = novoValorPago >= Number(conta.valor)

    const { error } = await supabase.from('contas_clientes').update({
      valor_pago: novoValorPago,
      status: quitado ? 'pago' : 'pendente',
      meio_pagamento: formPagamento.meio_pagamento,
      data_pagamento: formPagamento.data_pagamento,
      ultimo_pagamento: new Date().toISOString()
    }).eq('id', conta.id)

    if (error) { setErroPagamento('Erro ao registrar: ' + error.message); setSalvando(false); return }

    const { error: errHist } = await supabase.from('pagamentos_conta').insert({
      conta_id: conta.id,
      valor: valorPagoAgora,
      meio_pagamento: formPagamento.meio_pagamento,
      data_pagamento: formPagamento.data_pagamento,
      criado_por: profile!.id
    })
    if (errHist) {
      setErroPagamento('Pagamento registrado, mas houve erro no histórico: ' + errHist.message)
      setSalvando(false)
      carregarDados()
      return
    }

    setModalPagamento(null)
    setSalvando(false)
    carregarDados()
  }

  async function excluir(id: string) {
    await supabase.from('contas_clientes').delete().eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  const filtradas = contas.filter(c => {
    if (filtro === 'abertas') return c.status === 'pendente'
    if (filtro === 'pagas') return c.status === 'pago'
    return true
  })

  const totalDebitoAberto = contas
    .filter(c => c.status === 'pendente' && c.tipo !== 'credito')
    .reduce((acc, c) => acc + (c.valor - c.valor_pago), 0)

  const totalCreditoAberto = contas
    .filter(c => c.status === 'pendente' && c.tipo === 'credito')
    .reduce((acc, c) => acc + (c.valor - c.valor_pago), 0)

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

      {(totalDebitoAberto > 0 || totalCreditoAberto > 0) && (
        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          {totalDebitoAberto > 0 && (
            <div className="card flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <TrendingDown size={14} className="text-red-400" />
                <p className="text-xs text-gray-500">Clientes devem</p>
              </div>
              <p className="font-bold text-lg text-red-500">{fmt(totalDebitoAberto)}</p>
            </div>
          )}
          {totalCreditoAberto > 0 && (
            <div className="card flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={14} className="text-green-500" />
                <p className="text-xs text-gray-500">Salão deve</p>
              </div>
              <p className="font-bold text-lg text-green-600">{fmt(totalCreditoAberto)}</p>
            </div>
          )}
        </div>
      )}

      <div className="px-4 mt-4 flex gap-2">
        {(['abertas', 'pagas', 'todas'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={filtro === f
              ? { backgroundColor: cor, color: 'white' }
              : { backgroundColor: 'white', color: '#6b7280' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {filtradas.length === 0 ? (
          <div className="card text-center py-10">
            <DollarSign size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhuma conta encontrada</p>
          </div>
        ) : filtradas.map(c => {
          const isCredito = c.tipo === 'credito'
          const valorPago = Number(c.valor_pago || 0)
          const restante = Number(c.valor) - valorPago
          const temPagamentoParcial = c.status === 'pendente' && valorPago > 0
          const historico = pagamentos[c.id] || []

          return (
            <div key={c.id} className={'card flex flex-col gap-2 border-l-4 ' + (isCredito ? 'border-green-400' : 'border-red-300')}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{c.clientes?.nome}</p>
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (isCredito ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
                      {isCredito ? '✓ Crédito (salão deve)' : '↓ Débito (cliente deve)'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{c.descricao}</p>
                </div>
                <button onClick={() => setExpandido(expandido === c.id ? null : c.id)}>
                  {expandido === c.id
                    ? <ChevronUp size={16} className="text-gray-400" />
                    : <ChevronDown size={16} className="text-gray-400" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <p className={'font-bold text-lg ' + (isCredito ? 'text-green-600' : 'text-red-500')}>
                  {isCredito ? '+' : '-'} {fmt(c.valor)}
                </p>
                <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                  (c.status === 'pago' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600')}>
                  {c.status === 'pago' ? 'Quitada' : 'Em aberto'}
                </span>
              </div>

              {temPagamentoParcial && (
                <p className="text-xs text-gray-500">
                  Pago até agora: {fmt(valorPago)} · Restante: {fmt(restante)}
                </p>
              )}

              {expandido === c.id && (
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="font-medium text-gray-700">
                        {isCredito ? 'Lançamento (crédito)' : 'Lançamento (débito)'}: {fmt(c.valor)}
                      </span>
                    </div>
                    {historico.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">
                          {new Date(p.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="font-medium text-green-600">
                          {isCredito ? 'Devolvido' : 'Pago'}: {fmt(p.valor)}
                          {p.meio_pagamento && ` · ${meioPagamentoLabel[p.meio_pagamento] || p.meio_pagamento}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-gray-100 mt-1">
                    {c.status === 'pendente' && (
                      <button
                        onClick={() => abrirModalPagamento(c)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-sm font-medium"
                        style={{ backgroundColor: cor }}>
                        <Check size={14} />
                        {isCredito ? 'Registrar devolução' : 'Registrar pagamento'}
                      </button>
                    )}
                    <button onClick={() => excluir(c.id)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium">
                      <X size={14} />Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Nova conta</h3>
            {erro && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Tipo de lançamento</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setForm(p => ({ ...p, tipo: 'debito' }))}
                  className="py-3 rounded-xl border-2 text-sm font-semibold transition-all flex flex-col items-center gap-1"
                  style={form.tipo === 'debito'
                    ? { borderColor: '#ef4444', backgroundColor: '#fef2f2', color: '#ef4444' }
                    : { borderColor: '#e5e7eb', color: '#9ca3af' }}>
                  <TrendingDown size={18} />
                  <span>Débito</span>
                  <span className="text-xs font-normal opacity-70">Cliente deve ao salão</span>
                </button>
                <button onClick={() => setForm(p => ({ ...p, tipo: 'credito' }))}
                  className="py-3 rounded-xl border-2 text-sm font-semibold transition-all flex flex-col items-center gap-1"
                  style={form.tipo === 'credito'
                    ? { borderColor: '#22c55e', backgroundColor: '#f0fdf4', color: '#22c55e' }
                    : { borderColor: '#e5e7eb', color: '#9ca3af' }}>
                  <TrendingUp size={18} />
                  <span>Crédito</span>
                  <span className="text-xs font-normal opacity-70">Salão deve à cliente</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Cliente</label>
              <select className="input-field" value={form.cliente_id}
                onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))}>
                <option value="">Selecione a cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descrição</label>
              <input className="input-field"
                placeholder={form.tipo === 'credito' ? 'Ex: Troco de R$50, adiantamento' : 'Ex: Serviços de julho'}
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Valor (R$)</label>
              <input className="input-field" type="number" placeholder="0,00"
                value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setModal(false); setErro('') }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="flex-1 py-3 rounded-2xl text-white font-medium"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPagamento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">
              {modalPagamento.tipo === 'credito' ? 'Registrar devolução' : 'Registrar pagamento'}
            </h3>
            <p className="text-sm text-gray-500">
              {modalPagamento.clientes?.nome} — total {fmt(modalPagamento.valor)}
              {Number(modalPagamento.valor_pago || 0) > 0 && (
                <> · já pago {fmt(modalPagamento.valor_pago)}</>
              )}
            </p>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {modalPagamento.tipo === 'credito' ? 'Valor devolvido agora' : 'Valor pago agora'}
              </label>
              <input className="input-field" type="number" step="0.01" min="0.01"
                value={formPagamento.valor}
                onChange={e => setFormPagamento(p => ({ ...p, valor: e.target.value }))} />
              <p className="text-xs text-gray-400 mt-1">
                Preenchido com o valor restante — pode editar pra registrar um pagamento parcial.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {modalPagamento.tipo === 'credito' ? 'Como devolveu' : 'Meio de pagamento'}
              </label>
              <select className="input-field" value={formPagamento.meio_pagamento}
                onChange={e => setFormPagamento(p => ({ ...p, meio_pagamento: e.target.value }))}>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Data</label>
              <input className="input-field" type="date" value={formPagamento.data_pagamento}
                onChange={e => setFormPagamento(p => ({ ...p, data_pagamento: e.target.value }))}
                style={{ colorScheme: 'light' }} />
            </div>

            {erroPagamento && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{erroPagamento}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModalPagamento(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={() => registrarPagamento(modalPagamento)} disabled={salvando}
                className="flex-1 py-3 rounded-2xl text-white font-medium"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
