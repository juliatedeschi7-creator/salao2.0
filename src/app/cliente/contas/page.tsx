'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

const meioPagamentoLabel: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  transferencia: 'Transferência'
}

export default function ContaClientePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [contas, setContas] = useState<any[]>([])
  const [pagamentos, setPagamentos] = useState<Record<string, any[]>>({})
  const [filtro, setFiltro] = useState<'abertas' | 'pagas' | 'todas'>('abertas')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile) carregar()
  }, [loading])

  async function carregar() {
    setCarregando(true)

    const { data: cli } = await supabase
      .from('clientes')
      .select('*, saloes(*)')
      .eq('profile_id', profile!.id)
      .single()

    if (!cli) { setCarregando(false); return }
    setCliente(cli)
    setSalao(cli.saloes)

    const { data: cnts } = await supabase
      .from('contas_clientes')
      .select('*')
      .eq('cliente_id', cli.id)
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
    }

    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const fmt = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

  const filtradas = contas.filter(c =>
    filtro === 'todas' ? true :
    filtro === 'abertas' ? c.status === 'pendente' :
    c.status === 'pago'
  )

  const totalAberto = contas
    .filter(c => c.status === 'pendente')
    .reduce((acc, c) => acc + (c.valor - (c.valor_pago || 0)), 0)

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
          const valorPago = Number(c.valor_pago || 0)
          const saldo = Number(c.valor) - valorPago
          const progresso = c.valor > 0 ? (valorPago / c.valor) * 100 : 0
          const paga = c.status === 'pago'
          const isCredito = c.tipo === 'credito'
          const historico = pagamentos[c.id] || []
          const aberto = expandido === c.id

          return (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{c.descricao}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">
                      {new Date(c.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'long', year: 'numeric'
                      })}
                    </p>
                    {isCredito && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                        Crédito
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={'text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ' +
                    (paga ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
                    {paga
                      ? <><CheckCircle size={11} />Pago</>
                      : <><AlertCircle size={11} />Em aberto</>}
                  </span>
                  {historico.length > 0 && (
                    <button onClick={() => setExpandido(aberto ? null : c.id)}>
                      {aberto ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de progresso */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Pago: {fmt(valorPago)}</span>
                  <span>Total: {fmt(c.valor)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(progresso, 100)}%`, backgroundColor: paga ? '#22c55e' : cor }} />
                </div>
              </div>

              {!paga && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-sm font-bold text-red-500">Falta: {fmt(saldo)}</p>
                </div>
              )}

              {aberto && historico.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
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
