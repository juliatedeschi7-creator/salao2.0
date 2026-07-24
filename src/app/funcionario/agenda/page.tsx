'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar as CalendarIcon, Clock, User, Scissors } from 'lucide-react'

export default function AgendaFuncionarioPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salao, setSalao] = useState<any>(null)
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    if (profile.salao_id) {
      carregarAgendaGeral()
    }
  }, [loading, profile, dataSelecionada])

  async function carregarAgendaGeral() {
    setCarregando(true)
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const inicioDia = `${dataSelecionada}T00:00:00`
    const fimDia = `${dataSelecionada}T23:59:59`

    const { data, error } = await supabase
      .from('agendamentos')
      .select('*, clientes(nome, telefone), servicos(nome, duracao_minutos), profiles:profissional_id(nome)')
      .eq('salao_id', profile!.salao_id!)
      .gte('data_hora', inicioDia)
      .lte('data_hora', fimDia)
      .order('data_hora', { ascending: true })

    if (!error) {
      setAgendamentos(data || [])
    }
    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const p = profile as any
  const isFuncionarioComum = p?.tipo === 'funcionario' || p?.nivel === 'funcionario'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Agenda Geral do Salão</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="bg-white p-3 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} style={{ color: cor }} />
            <span className="text-sm font-semibold text-gray-700">Data do atendimento:</span>
          </div>
          <input 
            type="date" 
            className="input-field text-sm py-1 px-2 w-auto" 
            value={dataSelecionada} 
            onChange={e => setDataSelecionada(e.target.value)} 
          />
        </div>

        {isFuncionarioComum && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs text-blue-700 font-medium text-center">
              👁️ Modo de visualização: Você está acessando a agenda geral em modo somente leitura.
            </p>
          </div>
        )}

        {carregando ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
          </div>
        ) : agendamentos.length === 0 ? (
          <div className="card text-center py-12">
            <CalendarIcon size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum agendamento para esta data.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {agendamentos.map(ag => (
              <div key={ag.id} className="card flex flex-col gap-2.5 bg-white border border-gray-100 shadow-sm rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs" style={{ backgroundColor: cor }}>
                      {ag.clientes?.nome?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{ag.clientes?.nome || 'Cliente'}</p>
                      <p className="text-xs text-gray-400">{ag.clientes?.telefone || 'Sem telefone'}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                    ag.status === 'confirmado' ? 'bg-green-50 text-green-600' :
                    ag.status === 'cancelado' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                  }`}>
                    {ag.status}
                  </span>
                </div>

                <div className="border-t border-gray-50 pt-2 flex flex-col gap-1.5 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-gray-400" />
                    <span className="font-semibold text-gray-800">
                      {new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Scissors size={14} className="text-gray-400" />
                    <span>{ag.servicos?.nome || 'Serviço'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User size={14} className="text-gray-400" />
                    <span>Profissional: <strong className="text-gray-800">{ag.profiles?.nome || 'Não atribuído'}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
