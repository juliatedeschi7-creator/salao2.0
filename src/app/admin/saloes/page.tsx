'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, PauseCircle, PlayCircle, Search, Plus, ChevronRight } from 'lucide-react'

interface Salao {
  id: string
  nome: string
  cidade: string
  dono_id: string
  ativo: boolean
  pausado: boolean
  motivo_pausa: string
  created_at: string
  profiles: { nome: string; email: string }
}

export default function AdminSaloesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [saloes, setSaloes] = useState<Salao[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'pausados'>('todos')
  const [modalPausa, setModalPausa] = useState<Salao | null>(null)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.role !== 'admin_geral') router.push('/login')
    else if (!loading) carregarSaloes()
  }, [loading])

  async function carregarSaloes() {
    const { data } = await supabase
      .from('saloes')
      .select('*, profiles!saloes_dono_id_fkey(nome, email)')
      .order('created_at', { ascending: false })
    setSaloes(data || [])
  }

  async function pausarSalao(salao: Salao) {
    setSalvando(true)
    await supabase.from('saloes').update({
      pausado: true, motivo_pausa: motivo
    }).eq('id', salao.id)

    await supabase.from('notificacoes').insert({
      salao_id: salao.id,
      remetente_id: profile?.id,
      destinatario_id: salao.dono_id,
      titulo: 'Salão pausado',
      mensagem: `Seu salão foi pausado pelo administrador. Motivo: ${motivo}`,
      tipo: 'admin'
    })

    setModalPausa(null)
    setMotivo('')
    setSalvando(false)
    carregarSaloes()
  }

  async function reativarSalao(salao: Salao) {
    await supabase.from('saloes').update({
      pausado: false, motivo_pausa: null
    }).eq('id', salao.id)

    await supabase.from('notificacoes').insert({
      salao_id: salao.id,
      remetente_id: profile?.id,
      destinatario_id: salao.dono_id,
      titulo: 'Salão reativado',
      mensagem: 'Seu salão foi reativado pelo administrador. Você já pode acessar normalmente.',
      tipo: 'admin'
    })

    carregarSaloes()
  }

  const saloesFiltrados = saloes.filter(s => {
    const matchBusca = s.nome.toLowerCase().includes(busca.toLowerCase()) ||
      s.cidade?.toLowerCase().includes(busca.toLowerCase())
    const matchFiltro = filtro === 'todos' ? true :
      filtro === 'ativos' ? (!s.pausado && s.ativo) : s.pausado
    return matchBusca && matchFiltro
  })

  return (
    <div className="min-h-screen bg-[#f8f4f6]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Gerenciar Salões</h1>
        <button onClick={() => router.push('/admin/saloes/novo')}
          className="w-9 h-9 rounded-full bg-[#E91E8C] flex items-center justify-center">
          <Plus size={18} className="text-white" />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Busca */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-11" placeholder="Buscar salão ou cidade..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          {(['todos', 'ativos', 'pausados'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filtro === f ? 'bg-[#E91E8C] text-white' : 'bg-white text-gray-500'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Lista */}
        {saloesFiltrados.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-gray-400">Nenhum salão encontrado</p>
          </div>
        ) : (
          saloesFiltrados.map(salao => (
            <div key={salao.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{salao.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${salao.pausado ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {salao.pausado ? 'Pausado' : 'Ativo'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{salao.cidade}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Dono: {salao.profiles?.nome} • {salao.profiles?.email}
                  </p>
                  {salao.pausado && salao.motivo_pausa && (
                    <p className="text-xs text-yellow-600 mt-1">Motivo: {salao.motivo_pausa}</p>
                  )}
                </div>
                <button onClick={() => router.push(`/admin/saloes/${salao.id}`)}>
                  <ChevronRight size={18} className="text-gray-300" />
                </button>
              </div>

              <div className="flex gap-2">
                {salao.pausado ? (
                  <button onClick={() => reativarSalao(salao)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-600 font-medium text-sm">
                    <PlayCircle size={16} />Reativar
                  </button>
                ) : (
                  <button onClick={() => setModalPausa(salao)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-50 text-yellow-600 font-medium text-sm">
                    <PauseCircle size={16} />Pausar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal pausa */}
      {modalPausa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Pausar salão</h3>
            <p className="text-gray-500 text-sm">
              O dono <strong>{modalPausa.profiles?.nome}</strong> não conseguirá acessar o sistema enquanto pausado.
            </p>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Motivo da pausa</label>
              <textarea className="input-field resize-none" rows={3}
                placeholder="Ex: Pagamento em atraso..."
                value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModalPausa(null); setMotivo('') }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={() => pausarSalao(modalPausa)} disabled={!motivo || salvando}
                className="flex-1 py-3 rounded-2xl bg-yellow-500 text-white font-medium disabled:opacity-50">
                {salvando ? 'Pausando...' : 'Confirmar Pausa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
