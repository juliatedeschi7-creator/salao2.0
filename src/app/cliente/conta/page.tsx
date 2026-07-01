'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, FileText, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react'

export default function ContaClientePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [aba, setAba] = useState<'pacotes' | 'pagamentos'>('pacotes')
  const [pacotes, setPacotes] = useState<any[]>([])
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile?.id) carregar()
  }, [loading])

  async function carregar() {
    setCarregando(true)

    // Busca salão do cliente
    if (profile?.salao_id) {
      const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile.salao_id).single()
      setSalao(sal)
    }

    // Busca cliente vinculado ao profile
    const { data: cliente } = await supabase.from('clientes').select('id').eq('email', profile?.email).single()

    if (cliente) {
      const [pac, pag] = await Promise.all([
        supabase.from('pacotes_cliente').select('*, pacotes(nome, total_sessoes, preco)')
          .eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
        supabase.from('financeiro').select('*')
          .eq('cliente_id', cliente.id).order('data', { ascending: false })
      ])
      setPacotes(pac.data || [])
      setPagamentos(pag.data || [])
    }

    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const totalDevido = pagamentos.filter(p => p.tipo === 'saida' && !p.pago).reduce((s, p) => s + p.valor, 0)
  const totalPago = pagamentos.filter(p => p.tipo === 'entrada').reduce((s, p) => s + p.valor, 0)

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Minha Conta</h1>
      </div>

      {/* Resumo financeiro */}
      {(totalDevido > 0 || totalPago > 0) && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ backgroundColor: corSec }}>
            <div className="flex gap-3">
              <div className="flex-1 bg-white/70 rounded-xl p-3">
                <p className="text-xs text-gray-500">Total pago</p>
                <p className="font-bold text-gray-800">{fmt(totalPago)}</p>
              </div>
              {totalDevido > 0 && (
                <div className="flex-1 bg-red-50 rounded-xl p-3">
                  <p className="text-xs text-red-500">Em aberto</p>
                  <p className="font-bold text-red-600">{fmt(totalDevido)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="px-4 pt-4">
        <div className="flex bg-white rounded-2xl p-1 gap-1 shadow-sm">
          <button onClick={() => setAba('pacotes')}
            className={'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ' +
              (aba === 'pacotes' ? 'text-white' : 'text-gray-400')}
            style={aba === 'pacotes' ? { backgroundColor: cor } : {}}>
            <Package size={15} />Pacotes
          </button>
          <button onClick={() => setAba('pagamentos')}
            className={'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ' +
              (aba === 'pagamentos' ? 'text-white' : 'text-gray-400')}
            style={aba === 'pagamentos' ? { backgroundColor: cor } : {}}>
            <DollarSign size={15} />Pagamentos
          </button>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {carregando ? (
          <div className="flex justify-center py-8">
            <div className="w-7 h-7 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor, borderTopColor: 'transparent' }} />
          </div>
        ) : aba === 'pacotes' ? (
          pacotes.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <Package size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-gray-400 text-sm">Nenhum pacote contratado</p>
            </div>
          ) : pacotes.map(p => {
            const usadas = p.sessoes_usadas || 0
            const total = p.pacotes?.total_sessoes || 0
            const restantes = total - usadas
            const vencido = p.validade && new Date(p.validade) < new Date()
            const progresso = total > 0 ? (usadas / total) * 100 : 0

            return (
              <div key={p.id} className={'bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3 ' +
                (vencido ? 'opacity-60' : '')}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{p.pacotes?.nome || 'Pacote'}</p>
                    {p.validade && (
                      <p className={'text-xs mt-0.5 ' + (vencido ? 'text-red-500' : 'text-gray-400')}>
                        {vencido ? 'Vencido em ' : 'Válido até '}
                        {new Date(p.validade + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <span className={'text-xs px-2.5 py-1 rounded-full font-medium ' +
                    (vencido ? 'bg-gray-100 text-gray-500' :
                     restantes === 0 ? 'bg-green-50 text-green-600' :
                     'bg-blue-50 text-blue-600')}>
                    {vencido ? 'Vencido' : restantes === 0 ? 'Concluído' : 'Ativo'}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{usadas} sessões usadas</span>
                    <span>{restantes} restantes de {total}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: progresso + '%', backgroundColor: cor }} />
                  </div>
                </div>

                {p.pacotes?.preco && (
                  <p className="text-xs text-gray-400">
                    Valor do pacote: <span className="font-semibold text-gray-600">{fmt(p.pacotes.preco)}</span>
                  </p>
                )}
              </div>
            )
          })
        ) : (
          pagamentos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <FileText size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-gray-400 text-sm">Nenhum pagamento registrado</p>
            </div>
          ) : pagamentos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
              <div className={'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ' +
                (p.tipo === 'entrada' ? 'bg-green-50' : 'bg-gray-50')}>
                {p.tipo === 'entrada'
                  ? <CheckCircle size={16} className="text-green-600" />
                  : p.pago
                    ? <CheckCircle size={16} className="text-gray-400" />
                    : <AlertCircle size={16} className="text-orange-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.descricao || p.categoria}</p>
                <p className="text-xs text-gray-400">{new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={'font-bold text-sm ' + (p.tipo === 'entrada' ? 'text-green-600' : 'text-gray-700')}>
                  {p.tipo === 'entrada' ? '+' : '-'}{fmt(p.valor)}
                </p>
                {p.tipo !== 'entrada' && (
                  <p className={'text-xs ' + (p.pago ? 'text-gray-400' : 'text-orange-500')}>
                    {p.pago ? 'Pago' : 'Em aberto'}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}