'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Calendar, Scissors, Package, FileText, Star, Clock, ChevronRight, LogOut, Bell } from 'lucide-react'

export default function ClientePage() {
  const { profile, loading, logout } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    if (!profile) return

    const { data: cli } = await supabase
      .from('clientes')
      .select('*, saloes(*)')
      .eq('profile_id', profile.id)
      .single()
    setCliente(cli)
    if (cli?.saloes) setSalao(cli.saloes)

    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, servicos(nome, preco), profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('cliente_id', cli?.id)
      .order('data_hora', { ascending: false })
      .limit(10)
    setAgendamentos(ags || [])

    const { count } = await supabase
      .from('notificacoes')
      .select('*', { count: 'exact', head: true })
      .eq('destinatario_id', profile.id)
      .eq('lida', false)
    setNotifCount(count || 0)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'

  const proximos = agendamentos.filter(a =>
    new Date(a.data_hora) >= new Date() && a.status !== 'cancelado'
  )
  const historico = agendamentos.filter(a =>
    new Date(a.data_hora) < new Date() || a.status === 'concluido'
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header com cores do salão */}
      <div className="px-4 pt-12 pb-6" style={{ backgroundColor: cor }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs">Bem-vinda ao</p>
            <p className="text-white font-bold text-lg">{salao?.nome || 'Organiza'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/cliente/notificacoes')}
              className="relative w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Bell size={18} className="text-white" />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                  {notifCount}
                </span>
              )}
            </button>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {profile?.nome?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <h1 className="text-white text-2xl font-bold">Ola, {profile?.nome?.split(' ')[0]}!</h1>
        <p className="text-white/70 text-sm mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Próximo agendamento */}
      {proximos.length > 0 && (
        <div className="mx-4 -mt-4 card border-l-4 mb-4" style={{ borderColor: cor }}>
          <p className="text-xs text-gray-400 mb-1">Proximo agendamento</p>
          <p className="font-bold text-gray-900">{proximos[0].servicos?.nome}</p>
          <div className="flex items-center gap-2 mt-1">
            <Clock size={14} style={{ color: cor }} />
            <p className="text-sm text-gray-500">
              {new Date(proximos[0].data_hora).toLocaleDateString('pt-BR', {
                weekday: 'short', day: 'numeric', month: 'short'
              })} às {new Date(proximos[0].data_hora).toLocaleTimeString('pt-BR', {
                hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      )}

      <div className="px-4 flex flex-col gap-4">
        {/* Menu rápido */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Calendar, label: 'Meus Agendamentos', href: '/cliente/agendamentos' },
            { icon: Scissors, label: 'Servicos do Salao', href: '/cliente/servicos' },
            { icon: Package, label: 'Meus Pacotes', href: '/cliente/pacotes' },
            { icon: FileText, label: 'Anamnese', href: '/cliente/anamnese' },
          ].map(({ icon: Icon, label, href }) => (
            <button key={href} onClick={() => router.push(href)}
              className="card flex flex-col items-center gap-2 py-5 active:scale-95 transition-all">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: corSec }}>
                <Icon size={22} style={{ color: cor }} />
              </div>
              <p className="text-sm font-medium text-gray-700 text-center">{label}</p>
            </button>
          ))}
        </div>

        {/* Historico */}
        {historico.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-gray-900">Historico de visitas</p>
              <button onClick={() => router.push('/cliente/agendamentos')}
                className="text-sm font-medium" style={{ color: cor }}>
                Ver todos
              </button>
            </div>
            {historico.slice(0, 3).map(ag => (
              <div key={ag.id} className="card flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: corSec }}>
                  <Scissors size={18} style={{ color: cor }} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{ag.servicos?.nome}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(ag.data_hora).toLocaleDateString('pt-BR')} com {ag.profiles?.nome}
                  </p>
                </div>
                {ag.valor && (
                  <p className="text-sm font-bold" style={{ color: cor }}>
                    R$ {ag.valor.toFixed(2).replace('.', ',')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Avaliacao */}
        <button onClick={() => router.push('/cliente/avaliacoes')}
          className="card flex items-center gap-3 active:scale-95 transition-all">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: corSec }}>
            <Star size={18} style={{ color: cor }} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-gray-900">Deixar avaliacao</p>
            <p className="text-xs text-gray-400">Compartilhe sua experiencia</p>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>

        {/* Sair */}
        <button onClick={logout}
          className="flex items-center justify-center gap-2 text-gray-400 text-sm py-3">
          <LogOut size={16} />Sair da conta
        </button>
      </div>
    </div>
  )
}
