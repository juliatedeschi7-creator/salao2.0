'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Bell } from 'lucide-react'

export default function AdminNotificacoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [saloes, setSaloes] = useState<any[]>([])
  const [enviadas, setEnviadas] = useState<any[]>([])
  const [destinatario, setDestinatario] = useState('todos')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [aba, setAba] = useState<'enviar' | 'historico'>('enviar')

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (profile.role !== 'admin_geral') { router.replace('/login'); return }
    carregarSaloes(); carregarEnviadas()
  }, [loading, profile])

  async function carregarSaloes() {
    const { data } = await supabase
      .from('saloes')
      .select('id, nome, dono_id, profiles!saloes_dono_id_fkey(nome)')
      .eq('pausado', false)
      .eq('ativo', true)
      .order('nome')
    if (data) {
      setSaloes(data.map((s: any) => ({
        ...s,
        profiles: Array.isArray(s.profiles) ? s.profiles[0] ?? null : s.profiles ?? null
      })))
    }
  }

  async function carregarEnviadas() {
    const { data } = await supabase
      .from('notificacoes')
      .select('id, titulo, mensagem, created_at, profiles!notificacoes_destinatario_id_fkey(nome)')
      .eq('remetente_id', profile?.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) {
      setEnviadas(data.map((n: any) => ({
        ...n,
        profiles: Array.isArray(n.profiles) ? n.profiles[0] ?? null : n.profiles ?? null
      })))
    }
  }

  async function enviar() {
    if (!titulo || !mensagem) return
    setEnviando(true)
    if (destinatario === 'todos') {
      const inserts = saloes.map(s => ({
        salao_id: s.id, remetente_id: profile?.id,
        destinatario_id: s.dono_id, titulo, mensagem, tipo: 'admin'
      }))
      await supabase.from('notificacoes').insert(inserts)
    } else {
      const salao = saloes.find(s => s.id === destinatario)
      if (salao) {
        await supabase.from('notificacoes').insert({
          salao_id: salao.id, remetente_id: profile?.id,
          destinatario_id: salao.dono_id, titulo, mensagem, tipo: 'admin'
        })
      }
    }
    setTitulo(''); setMensagem(''); setDestinatario('todos')
    setEnviando(false); setSucesso(true)
    carregarEnviadas()
    setTimeout(() => setSucesso(false), 3000)
  }

  if (loading || !profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 px-4 py-5 flex items-center gap-3">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Notificacoes</h1>
      </div>

      <div className="flex bg-white border-b border-gray-100">
        {(['enviar', 'historico'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={'flex-1 py-3 text-sm font-medium ' + (aba === a ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400')}>
            {a === 'enviar' ? 'Enviar' : 'Historico'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {aba === 'enviar' ? (
          <>
            {sucesso && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-green-600 text-sm text-center">Notificacao enviada!</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Destinatario</label>
              <select className="input-field" value={destinatario} onChange={e => setDestinatario(e.target.value)}>
                <option value="todos">Todos os saloes ({saloes.length})</option>
                {saloes.map(s => (
                  <option key={s.id} value={s.id}>{s.nome} - {s.profiles?.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Titulo</label>
              <input className="input-field" placeholder="Titulo da notificacao"
                value={titulo} onChange={e => setTitulo(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Mensagem</label>
              <textarea className="input-field resize-none" rows={5}
                placeholder="Digite sua mensagem..."
                value={mensagem} onChange={e => setMensagem(e.target.value)} />
            </div>
            <button onClick={enviar} disabled={!titulo || !mensagem || enviando}
              className="btn-primary disabled:opacity-50">
              {enviando
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Send size={18} />Enviar</>}
            </button>
          </>
        ) : (
          enviadas.length === 0 ? (
            <div className="card text-center py-10">
              <Bell size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhuma notificacao enviada</p>
            </div>
          ) : enviadas.map(n => (
            <div key={n.id} className="card flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-gray-900 text-sm">{n.titulo}</p>
                <p className="text-xs text-gray-400 ml-2">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <p className="text-sm text-gray-500">{n.mensagem}</p>
              <p className="text-xs text-gray-400">Para: {n.profiles?.nome || 'Todos'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
