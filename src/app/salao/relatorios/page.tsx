'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Users, Scissors, Star, Calendar } from 'lucide-react'

export default function RelatoriosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [dados, setDados] = useState<any>(null)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregar()
  }, [loading, filtroMes])

  async function carregar() {
    setCarregando(true)
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const sid = profile!.salao_id!
    const inicio = filtroMes + '-01'
    const fim = new Date(filtroMes + '-01')
    fim.setMonth(fim.getMonth() + 1)
    const fimStr = fim.toISOString().slice(0, 10)

    const mesAnterior = new Date(filtroMes + '-01')
    mesAnterior.setMonth(mesAnterior.getMonth() - 1)
    const inicioAnterior = mesAnterior.toISOString().slice(0, 7) + '-01'

    const [financeiro, agendamentos, clientes, agMesAnterior] = await Promise.all([
      supabase.from('financeiro').select('*').eq('salao_id', sid).gte('data', inicio).lt('data', fimStr),
      supabase.from('agendamentos').select('*, servicos(nome, preco), clientes(id, nome)').eq('salao_id', sid).gte('data', inicio).lt('data', fimStr),
      supabase.from('clientes').select('id, created_at').eq('salao_id', sid),
      supabase.from('agendamentos').select('*, servicos(preco)').eq('salao_id', sid).gte('data', inicioAnterior).lt('data', inicio).eq('status', 'concluido')
    ])

    const ags = agendamentos.data || []
    const fin = financeiro.data || []
    const cls = clientes.data || []

    // Faturamento
    const entradas = fin.filter(f => f.tipo === 'entrada').reduce((s, f) => s + f.valor, 0)
    const saidas = fin.filter(f => f.tipo === 'saida').reduce((s, f) => s + f.valor, 0)

    // Faturamento mês anterior
    const faturamentoAnterior = (agMesAnterior.data || []).reduce((s, a) => s + (a.servicos?.preco || 0), 0)

    // Serviços mais feitos
    const porServico: Record<string, { nome: string; count: number; total: number }> = {}
    for (const a of ags.filter(a => a.status === 'concluido')) {
      const sid2 = a.servico_id
      if (!sid2 || !a.servicos) continue
      if (!porServico[sid2]) porServico[sid2] = { nome: a.servicos.nome, count: 0, total: 0 }
      porServico[sid2].count++
      porServico[sid2].total += a.servicos.preco || 0
    }
    const topServicos = Object.values(porServico).sort((a, b) => b.count - a.count).slice(0, 5)

    // Taxa de conclusão
    const total = ags.length
    const concluidos = ags.filter(a => a.status === 'concluido').length
    const cancelados = ags.filter(a => a.status === 'cancelado').length
    const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0

    // Clientes novos no mês
    const clientesNovos = cls.filter(c => c.created_at >= inicio && c.created_at < fimStr).length

    // Clientes mais frequentes
    const freq: Record<string, { nome: string; count: number }> = {}
    for (const a of ags.filter(a => a.status === 'concluido')) {
      if (!a.clientes) continue
      const cid = a.clientes.id
      if (!freq[cid]) freq[cid] = { nome: a.clientes.nome, count: 0 }
      freq[cid].count++
    }
    const topClientes = Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 3)

    // Ticket médio
    const ticketMedio = concluidos > 0 ? entradas / concluidos : 0

    // Variação em relação ao mês anterior
    const variacao = faturamentoAnterior > 0
      ? Math.round(((entradas - faturamentoAnterior) / faturamentoAnterior) * 100)
      : 0

    setDados({
      entradas, saidas, saldo: entradas - saidas,
      concluidos, cancelados, total, taxaConclusao,
      clientesNovos, totalClientes: cls.length,
      topServicos, topClientes, ticketMedio, variacao
    })
    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  })

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Relatórios</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Seletor mês */}
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

        {carregando ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor, borderTopColor: 'transparent' }} />
          </div>
        ) : !dados ? null : (
          <>
            {/* Faturamento */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} style={{ color: cor }} />
                <p className="font-semibold text-gray-800 text-sm">Faturamento</p>
                {dados.variacao !== 0 && (
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ml-auto ' +
                    (dados.variacao > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
                    {dados.variacao > 0 ? '+' : ''}{dados.variacao}% vs mês anterior
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-green-600">Entradas</p>
                  <p className="font-bold text-green-700">{fmt(dados.entradas)}</p>
                </div>
                <div className="flex-1 bg-red-50 rounded-xl p-3">
                  <p className="text-xs text-red-500">Saídas</p>
                  <p className="font-bold text-red-600">{fmt(dados.saidas)}</p>
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ backgroundColor: corSec }}>
                <p className="text-xs text-gray-500">Saldo líquido</p>
                <p className="font-bold text-lg" style={{ color: cor }}>{fmt(dados.saldo)}</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Ticket médio</p>
                  <p className="font-bold text-gray-700">{fmt(dados.ticketMedio)}</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Atendimentos</p>
                  <p className="font-bold text-gray-700">{dados.concluidos}</p>
                </div>
              </div>
            </div>

            {/* Agendamentos */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} style={{ color: cor }} />
                <p className="font-semibold text-gray-800 text-sm">Agendamentos</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: dados.taxaConclusao + '%', backgroundColor: cor }} />
                </div>
                <span className="text-sm font-bold text-gray-700">{dados.taxaConclusao}%</span>
              </div>
              <div className="flex gap-3 text-center">
                <div className="flex-1">
                  <p className="text-xl font-bold text-gray-900">{dados.total}</p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold text-green-600">{dados.concluidos}</p>
                  <p className="text-xs text-gray-400">Concluídos</p>
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold text-red-500">{dados.cancelados}</p>
                  <p className="text-xs text-gray-400">Cancelados</p>
                </div>
              </div>
            </div>

            {/* Clientes */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Users size={16} style={{ color: cor }} />
                <p className="font-semibold text-gray-800 text-sm">Clientes</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: corSec }}>
                  <p className="text-xs text-gray-500">Total cadastradas</p>
                  <p className="font-bold text-xl" style={{ color: cor }}>{dados.totalClientes}</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Novas este mês</p>
                  <p className="font-bold text-xl text-gray-700">+{dados.clientesNovos}</p>
                </div>
              </div>
              {dados.topClientes.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Mais frequentes este mês</p>
                  {dados.topClientes.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 py-1.5">
                      <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                      <p className="text-sm text-gray-700 flex-1">{c.nome}</p>
                      <span className="text-xs text-gray-400">{c.count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Serviços */}
            {dados.topServicos.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Scissors size={16} style={{ color: cor }} />
                  <p className="font-semibold text-gray-800 text-sm">Serviços mais feitos</p>
                </div>
                {dados.topServicos.map((s: any, i: number) => {
                  const maxCount = dados.topServicos[0].count
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-700">{s.nome}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{s.count}x</span>
                          <span className="text-xs font-semibold text-gray-600">{fmt(s.total)}</span>
                        </div>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: (s.count / maxCount * 100) + '%', backgroundColor: cor }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Estrela do mês */}
            {dados.topServicos[0] && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: corSec }}>
                <Star size={20} style={{ color: cor }} />
                <div>
                  <p className="text-xs text-gray-500">Serviço destaque do mês</p>
                  <p className="font-bold text-gray-900">{dados.topServicos[0].nome}</p>
                  <p className="text-xs" style={{ color: cor }}>{fmt(dados.topServicos[0].total)} gerados</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}