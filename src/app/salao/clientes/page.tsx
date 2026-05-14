'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Plus, User, Copy, Check } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { Home, Calendar, Users, BarChart2, Settings } from 'lucide-react'

export default function ClientesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*')
      .eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: cli } = await supabase.from('clientes').select('*')
      .eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(cli || [])
  }

  function copiarLink() {
    const link = `https://salao-flame.vercel.app/cadastro?salao=${salao?.slug}`
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())
  )

  const navItems = [
    { icon: Home, label: 'Início', href: '/salao' },
    { icon: Calendar, label: 'Agenda', href: '/salao/agenda' },
    { icon: Users, label: 'Clientes', href: '/salao/clientes' },
    { icon: BarChart2, label: 'Finanças', href: '/salao/financeiro' },
    { icon: Settings, label: 'Ajustes', href: '/salao/configuracoes' },
  ]

  return (
    <div className="min-h-screen bg-[#f8f4f6] pb-20">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Clientes</h1>
        <button onClick={() => router.push('/salao/clientes/novo')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Link de convite */}
        <div className="card flex flex-col gap-2" style={{ backgroundColor: salao?.cor_secundaria || '#FCE4F3' }}>
          <p className="text-sm font-semibold" style={{ color: cor }}>
            🔗 Link de convite para clientes
          </p>
          <p className="text-xs text-gray-500">
            Compartilhe este link para suas clientes se cadastrarem
          </p>
          <button onClick={copiarLink}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: cor }}>
            {copiado ? <><Check size={16} />Link copiado!</> : <><Copy size={16} />Copiar link de convite</>}
          </button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-11" placeholder="Buscar cliente..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <p className="text-xs text-gray-400 font-medium">
          {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}
        </p>

        {/* Lista */}
        {clientesFiltrados.length === 0 ? (
          <div className="card text-center py-10">
            <User size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhuma cliente encontrada</p>
          </div>
        ) : (
          clientesFiltrados.map(c => (
            <button key={c.id}
              onClick={() => router.push(`/salao/clientes/${c.id}`)}
              className="card flex items-center gap-3 text-left active:scale-95 transition-all">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                style={{ backgroundColor: cor }}>
                {c.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{c.nome}</p>
                <p className="text-sm text-gray-400">{c.telefone || c.email || 'Sem contato'}</p>
              </div>
              <div className="text-gray-300">›</div>
            </button>
          ))
        )}
      </div>

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}
