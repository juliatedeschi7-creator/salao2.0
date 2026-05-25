'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Bell, Clock, ChevronRight } from 'lucide-react'

export default function NotificacoesSalaoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [enviadas, setEnviadas] = useState<any[]>([])
  const [aba, setAba] = useState<'enviar' | 'historico'>('enviar')
  const [destinatario, setDestinatario] = useState('todos')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: clis } = await supabase.from('clientes').select('*, profiles(id)').eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(clis || [])
    const { data: envs } = await supabase.from('notificacoes').select('*, profiles!notificacoes_destinatario_id_fkey(nome)').eq('salao_id', profile!.salao_id!).eq('remetente_id', profile!.id).order('created_at', { ascending: false }).limit(30)
    if (envs) setEnviadas(envs.map((n: any) => ({ ...n, profiles: Array.isArray(n.profiles) ? n.profiles[0] ?? null : n.profiles ?? null })))
  }

  async function enviar() {
    if (!titulo || !mensagem) return
    setEnviando(true)
    if (destinatario === 'todos') {
      const inserts = clientes.filter(c => c.profiles?.id).map(c => ({ salao_id: profile!.salao_id, remetente_id: profile!.id, destinatario_id: c.profiles.id, titulo, mensagem, tipo: 'geral' }))
      if (inserts.length > 0) await supabase.from('notificacoes').insert(inserts)
    } else {
      const cliente = clientes.find(c => c.id === destinatario)
      if (cliente?.profiles?.id) await supabase.from('notificacoes').insert({ salao_id: profile!.salao_id, remetente_id: profile!.id, destinatario_id: cliente.profiles.id, titulo, mensagem, tipo: 'geral' })
    }
    setTitulo(''); setMensagem(''); setDestinatario('todos'); setEnviando(false); setSucesso(true)
    carregarDados()
    setTimeout(() => setSucesso(false), 3000)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg">Notificacoes</h1>
      </div>

      <div className="px-4 pt-4">
        <button onClick={() => router.push('/salao/notificacoes/lembretes')}
          className="w-full card flex items-center gap-3 active:scale-95 transition-all mb-1">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: salao?.cor_secundaria || '#FCE4F3' }}>
            <Clock size={18} style={{ color: cor }} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-gray-900 text-sm">Lembretes de agendamento</p>
            <p className="text-xs text-gray-400">Enviar lembretes para clientes</p>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      </div>

      <div className="flex bg-white border-b border-gray-100 mt-3">
        {(['enviar', 'historico'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={'flex-1 py-3 text-sm font-medium transition-all ' + (aba === a ? 'border-b-2' : 'text-gray-400')}
            style={aba === a ? { color: cor, borderColor: cor } : {}}>
            {a === 'enviar' ? 'Enviar' : 'Historico'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {aba === 'enviar' ? (
          <>
            {sucesso && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3"><p className="text-green-600 text-sm text-center">Notificacao enviada!</p></div>}
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Destinatario</label>
              <select className="input-field" value={destinatario} onChange={e => setDestinatario(e.target.value)}>
                <option value="todos">Todas as clientes ({clientes.filter(c => c.profiles?.id).length})</option>
                {clientes.filter(c => c.profiles?.id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Titulo</label><input className="input-field" placeholder="Ex: Promocao especial!" value={titulo} onChange={e => setTitulo(e.target.value)} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Mensagem</label><textarea className="input-field resize-none" rows={4} placeholder="Digite sua mensagem..." value={mensagem} onChange={e => setMensagem(e.target.value)} /></div>
            <button onClick={enviar} disabled={!titulo || !mensagem || enviando} className="btn-primary disabled:opacity-50" style={{ backgroundColor: cor }}>
              {enviando ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send size={18} />Enviar</>}
            </button>
          </>
        ) : (
          enviadas.length === 0 ? (
            <div className="card text-center py-10"><Bell size={32} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhuma notificacao enviada</p></div>
          ) : enviadas.map((n: any) => (
            <div key={n.id} className="card flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-gray-900 text-sm">{n.titulo}</p>
                <p className="text-xs text-gray-400 ml-2">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <p className="text-sm text-gray-500">{n.mensagem}</p>
              <p className="text-xs" style={{ color: cor }}>Para: {n.profiles?.nome || 'Todas'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
