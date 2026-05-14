'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, ChevronDown, Bell } from 'lucide-react'

interface Salao {
  id: string
  nome: string
  dono_id: string
  profiles: { nome: string }
}

interface NotifEnviada {
  id: string
  titulo: string
  mensagem: string
  created_at: string
  profiles: { nome: string }
}

export default function AdminNotificacoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [saloes, setSaloes] = useState<Salao[]>([])
  const [enviadas, setEnviadas] = useState<NotifEnviada[]>([])
  const [destinatario, setDestinatario] = useState<'todos' | string>('todos')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [aba, setAba] = useState<'enviar' | 'historico'>('enviar')

  useEffect(() => {
    if (!loading && profile?.role !== 'admin_geral') router.push('/login')
    else if (!loading) { carregarSaloes(); carregarEnviadas() }
  }, [loading])

  async function carregarSaloes() {
    const { data } = await supabase
      .from('saloes')
      .select('id, nome, dono_id, profiles!saloes_dono_id_fkey(nome)')
      .eq('pausado', false)
      .eq('ativo', true)
      .order('nome')
    setSaloes(data || [])
  }

  async function carregarEnviadas() {
    const { data } = await supabase
      .from('notificacoes')
      .select('id, titulo, mensagem, created_at, profiles!notificacoes_destinatario_id_fkey(nome)')
      .eq('remetente_id', profile?.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setEnviadas(data || [])
  }

  async function enviarNotificacao() {
    if (!titulo || !mensagem) return
    setEnviando(true)

    if (destinatario === 'todos') {
      const inserts = saloes.map(s => ({
        salao_id: s.id,
        remetente_id: profile?.id,
        destinatario_id: s.dono_id,
        titulo,
        mensagem,
        tipo: 'admin'
      }))
      await supabase.from('notificacoes').insert(inserts)
    } else {
      const salao = saloes.find(s => s.id === destinatario)
      if (salao) {
        await supabase.from('notificacoes').insert({
          salao_id: salao.id,
          remetente_id: profile?.id,
          destinatario_id: salao.dono_id,
          titulo,
          mensagem,
          tipo: 'admin'
        })
      }
    }

    setTitulo('')
    setMensagem('')
    setDestinatario('todos')
    setEnviando(false)
    setSucesso(true)
    carregarEnviadas()
    setTimeout(() => setSucesso(false), 3000)
  }

  return (
    <div className="min-h-screen bg-[#f8f4f6]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg">Notificações</h1>
      </div>

      {/* Abas */}
      <div className="flex bg-white border-b border-gray-100">
        {(['enviar', 'historico'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`flex-1 py-3 text-sm font-medium transition-all ${aba === a ? 'text-[#E91E8C] border-b-2 border-[#E91E8C]' : 'text-gray-400'}`}>
            {a === 'enviar' ? 'Enviar Notificação' : 'Histórico'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {aba === 'enviar' ? (
          <>
            {sucesso && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-green-600 text-sm text-center font-medium">
                  ✅ Notificação enviada com sucesso!
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Destinatário</label>
              <div className="relative">
                <select
                  className="input-field appearance-none pr-10"
                  value={destinatario}
                  onChange={e => setDestinatario(e.target.value)}
                >
                  <option value="todos">Todos os salões ativos ({saloes.length})</option>
                  {saloes.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nome} — {s.profiles?.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Título</label>
              <input className="input-field" placeholder="Ex: Atualização importante"
                value={titulo} onChange={e => setTitulo(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Mensagem</label>
              <textarea className="input-field resize-none" rows={5}
                placeholder="Digite sua mensagem..."
                value={mensagem} onChange={e => setMensagem(e.target.value)} />
            </div>

            <button onClick={enviarNotificacao}
              disabled={!titulo || !mensagem || enviando}
              className="btn-primary disabled:opacity-50">
              {enviando
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Send size={18} />Enviar Notificação</>}
            </button>
          </>
        ) : (
          <>
            {enviadas.length === 0 ? (
              <div className="card text-center py-10">
                <Bell size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400">Nenhuma notificação enviada ainda</p>
              </div>
            ) : (
              enviadas.map(n => (
                <div key={n.id} className="card flex flex-col gap-1">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-gray-900 text-sm">{n.titulo}</p>
                    <p className="text-xs text-gray-400 shrink-0 ml-2">
                      {new Date(n.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500">{n.mensagem}</p>
                  <p className="text-xs text-[#E91E8C]">Para: {n.profiles?.nome || 'Todos'}</p>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
