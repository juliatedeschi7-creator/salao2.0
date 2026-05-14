'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Home, Calendar, Users, BarChart2, Settings, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

interface Agendamento {
  id: string
  data_hora: string
  duracao_minutos: number
  status: string
  valor: number
  clientes: { nome: string }
  servicos: { nome: string }
  profiles: { nome: string }
}

export default function SalaoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role !== 'dono_salao' && profile.role !== 'funcionario') {
        router.push('/login')
        return
      }
      if (!profile.salao_id) {
        router.push('/criar-salao')
        return
      }
      carregarDados()
    }
  }, [profile, loading])

  async function carregarDados() {
    if (!profile?.salao_id) return

    const { data: sal } = await supabase
      .from('saloes')
      .select('*')
      .eq('id', profile.salao_id)
      .single()

    if (sal?.pausado) {
      await supabase.auth.signOut()
      router.push('/login')
      return
    }

    setSalao(sal)

    const hoje = new Date()
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
    const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString()

    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, clientes(nome), servicos(nome), profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('salao_id', profile.salao_id)
      .gte('data_hora', inicioHoje)
      .lte('data_hora', fimHoje)
      .order('data_hora')

    setAgendamentos(ags || [])
    setCarregando(false)
  }

  const navItems = [
    { icon: Home, label: 'Início', href: '/salao' },
    { icon: Calendar, label: 'Agenda', href: '/salao/agenda' },
    { icon: Users, label: 'Clientes', href: '/salao/clientes' },
    { icon: BarChart2, label: 'Finanças', href: '/salao/financeiro' },
    { icon: Settings, label: 'Ajustes', href: '/salao/configuracoes' },
  ]

  const statusConfig: Record<string, { cor: string; label: string; icon: any }> = {
    confirmado: { cor: 'text-green-600 bg-green-50', label: 'Confirmado', icon: CheckCircle },
    pendente: { cor: 'text-yellow-600 bg-yellow-50', label: 'Pendente', icon: AlertCircle },
    concluido: { cor: 'text-gray-500 bg-gray-50', label: 'Concluído', icon: CheckCircle },
    cancelado: { cor: 'text-red-500 bg-red-50', label: 'Cancelado', icon: AlertCircle },
    aguardando_confirmacao: { cor: 'text-blue-600 bg-blue-50', label: 'Aguardando', icon: Clock },
  }

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: salao?.cor_primaria || '#E91E8C' }} />
    </div>
  )

  const cor = salao?.cor_primaria || '#E91E8C'
  const hoje = new Date()

  return (
    <div className="min-h-screen bg-[#f8f4f6] pb-20">
      <Header profile={profile!} salaoNome={salao?.nome} corPrimaria={cor} />

      <div className="px-4 py-5 flex flex-col gap-4">
        {/* Saudação */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hoje.getHours() < 12 ? 'Bom dia' : hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite'}, {profile?.nome?.split(' ')[0]}! ✨
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            <span className="text-2xl font-bold text-gray-900 mr-2">{hoje.getDate()}</span>
            {hoje.toLocaleDateString('pt-BR', { weekday: 'long', month: 'long' })}
          </p>
        </div>

        {/* Resumo do dia */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500">Atendimentos hoje</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{agendamentos.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Confirmados</p>
            <p className="text-3xl font-bold mt-1" style={{ color: cor }}>
              {agendamentos.filter(a => a.status === 'confirmado').length}
            </p>
          </div>
        </div>

        {/* Agenda do dia */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Agenda de Hoje</h2>
          <button onClick={() => router.push('/salao/agenda')}
            className="text-sm font-medium" style={{ color: cor }}>
            Ver completa
          </button>
        </div>

        {agendamentos.length === 0 ? (
          <div className="card text-center py-10 flex flex-col items-center gap-3">
            <Calendar size={36} className="text-gray-300" />
            <p className="text-gray-400">Nenhum agendamento hoje</p>
            <button onClick={() => router.push('/salao/agenda')}
              className="px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: cor }}>
              + Novo Agendamento
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {agendamentos.map(ag => {
              const st = statusConfig[ag.status] || statusConfig.pendente
              const StatusIcon = st.icon
              const hora = new Date(ag.data_hora).toLocaleTimeString('pt-BR', {
                hour: '2-digit', minute: '2-digit'
              })
              const horaFim = new Date(new Date(ag.data_hora).getTime() + ag.duracao_minutos * 60000)
                .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

              return (
                <button key={ag.id}
                  onClick={() => router.push(`/salao/agenda?id=${ag.id}`)}
                  className="card text-left flex items-start gap-3 active:scale-95 transition-all">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="text-sm font-bold text-gray-900">{hora}</span>
                    <div className="w-0.5 h-4 bg-gray-200" />
                    <span className="text-xs text-gray-400">{horaFim}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <p className="font-bold text-gray-900">{ag.clientes?.nome}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${st.cor}`}>
                        <StatusIcon size={10} />
                        {st.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{ag.servicos?.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Prof: {ag.profiles?.nome}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Botão flutuante */}
      <button
        onClick={() => router.push('/salao/agenda/novo')}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white z-20"
        style={{ backgroundColor: cor }}>
        <Plus size={24} />
      </button>

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}
