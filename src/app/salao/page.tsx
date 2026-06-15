'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Home, Calendar, Users, BarChart2, Settings, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function SalaoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role !== 'dono_salao' && profile.role !== 'funcionario') { router.push('/login'); return }
      if (!profile.salao_id) { router.push('/criar-salao'); return }
      carregarDados()
    }
  }, [profile, loading])

  async function carregarDados() {
    if (!profile?.salao_id) return
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile.salao_id).single()
    if (sal?.pausado) { await supabase.auth.signOut(); router.push('/login'); return }
    setSalao(sal)
    const hoje = new Date()
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString()
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(nome), servicos(nome), profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('salao_id', profile.salao_id).gte('data_hora', inicio).lte('data_hora', fim).order('data_hora')
    setAgendamentos(ags || [])
    setCarregando(false)
  }

  const navItems = [
    { icon: Home, label: 'Inicio', href: '/salao' },
    { icon: Calendar, label: 'Agenda', href: '/salao/agenda' },
    { icon: Users, label: 'Clientes', href: '/salao/clientes' },
    { icon: BarChart2, label: 'Financas', href: '/salao/financeiro' },
    { icon: Settings, label: 'Ajustes', href: '/salao/configuracoes' },
  ]

  const statusConfig: Record<string, { cor: string; label: string; icon: any }> = {
    confirmado: { cor: 'text-green-600 bg-green-50', label: 'Confirmado', icon: CheckCircle },
    pendente: { cor: 'text-yellow-600 bg-yellow-50', label: 'Pendente', icon: AlertCircle },
    concluido: { cor: 'text-gray-500 bg-gray-50', label: 'Concluido', icon: CheckCircle },
    cancelado: { cor: 'text-red-500 bg-red-50', label: 'Cancelado', icon: AlertCircle },
    aguardando_confirmacao: { cor: 'text-blue-600 bg-blue-50', label: 'Aguardando', icon: Clock },
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) return
