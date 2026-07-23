'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  Calendar, 
  Users, 
  Scissors, 
  Package, 
  DollarSign, 
  Settings, 
  Shield, 
  LogOut, 
  Menu, 
  X,
  Home
} from 'lucide-react'

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Painel / Home', href: '/salao', icon: Home },
  { id: 'agenda_total', label: 'Agenda', href: '/salao/agenda', icon: Calendar },
  { id: 'clientes', label: 'Clientes', href: '/salao/clientes', icon: Users },
  { id: 'servicos', label: 'Serviços', href: '/salao/servicos', icon: Scissors },
  { id: 'pacotes', label: 'Pacotes', href: '/salao/pacotes/clientes', icon: Package },
  { id: 'financeiro', label: 'Financeiro', href: '/salao/financeiro', icon: DollarSign },
  { id: 'funcionarios', label: 'Funcionários', href: '/salao/funcionarios', icon: Shield },
  { id: 'configuracoes', label: 'Configurações', href: '/salao/configuracoes', icon: Settings },
]

export default function SalaoLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [salao, setSalao] = useState<any>(null)

  useEffect(() => {
    if (loading) return
    // Apenas redireciona para o login se realmente não houver perfil logado
    if (!profile) {
      router.push('/login')
      return
    }

    if (profile.salao_id) {
      supabase
        .from('saloes')
        .select('*')
        .eq('id', profile.salao_id)
        .single()
        .then(({ data }) => setSalao(data))
    }
  }, [loading, profile])

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600" />
      </div>
    )
  }

  const corPrimaria = salao?.cor_primaria || '#E91E8C'
  const eDono = (profile.role as string) === 'dono'
  const permissoes = profile.permissoes_paginas || {}

  // Se for dono vê tudo. Se for funcionário, valida se a permissão não está explicitamente false.
  const menuFiltrado = MENU_ITEMS.filter(item => {
    if (eDono) return true
    if (permissoes[item.id] === false) return false
    return true
  })

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col md:flex-row">
      {/* MOBILE HEADER */}
      <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-gray-700 hover:bg-gray-100">
            <Menu size={22} />
          </button>
          <span className="font-bold text-gray-900 truncate max-w-[200px]">
            {salao?.nome || 'Organiza Salão'}
          </span>
        </div>
        
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
          style={{ backgroundColor: corPrimaria }}>
          {profile.nome ? profile.nome.charAt(0).toUpperCase() : 'U'}
        </div>
      </header>

      {/* SIDEBAR OVERLAY (MOBILE) */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-xs transition-opacity" 
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0
        ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-md shrink-0"
              style={{ backgroundColor: corPrimaria }}>
              {salao?.nome ? salao.nome.charAt(0).toUpperCase() : 'O'}
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold text-gray-900 text-sm truncate">{salao?.nome || 'Organiza Salão'}</h2>
              <p className="text-[11px] text-gray-400 capitalize">{eDono ? 'Administrador' : 'Funcionário'}</p>
            </div>
          </div>
          
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {menuFiltrado.map(item => {
            const Icon = item.icon
            const ativo = pathname === item.href

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                  ativo 
                    ? 'text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                style={ativo ? { backgroundColor: corPrimaria } : {}}
              >
                <Icon size={18} className={ativo ? 'text-white' : 'text-gray-400'} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
              style={{ backgroundColor: corPrimaria }}>
              {profile.nome ? profile.nome.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="font-bold text-gray-900 text-xs truncate">{profile.nome}</p>
              <p className="text-[10px] text-gray-400 truncate">{profile.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-100 bg-red-50/50 text-red-600 text-xs font-bold hover:bg-red-100/60 transition-all">
            <LogOut size={16} /> Sair da conta
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
