'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Search, Plus, Copy, Check, ChevronRight, Sparkles } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { Home, Calendar, Scissors, Users, BarChart2 } from 'lucide-react'

export default function ClientesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: cli } = await supabase.from('clientes').select('*, cliente_pacotes(status)').eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(cli || [])
    setCarregando(false)
  }

  function copiarLink() {
    const link = `${window.location.origin}/cadastro?salao=${salao?.slug}`
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

  // agrupa por letra inicial
  const grupos: Record<string, any[]> = {}
  clientesFiltrados.forEach(c => {
    const letra = c.nome.charAt(0).toUpperCase()
    if (!grupos[letra]) grupos[letra] = []
    grupos[letra].push(c)
  })
  const letras = Object.keys(grupos).sort()

  const navItems = [
    { icon: Home, label: 'Início', href: '/salao' },
    { icon: Calendar, label: 'Agenda', href: '/salao/agenda' },
    { icon: Scissors, label: 'Serviços', href: '/salao/servicos' },
    { icon: Users, label: 'Clientes', href: '/salao/clientes' },
    { icon: BarChart2, label: 'Finanças', href: '/salao/financeiro' },
  ]

  const novosEsteMes = clientes.filter(c => {
    const criado = new Date(c.created_at)
    const agora = new Date()
    return criado.getMonth() === agora.getMonth() && criado.getFullYear() === agora.getFullYear()
  }).length

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#f4f4f8' }}>

      {/* Header com gradiente */}
      <div className="relative px-5 pt-12 pb-16 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)` }}>
        {/* Círculos decorativos */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-12 -left-6 w-32 h-32 rounded-full opacity-10 bg-white" />

        <div className="relative flex items-center justify-between mb-6">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-widest">Gestão</p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Clientes</h1>
          </div>
          <button onClick={() => router.push('/salao/clientes/novo')}
            className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
            <Plus size={20} className="text-white" />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <div className="flex-1 bg-white/15 backdrop-blur rounded-2xl px-4 py-3 border border-white/20">
            <p className="text-white/70 text-xs">Total</p>
            <p className="text-white text-2xl font-bold">{clientes.length}</p>
          </div>
          <div className="flex-1 bg-white/15 backdrop-blur rounded-2xl px-4 py-3 border border-white/20">
            <p className="text-white/70 text-xs">Esse mês</p>
            <p className="text-white text-2xl font-bold">+{novosEsteMes}</p>
          </div>
          <button onClick={copiarLink}
            className="flex-1 bg-white/15 backdrop-blur rounded-2xl px-3 py-3 border border-white/20 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all">
            {copiado
              ? <><Check size={18} className="text-white" /><p className="text-white text-xs font-medium">Copiado!</p></>
              : <><Copy size={18} className="text-white" /><p className="text-white text-xs font-medium">Convite</p></>}
          </button>
        </div>
      </div>

      {/* Search flutuante */}
      <div className="px-4 -mt-6 relative z-10 mb-4">
        <div className="bg-white rounded-2xl shadow-lg flex items-center gap-3 px-4 py-3.5 border border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            placeholder="Buscar por nome, telefone ou email..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button onClick={() => setBusca('')} className="text-gray-400 text-xs">✕</button>
          )}
        </div>
      </div>

      <div className="px-4 flex flex-col gap-1">
        {clientesFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center flex flex-col items-center gap-3 shadow-sm">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${cor}15` }}>
              <Sparkles size={28} style={{ color: cor }} />
            </div>
            <p className="text-gray-700 font-semibold">Nenhuma cliente encontrada</p>
            <p className="text-gray-400 text-sm">Compartilhe o link de convite para suas clientes se cadastrarem</p>
            <button onClick={copiarLink}
              className="mt-1 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: cor }}>
              {copiado ? '✓ Copiado!' : 'Copiar link'}
            </button>
          </div>
        ) : (
          letras.map(letra => (
            <div key={letra}>
              {/* Separador de letra */}
              <div className="flex items-center gap-2 py-2 px-1">
                <span className="text-xs font-bold tracking-wider" style={{ color: cor }}>{letra}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="flex flex-col gap-2">
                {grupos[letra].map(c => {
                  const pacotesAtivos = c.cliente_pacotes?.filter((p: any) => p.status === 'ativo').length || 0
                  return (
                    <button key={c.id}
                      onClick={() => router.push(`/salao/clientes/${c.id}`)}
                      className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-all shadow-sm border border-gray-50 text-left w-full">

                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                          style={{ background: `linear-gradient(135deg, ${cor}, ${cor}99)` }}>
                          {c.nome.charAt(0).toUpperCase()}
                        </div>
                        {pacotesAtivos > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-white flex items-center justify-center">
                            <span className="text-white text-[9px] font-bold">{pacotesAtivos}</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{c.nome}</p>
                        <p className="text-gray-400 text-xs truncate mt-0.5">
                          {c.telefone || c.email || 'Sem contato'}
                        </p>
                        {pacotesAtivos > 0 && (
                          <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                            {pacotesAtivos} pacote{pacotesAtivos > 1 ? 's' : ''} ativo{pacotesAtivos > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <ChevronRight size={16} className="text-gray-300 shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav items={navItems} corPrimaria={cor} />
    </div>
  )
}