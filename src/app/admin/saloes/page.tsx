'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, PauseCircle, PlayCircle, Search, CheckCircle } from 'lucide-react'

function SaloesContent() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [saloes, setSaloes] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState(searchParams.get('filtro') || 'todos')
  const [modalPausa, setModalPausa] = useState<any>(null)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (profile.role !== 'admin_geral') { router.replace('/login'); return }
    carregarSaloes()
  }, [loading, profile])

  async function carregarSaloes() {
    const { data } = await supabase.from('saloes')
      .select('*, profiles!saloes_dono_id_fkey(nome, email)')
      .order('created_at', { ascending: false })
    if (data) setSaloes(data.map((s: any) => ({
      ...s,
      profiles: Array.isArray(s.profiles) ? s.profiles[0] ?? null : s.profiles ?? null
    })))
  }

  async function aprovar(salao: any) {
    setSalvando(true)
    await supabase.from('saloes').update({ aprovado: true, ativo: true }).eq('id', salao.id)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile?.id, destinatario_id: salao.dono_id,
      titulo: 'Salão aprovado!',
      mensagem: 'Seu salão foi aprovado! Você já pode acessar todas as funcionalidades.',
      tipo: 'admin'
    })
    setSalvando(false); carregarSaloes()
  }

  async function pausar(salao: any) {
    if (!motivo) return
    setSalvando(true)
    await supabase.from('saloes').update({ pausado: true, motivo_pausa: motivo }).eq('id', salao.id)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile?.id, destinatario_id: salao.dono_id,
      titulo: 'Salão pausado',
      mensagem: 'Seu salão foi pausado. Motivo: ' + motivo,
      tipo: 'admin'
    })
    setModalPausa(null); setMotivo(''); setSalvando(false); carregarSaloes()
  }

  async function reativar(salao: any) {
    await supabase.from('saloes').update({ pausado: false, motivo_pausa: null }).eq('id', salao.id)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile?.id, destinatario_id: salao.dono_id,
      titulo: 'Salão reativado',
      mensagem: 'Seu salão foi reativado! Você já pode acessar normalmente.',
      tipo: 'admin'
    })
    carregarSaloes()
  }

  const filtrados = saloes.filter(s => {
    const matchBusca = s.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      s.cidade?.toLowerCase().includes(busca.toLowerCase())
    const matchFiltro =
      filtro === 'todos' ? true :
      filtro === 'ativos' ? (!s.pausado && s.aprovado) :
      filtro === 'pausados' ? s.pausado :
      !s.aprovado
    return matchBusca && matchFiltro
  })

  const cont = {
    todos: saloes.length,
    ativos: saloes.filter(s => !s.pausado && s.aprovado).length,
    pausados: saloes.filter(s => s.pausado).length,
    pendentes: saloes.filter(s => !s.aprovado).length
  }

  if (loading || !profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 px-4 py-5 flex items-center gap-3">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-white" />
        </button>
        <h1 className="font-bold text-white text-lg flex-1">Gerenciar Salões</h1>
        {cont.pendentes > 0 && (
          <span className="bg-yellow-400 text-gray-900 text-xs px-2 py-1 rounded-full font-bold">
            {cont.pendentes} pendentes
          </span>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-11" placeholder="Buscar salão ou cidade..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['todos', 'pendentes', 'ativos', 'pausados'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ' +
                (filtro === f ? 'bg-gray-900
