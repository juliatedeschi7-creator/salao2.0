'use client'
import {
  Bell, LogOut, Menu, X,
  Home, Calendar, Users, BarChart2, Settings,
  Scissors, Package, FileText, UserCheck, Box,
  Sparkles, CreditCard, DollarSign, Clock, Heart,
  CheckSquare, Notebook
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
  { icon: Home, label: 'Início', href: '/salao', grupo: '' },
  { icon: Calendar, label: 'Agenda', href: '/salao/agenda', grupo: 'Atendimento' },
  { icon: Users, label: 'Clientes', href: '/salao/clientes', grupo: 'Atendimento' },
  { icon: Notebook, label: 'Guia', href: '/salao/guia', grupo: 'Atendimento' },
  { icon: Scissors, label: 'Catálogo de Serviços', href: '/salao/servicos', grupo: 'Atendimento' },
  { icon: Package, label: 'Pacotes', href: '/salao/pacotes', grupo: 'Atendimento' },
  { icon: CreditCard, label: 'Pacotes por Cliente', href: '/salao/pacotes/clientes', grupo: 'Atendimento' },
  { icon: FileText, label: 'Fichas de Anamnese', href: '/salao/anamnese', grupo: 'Atendimento' },
  { icon: Package, label: 'Combos Promocionais', href: '/salao/combos', grupo: 'Atendimento' },
  { icon: FileText, label: 'Contratos', href: '/salao/contratos', grupo: 'Atendimento' },
  { icon: Clock, label: 'Horários vagos', href: '/salao/horarios-vagos', grupo: 'Atendimento' },
  { icon: CheckSquare, label: 'Lembretes', href: '/salao/lembretes', grupo: 'Atendimento' },
  { icon: UserCheck, label: 'Funcionários', href: '/salao/funcionarios', grupo: 'Equipe' },
  { icon: Box, label: 'Estoque', href: '/salao/estoque', grupo: 'Gestão' },
  { icon: BarChart2, label: 'Financeiro', href: '/salao/financeiro', grupo: 'Gestão' },
  { icon: DollarSign, label: 'Relatórios', href: '/salao/relatorios', grupo: 'Gestão' },
  { icon: Clock, label: 'Caixa do Dia', href: '/salao/caixa', grupo: 'Gestão' },
  { icon: DollarSign, label: 'Contas de Clientes', href: '/salao/contas', grupo: 'Gestão' },
  { icon: Bell, label: 'Notificações', href: '/salao/notificacoes', grupo: 'Outros' },
  { icon: Sparkles, label: 'Sugestões IA', href: '/salao/ia', grupo: 'Outros' },
  { icon: Heart, label: 'Quem Somos', href: '/salao/quem-somos', grupo: 'Outros' },
  { icon: Settings, label: 'Configurações', href: '/salao/configuracoes', grupo: 'Outros' },
  { icon: Clock, label: 'Horários', href: '/salao/horarios', grupo: 'Outros' },
]

const MENU_FUNCIONARIO = [
  { icon: Home, label: 'Início', href: '/funcionario', grupo: '' },
  { icon: Calendar, label: 'Minha Agenda', href: '/funcionario/agenda', grupo: 'Atendimento' },
  { icon: Users, label: 'Clientes', href: '/salao/clientes', grupo: 'Atendimento' },
  { icon: Notebook, label: 'Guia', href: '/salao/guia', grupo: 'Atendimento' },
  { icon: CheckSquare, label: 'Lembretes', href: '/salao/lembretes', grupo: 'Atendimento' },
  { icon: Bell, label: 'Notificações', href: '/salao/notificacoes', grupo: 'Outros' },
]

const MENU_ADMIN = [
  { icon: Home, label: 'Início', href: '/admin', grupo: '' },
  { icon: Users, label: 'Gerenciar Salões', href: '/admin/saloes', grupo: 'Gestão' },
  { icon: UserCheck, label: 'Gerenciar Usuários', href: '/admin/usuarios', grupo: 'Gestão' },
  { icon: Bell, label: 'Notificações', href: '/admin/notificacoes', grupo: 'Gestão' },
]

export default function Header({ profile, salaoNome, corPrimaria = '#E91E8C', corSecundaria = '#FCE4F3' }: Props) {
  const { naoLidas, notificacoes, marcarComoLida, marcarTodasComoLidas } = useNotificacoes(profile.id)
  const [menuAberto, setMenuAberto] = useState(false)
  const [notifAberta, setNotifAberta] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const userRole = profile?.role as string

  const menuItems = userRole === 'admin_geral'
    ? MENU_ADMIN
    : (userRole === 'funcionario' || userRole === 'profissional')
    ? MENU_FUNCIONARIO
    : MENU_DONO

  const grupos = Array.from(new Set(menuItems.map(i => i.grupo)))

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function handleClicarNotificacao(n: any) {
    if (!n.lida) {
      marcarComoLida(n.id)
    }

    setNotifAberta(false)

    let destino = n.url

    if (!destino) {
      const titulo = (n.titulo || '').toLowerCase()
      const tipo = (n.tipo || '').toLowerCase()
      const clienteId = n.cliente_id || n.dados_extras?.cliente_id

      if (tipo === 'duplicado' || titulo.includes('duplicado')) {
        destino = clienteId ? `/salao/clientes?mesclar=${clienteId}` : '/salao/clientes'
      } else if (tipo === 'agendamento' || titulo.includes('agendamento')) {
        destino = '/salao/agenda'
      } else if (tipo === 'pacote' || titulo.includes('pacote')) {
        destino = '/salao/pacotes'
      } else {
        destino = '/salao'
      }
    }

    if (destino) {
      router.push(destino)
    }
  }

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

      {notifAberta && (
        <div className="fixed inset-0 z-50" onClick={() => setNotifAberta(false)}>
          <div className="absolute top-14 right-2 w-80 bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-bold text-gray-900">Notificações</span>
              {naoLidas > 0 && (
                <button onClick={marcarTodasComoLidas} className="text-xs font-medium" style={{ color: corPrimaria }}>
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notificacoes.length === 0
                ? <p className="text-center text-gray-400 py-8 text-sm">Nenhuma notificação</p>
                : notificacoes.map(n => (
                  <div key={n.id} onClick={() => handleClicarNotificacao(n)}
                    className={'px-4 py-3 border-b cursor-pointer transition-colors ' + (!n.lida ? 'bg-pink-50' : 'hover:bg-gray-50')}>
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

      {menuAberto && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuAberto(false)} />
          <div className="relative w-72 bg-white h-full flex flex-col shadow-xl">
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
