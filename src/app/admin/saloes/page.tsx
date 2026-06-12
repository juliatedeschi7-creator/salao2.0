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
    if (data) {
      setSaloes(data.map((s: any) => ({
        ...s,
        profiles: Array.isArray(s.profiles) ? s.profiles[0] ?? null : s.profiles ?? null
      })))
    }
  }

  async function aprovar(salao: any) {
    setSalvando(true)
    await supabase.from('saloes').update({ aprovado: true, ativo: true }).eq('id', salao.id)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile?.id, destinatario_id: salao.dono_id,
      titulo: 'Salao aprovado!',
      mensagem: 'Seu salao foi aprovado!',
      tipo: 'admin'
    })
    setSalvando(false)
    carregarSaloes()
  }
  async function pausar(salao: any) {
    if (!motivo) return
    setSalvando(true)
    await supabase.from('saloes').update({ pausado: true, motivo_pausa: motivo }).eq('id', salao.id)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile?.id, destinatario_id: salao.dono_id,
      titulo: 'Salao pausado', mensagem: 'Motivo: ' + motivo, tipo: 'admin'
    })
    setModalPausa(null); setMotivo(''); setSalvando(false); carregarSaloes()
  }

  async function reativar(salao: any) {
    await supabase.from('saloes').update({ pausado: false, motivo_pausa: null }).eq('id', salao.id)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile?.id, destinatario_id: salao.dono_id,
      titulo: 'Salao reativado', mensagem: 'Seu salao foi reativado!', tipo: 'admin'
    })
    carregarSaloes()
  }

  const cont = {
    todos: saloes.length,
    ativos: saloes.filter(s => !s.pausado && s.aprovado).length,
    pausados: saloes.filter(s => s.pausado).length,
    pendentes: saloes.filter(s => !s.aprovado).length
  }

  const filtrados = saloes.filter(s => {
    const matchBusca = s.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      s.cidade?.toLowerCase().includes(busca.toLowerCase())
    const matchFiltro =
      filtro === 'todos' ? true :
      filtro === 'ativos' ? (!s.pausado && s.aprovado) :
      filtro === 'pausados' ? s.pausado : !s.aprovado
    return matchBusca && matchFiltro
  })

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 px-4 py-5 flex items-center gap-3">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-white" />
        </button>
        <h1 className="font-bold text-white text-lg flex-1">Gerenciar Saloes</h1>
        {cont.pendentes > 0 && (
          <span className="bg-yellow-400 text-gray-900 text-xs px-2 py-1 rounded-full font-bold">
            {cont.pendentes} pendentes
          </span>
        )}
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-11" placeholder="Buscar salao ou cidade..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['todos', 'pendentes', 'ativos', 'pausados'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ' +
                (filtro === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-500')}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({cont[f]})
            </button>
          ))}
        </div>
        {filtrados.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-gray-400">Nenhum salao encontrado</p>
          </div>
        ) : filtrados.map(salao => (
          <div key={salao.id} className="card flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900">{salao.nome}</p>
                <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                  (!salao.aprovado ? 'bg-blue-100 text-blue-700' :
                  salao.pausado ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700')}>
                  {!salao.aprovado ? 'Pendente' : salao.pausado ? 'Pausado' : 'Ativo'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{salao.cidade}</p>
              <p className="text-xs text-gray-400">Dono: {salao.profiles?.nome} - {salao.profiles?.email}</p>
              {salao.pausado && salao.motivo_pausa && (
                <p className="text-xs text-yellow-600 mt-1">Motivo: {salao.motivo_pausa}</p>
              )}
            </div>
            <div className="flex gap-2">
              {!salao.aprovado && (
                <button onClick={() => aprovar(salao)} disabled={salvando}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-600 font-medium text-sm">
                  <CheckCircle size={16} />Aprovar
                </button>
              )}
              {salao.aprovado && !salao.pausado && (
                <button onClick={() => setModalPausa(salao)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-50 text-yellow-600 font-medium text-sm">
                  <PauseCircle size={16} />Pausar
                </button>
              )}
              {salao.pausado && (
                <button onClick={() => reativar(salao)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-600 font-medium text-sm">
                  <PlayCircle size={16} />Reativar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {modalPausa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Pausar salao</h3>
            <textarea className="input-field resize-none" rows={3} placeholder="Motivo..."
              value={motivo} onChange={e => setMotivo(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => { setModalPausa(null); setMotivo('') }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={() => pausar(modalPausa)} disabled={!motivo || salvando}
                className="flex-1 py-3 rounded-2xl bg-yellow-500 text-white font-medium disabled:opacity-50">
                {salvando ? 'Pausando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminSaloesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SaloesContent />
    </Suspense>
  )
}
