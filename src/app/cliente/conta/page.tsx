'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, CheckCircle, AlertCircle, Clock } from 'lucide-react'

export default function ContaClientePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [contas, setContas] = useState<any[]>([])
  const [filtro, setFiltro] = useState<'abertas' | 'pagas' | 'todas'>('abertas')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile) carregar()
  }, [loading])

  async function carregar() {
    setCarregando(true)

    // Busca o cliente pelo profile_id (correto)
    const { data: cli } = await supabase
      .from('clientes')
      .select('*, saloes(*)')
      .eq('profile_id', profile!.id)
      .single()

    if (!cli) { setCarregando(false); return }
    setCliente(cli)
    setSalao(cli.saloes)

    // Busca contas da tabela correta
    const { data: cnts } = await supabase
      .from('contas_clientes')
      .select('*')
      .eq('cliente_id', cli.id)
      .order('created_at', { ascending: false })

    setContas(cnts || [])
    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'
  const fmt = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

  const filtradas = contas.filter(c =>
    filtro === 'todas' ? true :
    filtro === 'abertas' ? c.status === 'aberta' :
    c.status === 'paga'
  )

  const totalAberto = contas
    .filter(c => c.status === 'aberta')
    .reduce((acc, c) => acc + (c.valor_total - c.valor_pago), 0)

  const totalPago = contas
    .reduce((acc, c) => acc + (c.valor_pago || 0), 0)

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: '#f0f0f5' }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-6" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()} className="mb-4 flex items-center gap-2 text-white/80">
          <ArrowLeft size={20} />
          <span className="text-sm">Voltar</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <DollarSign size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">Minhas Contas</h1>
            <p className="text-white/70 text-sm">{salao?.nome}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 flex flex-col gap-4 pb-6">
        {/* Resumo */}
        {contas.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm flex gap-3">
            <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: `${cor}12` }}>
              <p className="text-xs text-gray-500">Total pago</p>
              <p className="font-bold text-gray-800">{fmt(totalPago)}</p>
            </div>
            {totalAberto > 0 && (
              <div className="flex-1 bg-red-50 rounded-xl p-3">
                <p className="text-xs text-red-500">Em aberto</p>
                <p className="font-bold text-red-600">{fmt(totalAberto)}</p>
              </div>
            )}
            {totalAberto === 0 && contas.length > 0 && (
              <div className="flex-1 bg-green-50 rounded-xl p-3">
                <p className="text-xs text-green-600">Situação</p>
                <p className="font-bold text-green-600">Em dia ✓</p>
              </div>
            )}
          </div>
        )}

        {/* Filtros */}
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

        {/* Lista de contas */}
        {filtradas.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <DollarSign size={36} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">
              {filtro === 'abertas' ? 'Nenhuma conta em aberto' :
               filtro === 'pagas' ? 'Nenhuma conta paga ainda' :
               'Nenhuma conta registrada'}
            </p>
          </div>
        ) : filtradas.map(c => {
          const saldo = c.valor_total - c.valor_pago
          const progresso = c.valor_total > 0 ? (c.valor_pago / c.valor_total) * 100 : 0
          const paga = c.status === 'paga'

          return (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{c.descricao}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(c.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </p>
                </div>
                <span className={'text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ml-2 flex items-center gap-1 ' +
                  (paga ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
                  {paga
                    ? <><CheckCircle size={11} />Pago</>
                    : <><AlertCircle size={11} />Em aberto</>}
                </span>
              </div>

              {/* Barra de progresso */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Pago: {fmt(c.valor_pago)}</span>
                  <span>Total: {fmt(c.valor_total)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(progresso, 100)}%`, backgroundColor: paga ? '#22c55e' : cor }} />
                </div>
              </div>

              {!paga && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-sm font-bold text-red-500">Falta: {fmt(saldo)}</p>
                  {c.parcelas > 1 && (
                    <span className="text-xs text-gray-400">{c.parcelas}x parcelas</span>
                  )}
                </div>
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
            </div>
          )
        })}

        {/* Mensagem de rodapé */}
        {contas.length > 0 && (
          <p className="text-xs text-gray-400 text-center px-4">
            Em caso de dúvidas sobre sua conta, entre em contato com o salão.
          </p>
        )}
      </div>
    </div>
  )
}
