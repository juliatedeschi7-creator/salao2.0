'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, CheckCircle, XCircle } from 'lucide-react'

export default function FuncionarioAgendaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [dataSelecionada, setDataSelecionada] = useState(new Date())

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading, dataSelecionada])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const inicio = new Date(dataSelecionada); inicio.setHours(0, 0, 0, 0)
    const fim = new Date(dataSelecionada); fim.setHours(23, 59, 59, 999)
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(nome), servicos(nome)')
      .eq('salao_id', profile!.salao_id!)
      .eq('profissional_id', profile!.id)
      .gte('data_hora', inicio.toISOString()).lte('data_hora', fim.toISOString()).order('data_hora')
    setAgendamentos(ags || [])
  }

  async function concluir(id: string) {
    await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  function diasSemana() {
    const dias = []
    const inicio = new Date(dataSelecionada)
    inicio.setDate(inicio.getDate() - inicio.getDay() + 1)
    for (let i = 0; i < 7; i++) { const d = new Date(inicio); d.setDate(inicio.getDate() + i); dias.push(d) }
    return dias
  }
  const labels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg">Minha Agenda</h1>
      </div>
      <div className="bg-white px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pt-3 pb-1">
          {diasSemana().map((dia, i) => {
            const sel = dia.toDateString() === dataSelecionada.toDateString()
            return (
              <button key={i} onClick={() => setDataSelecionada(dia)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl min-w-[44px] transition-all"
                style={sel ? { backgroundColor: cor } : {}}>
                <span className={'text-xs font-medium ' + (sel ? 'text-white' : 'text-gray-400')}>{labels[i]}</span>
                <span className={'text-base font-bold ' + (sel ? 'text-white' : 'text-gray-900')}>{dia.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {agendamentos.length === 0 ? (
          <div className="card text-center py-10"><Calendar size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhum atendimento</p></div>
        ) : agendamentos.map(ag => (
          <div key={ag.id} className="card flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900">{ag.clientes?.nome}</p>
                <p className="text-sm text-gray-500">{ag.servicos?.nome}</p>
                <p className="text-xs text-gray-400">{new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                (ag.status === 'confirmado' ? 'bg-green-50 text-green-600' :
                ag.status === 'concluido' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-50 text-yellow-600')}>
                {ag.status}
              </span>
            </div>
            {ag.status === 'confirmado' && (
              <button onClick={() => concluir(ag.id)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ backgroundColor: cor }}>
                <CheckCircle size={16} />Marcar como concluido
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
