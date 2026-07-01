'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Clock, DollarSign, Package } from 'lucide-react'

export default function CaixaDiaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [caixa, setCaixa] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [fechando, setFechando] = useState(false)

  const hoje = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!loading && profile?.salao_id) inicializar()
  }, [loading])

  async function inicializar() {
    setCarregando(true)
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, clientes(nome), servicos(nome, preco), pacotes_cliente(id, nome)')
      .eq('salao_id', profile!.salao_id!)
      .eq('data', hoje)
      .order('hora')
    setAgendamentos(ags || [])

    const { data: cx } = await supabase
      .from('caixa_dia')
      .select('*')
      .eq('salao_id', profile!.salao_id!)
      .eq('data', hoje)
      .single()
    setCaixa(cx)
    setCarregando(false)
  }

  async function marcarConcluido(ag: any) {
    await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', ag.id)

    // Só lança no financeiro se não for pacote (pacote lança quando inicia)
    if (!ag.pacote_cliente_id && ag.servicos?.preco) {
      await supabase.from('financeiro').insert({
        salao_id: profile!.salao_id,
        descricao: `${ag.servicos.nome} - ${ag.clientes?.nome}`,
        valor: ag.servicos.preco,
        tipo: 'entrada',
        categoria: 'Serviço',
        data: hoje,
        agendamento_id: ag.id
      })
    }
    inicializar()
  }

  async function fecharCaixa() {
    setFechando(true)
    if (caixa) {
      await supabase.from('caixa_dia').update({ fechado: true }).eq('id', caixa.id)
    } else {
      await supabase.from('caixa_dia').insert({
        salao_id: profile!.salao_id, data: hoje, fechado: true
      })
    }
    setFechando(false)
    inicializar()
  }

  const concluidos = agendamentos.filter(a => a.status === 'concluido')
  const pendentes = agendamentos.filter(a => a.status !== 'concluido' && a.status !== 'cancelado')
  const totalDia = concluidos
    .filter(a => !a.pacote_cliente_id)
    .reduce((s, a) => s + (a.servicos?.preco || 0), 0)

  const cor = salao?.cor_primaria || '#E91E8C'
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-lg">Caixa do Dia</h1>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
        </div>
        {caixa?.fechado && (
          <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-medium">Fechado</span>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Resumo do dia */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xs text-gray-400">Agendamentos</p>
            <p className="font-bold text-gray-900 text-xl mt-1">{agendamentos.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xs text-gray-400">Concluídos</p>
            <p className="font-bold text-xl mt-1" style={{ color: cor }}>{concluidos.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xs text-gray-400">Pendentes</p>
            <p className="font-bold text-orange-500 text-xl mt-1">{pendentes.length}</p>
          </div>
        </div>

        {/* Total */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: salao?.cor_secundaria || '#FCE4F3' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: cor }}>
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total em dinheiro hoje</p>
            <p className="font-bold text-2xl text-gray-900">{fmt(totalDia)}</p>
            <p className="text-xs text-gray-400">Pacotes não contabilizados aqui</p>
          </div>
        </div>

        {/* Lista de atendimentos */}
        {carregando ? (
          <div className="flex justify-center py-8">
            <div className="w-7 h-7 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor, borderTopColor: 'transparent' }} />
          </div>
        ) : agendamentos.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <p className="text-gray-400 text-sm">Nenhum agendamento hoje</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-700">Atendimentos de hoje</p>
            {agendamentos.map(ag => (
              <div key={ag.id} className={'bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 ' +
                (ag.status === 'cancelado' ? 'opacity-50' : '')}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: salao?.cor_secundaria || '#FCE4F3' }}>
                  {ag.pacote_cliente_id
                    ? <Package size={16} style={{ color: cor }} />
                    : <Clock size={16} style={{ color: cor }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{ag.clientes?.nome}</p>
                  <p className="text-xs text-gray-400">{ag.hora} · {ag.servicos?.nome}</p>
                  {ag.pacote_cliente_id && (
                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">Pacote</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {ag.status === 'concluido' ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle size={14} />Concluído
                    </span>
                  ) : ag.status !== 'cancelado' ? (
                    <button onClick={() => marcarConcluido(ag)}
                      className="text-xs px-3 py-1.5 rounded-xl text-white font-medium"
                      style={{ backgroundColor: cor }}>
                      Concluir
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Cancelado</span>
                  )}
                  {!ag.pacote_cliente_id && ag.servicos?.preco && (
                    <p className="text-xs text-gray-400">{fmt(ag.servicos.preco)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fechar caixa */}
        {!caixa?.fechado && (
          <button onClick={fecharCaixa} disabled={fechando}
            className="w-full py-4 rounded-2xl border-2 font-semibold text-sm disabled:opacity-50"
            style={{ borderColor: cor, color: cor }}>
            {fechando ? 'Fechando...' : 'Fechar Caixa do Dia'}
          </button>
        )}

        {caixa?.fechado && (
          <div className="bg-gray-100 rounded-2xl p-4 text-center">
            <CheckCircle size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-semibold text-gray-600">Caixa fechado</p>
            <p className="text-xs text-gray-400 mt-1">Total registrado: {fmt(totalDia)}</p>
          </div>
        )}
      </div>
    </div>
  )
}