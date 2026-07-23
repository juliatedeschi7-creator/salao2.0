'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  Calendar, Users, Notebook, Scissors, 
  CheckSquare, BarChart2, LogOut, Bell 
} from 'lucide-react'

export default function FuncionarioDashboard() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [atendimentosHoje, setAtendimentosHoje] = useState(0)
  const [confirmadosHoje, setConfirmadosHoje] = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    const hojeStr = new Date().toISOString().split('T')[0]

    const [salRes, agendRes] = await Promise.all([
      supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
      supabase
        .from('agendamentos')
        .select('*')
        .eq('salao_id', profile!.salao_id!)
        .eq('funcionario_id', profile!.id)
        .gte('data_hora', `${hojeStr}T00:00:00`)
        .lte('data_hora', `${hojeStr}T23:59:59`)
    ])

    setSalao(salRes.data)

    const listaAgendamentos = agendRes.data || []
    setAtendimentosHoje(listaAgendamentos.length)
    setConfirmadosHoje(listaAgendamentos.filter((a: any) => a.status === 'confirmado').length)
    
    setCarregando(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  // Cumprimento baseado no horário
  const horaAtual = new Date().getHours()
  const saudacao = horaAtual < 12 ? 'Bom dia' : horaAtual < 18 ? 'Boa tarde' : 'Boa noite'

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: cor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      
      {/* ─── TOPO COR-DE-ROSA DA TELA ─────────────────────────────────── */}
      <div className="p-6 text-white rounded-b-3xl shadow-md" style={{ backgroundColor: cor }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-white/80 font-medium">
              {salao?.nome || 'Espaço de beleza'}
            </p>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
              {profile?.role || 'Funcionário'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => router.push('/salao/notificacoes')}
              className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
              <Bell size={18} />
            </button>
            <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center font-bold text-sm">
              {profile?.nome?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold">
          {saudacao}, {profile?.nome?.split(' ')[0]}!
        </h1>
        <p className="text-xs text-white/80 capitalize mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="px-4 -mt-4 space-y-4">

        {/* ─── CARDS DE ESTATÍSTICAS DO DIA ────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 font-medium">Meus atendimentos hoje</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{atendimentosHoje}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 font-medium">Confirmados</p>
            <p className="text-2xl font-bold mt-1" style={{ color: cor }}>{confirmadosHoje}</p>
          </div>
        </div>

        {/* ─── GRID DE ATALHOS / MÓDULOS ───────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          
          {/* Minha Agenda */}
          <button
            onClick={() => router.push('/funcionario/agenda')}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center" style={{ color: cor }}>
              <Calendar size={22} />
            </div>
            <span className="text-xs font-bold text-gray-800">Minha Agenda</span>
          </button>

          {/* Clientes */}
          <button
            onClick={() => router.push('/salao/clientes')}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center" style={{ color: cor }}>
              <Users size={22} />
            </div>
            <span className="text-xs font-bold text-gray-800">Clientes</span>
          </button>

          {/* Guia / Caderno de Tarefas */}
          <button
            onClick={() => router.push('/salao/guia')}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center" style={{ color: cor }}>
              <Notebook size={22} />
            </div>
            <span className="text-xs font-bold text-gray-800">Guia de Tarefas</span>
          </button>

          {/* Serviços */}
          <button
            onClick={() => router.push('/salao/servicos')}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center" style={{ color: cor }}>
              <Scissors size={22} />
            </div>
            <span className="text-xs font-bold text-gray-800">Serviços</span>
          </button>

          {/* Lembretes */}
          <button
            onClick={() => router.push('/salao/lembretes')}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center" style={{ color: cor }}>
              <CheckSquare size={22} />
            </div>
            <span className="text-xs font-bold text-gray-800">Lembretes</span>
          </button>

          {/* Financeiro */}
          <button
            onClick={() => router.push('/salao/financeiro')}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center" style={{ color: cor }}>
              <BarChart2 size={22} />
            </div>
            <span className="text-xs font-bold text-gray-800">Financeiro</span>
          </button>

        </div>

        {/* BOTÃO DE SAIR */}
        <div className="pt-4 flex justify-center">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-gray-400 font-medium hover:text-gray-600 transition-colors py-2 px-4">
            <LogOut size={16} /> Sair da conta
          </button>
        </div>

      </div>
    </div>
  )
}
