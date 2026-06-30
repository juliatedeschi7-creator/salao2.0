'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Store, Users, Bell, LogOut, ChevronRight, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const { profile, loading, logout } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({ total: 0, ativos: 0, pausados: 0, pendentes: 0, totalUsuarios: 0 })

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (profile.role !== 'admin_geral') { router.replace('/login'); return }
    carregarStats()
  }, [profile, loading])

async function carregarStats() {
  const { data } = await supabase
    .from('admin_resumo_saloes')
    .select('*')
    .single()

  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .neq('role', 'admin_geral')
    .eq('ativo', true)
    .eq('aprovado', true)

  setStats({
    total: data?.total_saloes || 0,
    ativos: data?.saloes_ativos || 0,
    pausados: data?.saloes_pausados || 0,
    pendentes: data?.saloes_pendentes || 0,
    totalUsuarios: count || 0
  })

  if (loading || !profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center p-1">
            <img src="/logo.png" alt="Organiza" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="text-gray-400 text-xs">Administrador</p>
            <p className="text-white font-bold">Organiza</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/admin/notificacoes')}
            className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <Bell size={18} className="text-white" />
            {stats.pendentes > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                {stats.pendentes}
              </span>
            )}
          </button>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
            {profile.nome?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="px-4 py-6 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{saudacao}, {profile.nome?.split(' ')[0]}!</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card border-l-4 border-gray-900">
            <p className="text-xs text-gray-400 mb-1">Total Salões</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="card border-l-4 border-green-500">
            <p className="text-xs text-gray-400 mb-1">Ativos</p>
            <p className="text-3xl font-bold text-green-600">{stats.ativos}</p>
          </div>
          <div className="card border-l-4 border-yellow-500">
            <p className="text-xs text-gray-400 mb-1">Pausados</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.pausados}</p>
          </div>
          <div className="card border-l-4 border-blue-500">
            <p className="text-xs text-gray-400 mb-1">Usuários</p>
            <p className="text-3xl font-bold text-blue-600">{stats.totalUsuarios}</p>
          </div>
        </div>

        {stats.pendentes > 0 && (
          <button onClick={() => router.push('/admin/saloes?filtro=pendentes')}
            className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Clock size={20} className="text-blue-500 shrink-0" />
            <div className="flex-1 text-left">
              <p className="font-semibold text-blue-700 text-sm">{stats.pendentes} salão(ões) aguardando aprovação</p>
              <p className="text-xs text-blue-400">Toque para revisar</p>
            </div>
            <ChevronRight size={18} className="text-blue-300" />
          </button>
        )}

        <h2 className="font-bold text-gray-900 mt-2">Acesso Rápido</h2>
        <div className="flex flex-col gap-3">
          {[
            { label: 'Gerenciar Salões', desc: 'Aprovar, pausar e editar salões', href: '/admin/saloes', icon: Store },
            { label: 'Gerenciar Usuários', desc: 'Aprovar e controlar usuários', href: '/admin/usuarios', icon: Users },
            { label: 'Notificações', desc: 'Mensagens para os donos', href: '/admin/notificacoes', icon: Bell },
          ].map(({ label, desc, href, icon: Icon }) => (
            <button key={href} onClick={() => router.push(href)}
              className="card flex items-center gap-4 text-left active:scale-95 transition-all">
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-gray-700" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          ))}
        </div>

        <button onClick={logout}
          className="flex items-center justify-center gap-2 text-gray-400 text-sm mt-2 py-3">
          <LogOut size={16} />Sair da conta
        </button>
      </div>
    </div>
  )
}

