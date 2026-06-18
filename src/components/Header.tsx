'use client'
import {
  Bell, LogOut, Menu, X,
  Home, Calendar, Users, BarChart2, Settings,
  Scissors, Package, FileText, UserCheck, Box,
  Sparkles, CreditCard, Camera, DollarSign, Clock
} from 'lucide-react'
import { useNotificacoes } from '@/lib/hooks/useNotificacoes'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { Profile } from '@/lib/supabase'

interface Props {
  profile: Profile
  salaoNome?: string
  corPrimaria?: string
  corSecundaria?: string
}

const MENU_DONO = [
  { icon: Home, label: 'Inicio', href: '/salao', grupo: '' },
  { icon: Calendar, label: 'Agenda', href: '/salao/agenda', grupo: 'Atendimento' },
  { icon: Users, label: 'Clientes', href: '/salao/clientes', grupo: 'Atendimento' },
  { icon: Scissors, label: 'Catalogo de Servicos', href: '/salao/servicos', grupo: 'Atendimento' },
  { icon: Camera, label: 'Fotos dos Servicos', href: '/salao/servicos/fotos', grupo: 'Atendimento' },
  { icon: Package, label: 'Pacotes', href: '/salao/pacotes', grupo: 'Atendimento' },
  { icon: CreditCard, label: 'Pacotes por Cliente', href: '/salao/pacotes/clientes', grupo: 'Atendimento' },
  { icon: FileText, label: 'Fichas de Anamnese', href: '/salao/anamnese', grupo: 'Atendimento' },
  { icon: UserCheck, label: 'Funcionarios', href: '/salao/funcionarios', grupo: 'Equipe' },
  { icon: Box, label: 'Estoque', href: '/salao/estoque', grupo: 'Gestao' },
  { icon: BarChart2, label: 'Financeiro', href: '/salao/financeiro', grupo: 'Gestao' },
  { icon: DollarSign, label: 'Relatorios', href: '/salao/financeiro/relatorios', grupo: 'Gestao' },
  { icon: Clock, label: 'Caixa do Dia', href: '/salao/financeiro/caixa', grupo: 'Gestao' },
  { icon: Bell, label: 'Notificacoes', href: '/salao/notificacoes', grupo: 'Outros' },
  { icon: Sparkles, label: 'Sugestoes IA', href: '/salao/ia', grupo: 'Outros' },
  { icon: Settings, label: 'Configuracoes', href: '/salao/configuracoes', grupo: 'Outros' },
  { icon: Package2, label: 'Combos Promocionais', href: '/salao/combos', grupo: 'Atendimento' },
{ icon: DollarSign, label: 'Contas de Clientes', href: '/salao/contas', grupo: 'Gestao' },
]

const MENU_ADMIN = [
  { icon: Home, label: 'Inicio', href: '/admin', grupo: '' },
  { icon: Users, label: 'Gerenciar Saloes', href: '/admin/saloes', grupo: 'Gestao' },
  { icon: UserCheck, label: 'Gerenciar Usuarios', href: '/admin/usuarios', grupo: 'Gestao' },
  { icon: Bell, label: 'Notificacoes', href: '/admin/notificacoes', grupo: 'Gestao' },
]

export default function Header({ profile, salaoNome, corPrimaria = '#E91E8C', corSecundaria = '#FCE4F3' }: Props) {
  const { naoLidas, notificacoes, marcarComoLida, marcarTodasComoLidas } = useNotificacoes(profile.id)
  const [menuAberto, setMenuAberto] = useState(false)
  const [notifAberta, setNotifAberta] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const menuItems = profile.role === 'admin_geral' ? MENU_ADMIN : MENU_DONO

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

const grupos = Array.from(new Set(menuItems.map(i => i.grupo)))

  return (
    <>
      <div className="bg-white px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <button onClick={() => setMenuAberto(true)} className="p-1">
          <Menu size={22} className="text-gray-700" />
        </button>
        <div className="flex flex-col items-center">
          <span className="font-bold text-gray-900 text-sm">{salaoNome || 'Organiza'}</span>
          <span className="text-xs text-gray-400">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNotifAberta(!notifAberta)}
            className="relative w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <Bell size={18} className="text-gray-600" />
            {naoLidas > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                style={{ backgroundColor: corPrimaria }}>{naoLidas}</span>
            )}
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: corPrimaria }}>
            {profile.nome?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Painel notificacoes */}
      {notifAberta && (
        <div className="fixed inset-0 z-50" onClick={() => setNotifAberta(false)}>
          <div className="absolute top-14 right-2 w-80 bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-bold text-gray-900">Notificacoes</span>
              {naoLidas > 0 && (
                <button onClick={marcarTodasComoLidas} className="text-xs font-medium" style={{ color: corPrimaria }}>
                  Marcar todas lidas
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notificacoes.length === 0
                ? <p className="text-center text-gray-400 py-8 text-sm">Nenhuma notificacao</p>
                : notificacoes.map(n => (
                  <div key={n.id} onClick={() => marcarComoLida(n.id)}
                    className={'px-4 py-3 border-b cursor-pointer ' + (!n.lida ? 'bg-pink-50' : 'hover:bg-gray-50')}>
                    <p className="font-medium text-gray-900 text-sm">{n.titulo}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{n.mensagem}</p>
                    <p className="text-gray-400 text-xs mt-1">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Menu lateral */}
      {menuAberto && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuAberto(false)} />
          <div className="relative w-72 bg-white h-full flex flex-col shadow-xl">
            {/* Header do menu */}
            <div className="p-5" style={{ backgroundColor: corPrimaria }}>
              <button onClick={() => setMenuAberto(false)} className="absolute top-4 right-4 text-white/70">
                <X size={20} />
              </button>
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-2xl mb-3">
                {profile.nome?.charAt(0).toUpperCase()}
              </div>
              <p className="text-white font-bold text-base">{profile.nome}</p>
              <p className="text-white/70 text-xs mt-0.5">{profile.email}</p>
              {salaoNome && <p className="text-white/80 text-xs mt-1">📍 {salaoNome}</p>}
            </div>

            {/* Itens agrupados */}
            <div className="flex-1 overflow-y-auto py-2">
              {grupos.map(grupo => (
                <div key={grupo}>
                  {grupo !== '' && (
                    <p className="px-5 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{grupo}</p>
                  )}
                  {menuItems.filter(i => i.grupo === grupo).map(({ icon: Icon, label, href }) => {
                    const ativo = pathname === href || pathname.startsWith(href + '/')
                    return (
                      <button key={href}
                        onClick={() => { setMenuAberto(false); router.push(href) }}
                        className={'w-full flex items-center gap-3 px-5 py-3 text-left transition-all ' +
                          (ativo ? 'font-semibold' : 'text-gray-600 hover:bg-gray-50')}
                        style={ativo ? { backgroundColor: corSecundaria, color: corPrimaria } : {}}>
                        <Icon size={18} />
                        <span className="text-sm">{label}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Logout */}
            <button onClick={logout}
              className="flex items-center gap-3 px-5 py-4 text-gray-400 border-t hover:bg-gray-50">
              <LogOut size={18} />
              <span className="text-sm">Sair da conta</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
