'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function ClienteAgendamentosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [filtro, setFiltro] = useState<'proximos' | 'historico'>('proximos')

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setCliente(cli); setSalao(cli?.saloes)
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, servicos(nome, preco, descricao), profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('cliente_id', cli?.id).order('data_hora', { ascending: false })
    setAgendamentos(ags || [])
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const agora = new Date()
  const proximos = agendamentos.filter(a => new Date(a.data_hora) >= agora && a.status !== 'cancelado')
  const historico = agendamentos.filter(a => new Date(a.data_hora) < agora || a.status === 'concluido' || a.status === 'cancelado')
  const lista = filtro === 'proximos' ? proximos : historico

  const statusCor: Record<string, string> = {
    confirmado: 'bg-green-50 text-green-600',
    pendente: 'bg-yellow-50 text-yellow-600',
    concluido: 'bg-gray-100 text-gray-500',
    cancelado: 'bg-red-50 text-red-400',
    aguardando_confirmacao: 'bg-blue-50 text-blue-600',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Meus Agendamentos</h1>
      </div>

      <div className="flex bg-white border-b border-gray-100">
        {(['proximos', 'historico'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={'flex-1 py-3 text-sm font-medium transition-all ' + (filtro === f ? 'border-b-2' : 'text-gray-400')}
            style={filtro === f ? { color: cor, borderColor: cor } : {}}>
            {f === 'proximos' ? 'Proximos' : 'Historico'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {lista.length === 0 ? (
          <div className="card text-center py-10">
            <Calendar size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">{filtro === 'proximos' ? 'Nenhum agendamento futuro' : 'Nenhum historico'}</p>
          </div>
        ) : lista.map(ag => (
          <div key={ag.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900">{ag.servicos?.nome}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock size={13} className="text-gray-400" />
                  <p className="text-sm text-gray-500">
                    {new Date(ag.data_hora).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} as {new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Prof: {ag.profiles?.nome}</p>
              </div>
              <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (statusCor[ag.status] || statusCor.pendente)}>
                {ag.status.toUpperCase()}
              </span>
            </div>
            {ag.valor && <p className="text-sm font-bold" style={{ color: cor }}>R$ {ag.valor.toFixed(2).replace('.', ',')}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
