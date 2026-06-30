'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Calendar, Package, FileText, CreditCard, Plus, ChevronRight } from 'lucide-react'

export default function ClienteDetalhePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [pacotes, setPacotes] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [aba, setAba] = useState<'info' | 'agenda' | 'pacotes' | 'contas' | 'anamnese'>('info')
  const [modalConta, setModalConta] = useState(false)
  const [novaConta, setNovaConta] = useState({
    descricao: '', tipo: 'debito', valor: '', forma_pagamento: '', vencimento: ''
  })

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*')
      .eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: cli } = await supabase.from('clientes').select('*')
      .eq('id', params.id as string).single()
    setCliente(cli)

    const { data: ags } = await supabase.from('agendamentos')
      .select('*, servicos(nome)')
      .eq('cliente_id', params.id as string)
      .order('data_hora', { ascending: false })
      .limit(20)
    setAgendamentos(ags || [])

    const { data: pacs } = await supabase.from('cliente_pacotes')
      .select('*, pacotes(nome, categoria)')
      .eq('cliente_id', params.id as string)
      .order('data_compra', { ascending: false })
    setPacotes(pacs || [])

    const { data: conts } = await supabase.from('contas_clientes')
      .select('*')
      .eq('cliente_id', params.id as string)
      .order('created_at', { ascending: false })
    setContas(conts || [])
  }

  async function adicionarConta() {
    if (!novaConta.descricao || !novaConta.valor) return

    await supabase.from('contas_clientes').insert({
      salao_id: profile!.salao_id,
      cliente_id: params.id,
      descricao: novaConta.descricao,
      tipo: novaConta.tipo,
      valor: parseFloat(novaConta.valor),
      forma_pagamento: novaConta.forma_pagamento || null,
      vencimento: novaConta.vencimento || null,
      status: novaConta.tipo === 'pagamento' ? 'pago' : 'pendente',
      criado_por: profile!.id,
      pago_em: novaConta.tipo === 'pagamento' ? new Date().toISOString() : null,
    })

    setModalConta(false)
    setNovaConta({ descricao: '', tipo: 'debito', valor: '', forma_pagamento: '', vencimento: '' })
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const saldoDevedor = contas
    .filter(c => c.status === 'pendente' && c.tipo === 'debito')
    .reduce((acc, c) => acc + c.valor, 0)
  const saldoCredito = contas
    .filter(c => c.status === 'pendente' && c.tipo === 'credito')
    .reduce((acc, c) => acc + c.valor, 0)

  const abas = [
    { key: 'info', label: 'Info' },
    { key: 'agenda', label: 'Agenda' },
    { key: 'pacotes', label: 'Pacotes' },
    { key: 'contas', label: 'Contas' },
    { key: 'anamnese', label: 'Anamnese' },
  ]

  return (
    <div className="min-h-screen bg-[#f8f4f6]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">
          {cliente?.nome || 'Cliente'}
        </h1>
      </div>

      {/* Abas */}
      <div className="flex bg-white border-b border-gray-100 overflow-x-auto">
        {abas.map(a => (
          <button key={a.key} onClick={() => setAba(a.key as any)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-all ${aba === a.key ? 'border-b-2' : 'text-gray-400'}`}
            style={aba === a.key ? { color: cor, borderColor: cor } : {}}>
            {a.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {aba === 'info' && (
          <>
            <div className="card flex flex-col gap-2">
              <p className="text-xs text-gray-400 font-medium uppercase">Informações</p>
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nome</span>
                  <span className="text-sm font-medium text-gray-900">{cliente?.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Telefone</span>
                  <span className="text-sm font-medium text-gray-900">{cliente?.telefone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Email</span>
                  <span className="text-sm font-medium text-gray-900">{cliente?.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nascimento</span>
                  <span className="text-sm font-medium text-gray-900">
                    {cliente?.data_nascimento
                      ? new Date(cliente.data_nascimento).toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Cliente desde</span>
                  <span className="text-sm font-medium text-gray-900">
                    {cliente?.created_at
                      ? new Date(cliente.created_at).toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
            {cliente?.observacoes && (
              <div className="card">
                <p className="text-xs text-gray-400 font-medium uppercase mb-1">Observações</p>
                <p className="text-sm text-gray-700">{cliente.observacoes}</p>
              </div>
            )}
          </>
        )}

        {aba === 'agenda' && (
          agendamentos.length === 0 ? (
            <div className="card text-center py-10">
              <Calendar size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Sem agendamentos</p>
            </div>
          ) : agendamentos.map(ag => (
            <div key={ag.id} className="card">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-900">{ag.servicos?.nome}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(ag.data_hora).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ag.status === 'concluido' ? 'bg-gray-100 text-gray-500' : ag.status === 'confirmado' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                  {ag.status}
                </span>
              </div>
            </div>
          ))
        )}

        {aba === 'pacotes' && (
          pacotes.length === 0 ? (
            <div className="card text-center py-10">
              <Package size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Sem pacotes</p>
            </div>
          ) : pacotes.map(p => (
            <div key={p.id} className="card">
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{p.pacotes?.nome}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'ativo' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  {p.status}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Sessões: {p.sessoes_usadas}/{p.sessoes_total}</span>
                <span>Vence: {p.data_expiracao ? new Date(p.data_expiracao).toLocaleDateString('pt-BR') : '—'}</span>
              </div>
              <div className="mt-2 h-2 bg-gray-100 rounded-full">
                <div className="h-2 rounded-full transition-all"
                  style={{ width: `${(p.sessoes_usadas / p.sessoes_total) * 100}%`, backgroundColor: cor }} />
              </div>
            </div>
          ))
        )}

        {aba === 'contas' && (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card border-l-4 border-red-400">
                <p className="text-xs text-gray-400">A receber</p>
                <p className="text-xl font-bold text-red-500">
                  R$ {saldoDevedor.toFixed(2).replace('.', ',')}
                </p>
              </div>
              <div className="card border-l-4 border-green-400">
                <p className="text-xs text-gray-400">Crédito</p>
                <p className="text-xl font-bold text-green-500">
                  R$ {saldoCredito.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>

            <button onClick={() => setModalConta(true)}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed text-sm font-medium"
              style={{ borderColor: cor, color: cor }}>
              <Plus size={16} />Lançar na conta
            </button>

            {contas.map(c => (
              <div key={c.id} className="card flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{c.descricao}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    {c.forma_pagamento && ` • ${c.forma_pagamento}`}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${c.status === 'pago' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                    {c.status}
                  </span>
                </div>
                <p className={`font-bold text-base ${c.tipo === 'debito' ? 'text-red-500' : c.tipo === 'credito' ? 'text-green-500' : 'text-gray-500'}`}>
                  {c.tipo === 'debito' ? '-' : '+'} R$ {c.valor.toFixed(2).replace('.', ',')}
                </p>
              </div>
            ))}
          </>
        )}

        {aba === 'anamnese' && (
          <button onClick={() => router.push(`/salao/anamnese?cliente=${params.id}`)}
            className="card flex items-center gap-3">
            <FileText size={20} style={{ color: cor }} />
            <span className="font-medium text-gray-900">Ver fichas de anamnese</span>
            <ChevronRight size={18} className="text-gray-300 ml-auto" />
          </button>
        )}
      </div>

      {/* Modal conta */}
      {modalConta && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Lançar na Conta</h3>

            <div className="flex gap-2">
              {[
                { key: 'debito', label: 'Débito', cor: 'bg-red-50 text-red-600 border-red-200' },
                { key: 'credito', label: 'Crédito', cor: 'bg-green-50 text-green-600 border-green-200' },
                { key: 'pagamento', label: 'Pagamento', cor: 'bg-blue-50 text-blue-600 border-blue-200' },
              ].map(t => (
                <button key={t.key}
                  onClick={() => setNovaConta(prev => ({ ...prev, tipo: t.key }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${novaConta.tipo === t.key ? t.cor : 'border-gray-200 text-gray-400'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Descrição</label>
              <input className="input-field" placeholder="Ex: Coloração, pagamento pendente..."
                value={novaConta.descricao}
                onChange={e => setNovaConta(prev => ({ ...prev, descricao: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Valor (R$)</label>
              <input className="input-field" type="number" placeholder="0,00"
                value={novaConta.valor}
                onChange={e => setNovaConta(prev => ({ ...prev, valor: e.target.value }))} />
            </div>

            {novaConta.tipo === 'pagamento' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Forma de pagamento</label>
                <select className="input-field" value={novaConta.forma_pagamento}
                  onChange={e => setNovaConta(prev => ({ ...prev, forma_pagamento: e.target.value }))}>
                  <option value="">Selecione...</option>
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            )}

            {novaConta.tipo === 'debito' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Vencimento</label>
                <input className="input-field" type="date" value={novaConta.vencimento}
                  onChange={e => setNovaConta(prev => ({ ...prev, vencimento: e.target.value }))} />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModalConta(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={adicionarConta}
                className="flex-1 py-3 rounded-2xl text-white font-medium"
                style={{ backgroundColor: cor }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
