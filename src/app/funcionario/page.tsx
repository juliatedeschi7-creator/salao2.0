'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Calendar, Users, DollarSign, Bell, Scissors, CheckCircle2, Clock } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function FuncionarioDashboard() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [atendimentosHoje, setAtendimentosHoje] = useState(0)
  const [confirmadosHoje, setConfirmadosHoje] = useState(0)
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    
    if (profile.role !== 'funcionario' && profile.role !== 'dono_salao') { 
      router.push('/login') 
      return 
    }
    
    carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    try {
      const hojeStr = new Date().toISOString().split('T')[0]

      if (profile?.salao_id) {
        const [salRes, agendRes] = await Promise.all([
          supabase.from('saloes').select('*').eq('id', profile.salao_id).single(),
          supabase.from('agendamentos').select('*')
            .eq('salao_id', profile.salao_id)
            .eq('profissional_id', profile.id)
            .gte('data_hora', `${hojeStr}T00:00:00`)
            .lte('data_hora', `${hojeStr}T23:59:59`)
        ])
        setSalao(salRes.data)
        const lista = agendRes.data || []
        setAtendimentosHoje(lista.length)
        setConfirmadosHoje(lista.filter((a: any) => a.status === 'confirmado').length)
        setAguardandoConfirmacao(lista.filter((a: any) => a.status === 'pendente' || !a.status).length)
      }
    } catch (e) {
      console.error('Erro ao carregar:', e)
    } finally {
      setCarregando(false)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const horaAtual = new Date().getHours()
  const saudacao = horaAtual < 12 ? 'Bom dia' : horaAtual < 18 ? 'Boa tarde' : 'Boa noite'

  if (loading || carregando) return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: cor }} />
    </div>
  )

  // Itens de navegação dinâmicos baseados no cargo
  const navItems = profile?.role === 'dono_salao' ? [
    { icon: Calendar, label: 'Início', href: '/funcionario' },
    { icon: Calendar, label: 'Agenda', href: '/funcionario/agenda' },
    { icon: Users, label: 'Clientes', href: '/salao/clientes' },
    { icon: DollarSign, label: 'Finanças', href: '/salao/financeiro' },
    { icon: Bell, label: 'Avisos', href: '/salao/notificacoes' },
  ] : [
    { icon: Calendar, label: 'Início', href: '/funcionario' },
    { icon: Calendar, label: 'Agenda', href: '/funcionario/agenda' },
    // Adicione aqui apenas as rotas que o funcionário tem permissão de ver
  ]

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* Header padrão */}
      <Header profile={profile} salaoNome={salao?.nome} corPrimaria={cor} />

      <div className="px-4 py-5 space-y-4 max-w-xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{saudacao}, {profile?.nome?.split(' ')[0]}! ✨</h1>
          <p className="text-xs text-gray-500 capitalize mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {aguardandoConfirmacao > 0 && (
          <div onClick={() => router.push('/salao/notificacoes')}
            className="bg-amber-50 border border-amber-200/60 p-4 rounded-2xl flex items-center justify-between cursor-pointer shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <Bell size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900">{aguardandoConfirmacao} atendimento(s) aguardando confirmação</p>
                <p className="text-[11px] text-amber-700">Toque para gerenciar os avisos</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 font-medium">Atendimentos hoje</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{atendimentosHoje}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 font-medium">Confirmados</p>
            <p className="text-2xl font-bold mt-1" style={{ color: cor }}>{confirmadosHoje}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Agenda de Hoje</h2>
            <button onClick={() => router.push('/funcionario/agenda')} className="text-xs font-semibold" style={{ color: cor }}>
              Ver completa
            </button>
          </div>

          <div className="py-6 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400">
              <Calendar size={22} />
            </div>
            <p className="text-xs text-gray-400">Nenhum agendamento para este horário</p>
            <button onClick={() => router.push('/funcionario/agenda')}
              className="mt-2 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm"
              style={{ backgroundColor: cor }}>
              + Ver Agenda
            </button>
          </div>
        </div>
      </div>

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}
