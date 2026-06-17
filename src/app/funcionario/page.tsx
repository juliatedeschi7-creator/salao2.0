'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Calendar, Users, Scissors, BarChart2, Bell, LogOut, Clock } from 'lucide-react'

export default function FuncionarioPage() {
  const { profile, loading, logout } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    if (!profile?.salao_id) return
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile.salao_id).single()
    setSalao(sal)
    const hoje = new Date()
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString()
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(nome), servicos(nome)')
      .eq('salao_id', profile.salao_id)
      .eq('profissional_id', profile.id)
      .gte('data_hora', inicio).lte('data_hora', fim).order('data_hora')
    setAgendamentos(ags || [])
    const { count } = await supabase.from('notificacoes').select('*', { count: 'exact', head: true }).eq('destinatario_id', profile.id).eq('lida', false)
    setNotifCount(count || 0)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6" style={{ backgroundColor: cor }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs">{salao?.nome}</p>
            <p className="text-white font-bold">Funcionario</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/funcionario/notificacoes')}
              className="relative w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Bell size={18} className="text-white" />
              {notifCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">{notifCount}</span>}
            </button>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {profile?.nome?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <h1 className="text-white text-2xl font-bold">{saudacao}, {profile?.nome?.split(' ')[0]}!</h1>
        <p className="text-white/70 text-sm">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500">Meus atendimentos hoje</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{agendamentos.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Confirmados</p>
            <p className="text-3xl font-bold mt-1" style={{ color: cor }}>
              {agendamentos.filter(a => a.status === 'confirmado').length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Calendar, label: 'Minha Agenda', href: '/funcionario/agenda' },
            { icon: Users, label: 'Clientes', href: '/funcionario/clientes' },
            { icon: Scissors, label: 'Servicos', href: '/funcionario/servicos' },
            { icon: BarChart2, label: 'Financeiro', href: '/funcionario/financeiro' },
          ].map(({ icon: Icon, label, href }) => (
            <button key={href} onClick={() => router.push(href)}
              className="card flex flex-col items-center gap-2 py-5 active:scale-95 transition-all">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: corSec }}>
                <Icon size={22} style={{ color: cor }} />
              </div>
              <p className="text-sm font-medium text-gray-700">{label}</p>
            </button>
          ))}
        </div>

        {agendamentos.length > 0 && (
          <div>
            <p className="font-bold text-gray-900 mb-2">Minha agenda de hoje</p>
            {agendamentos.map(ag => (
              <div key={ag.id} className="card flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1 shrink-0">
                  <Clock size={14} style={{ color: cor }} />
                  <span className="text-sm font-bold text-gray-900">
                    {new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{ag.clientes?.nome}</p>
                  <p className="text-xs text-gray-400">{ag.servicos?.nome}</p>
                </div>
                <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                  (ag.status === 'confirmado' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600')}>
                  {ag.status}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={logout} className="flex items-center justify-center gap-2 text-gray-400 text-sm py-3">
          <LogOut size={16} />Sair da conta
        </button>
      </div>
    </div>
  )
}
