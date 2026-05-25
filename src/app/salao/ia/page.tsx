'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Sparkles } from 'lucide-react'

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  'Estou com muitos horarios vagos, o que fazer?',
  'Como aumentar seguidores no Instagram?',
  'Ideias de promocoes para fidelizar clientes',
  'Como criar um pacote atrativo?',
  'Sugestoes de posts para o salao',
]

export default function IAPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: hist } = await supabase.from('sugestoes_ia').select('*').eq('salao_id', profile!.salao_id!).order('created_at').limit(20)
    if (hist && hist.length > 0) {
      const m: Msg[] = []
      hist.forEach(h => { m.push({ role: 'user', content: h.pergunta }); m.push({ role: 'assistant', content: h.resposta }) })
      setMsgs(m)
    }
  }

  async function enviar(texto?: string) {
    const pergunta = texto || input
    if (!pergunta.trim() || enviando) return
    const novas: Msg[] = [...msgs, { role: 'user', content: pergunta }]
    setMsgs(novas); setInput(''); setEnviando(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          system: 'Voce e uma consultora especialista em saloes de beleza brasileiros. Ajude a dona do salao "' + salao?.nome + '" em ' + (salao?.cidade || 'Brasil') + ' com sugestoes praticas. Seja direta e use linguagem descontraida.',
          messages: novas.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await response.json()
      const resposta = data.content?.[0]?.text || 'Erro ao gerar resposta.'
      setMsgs(prev => [...prev, { role: 'assistant', content: resposta }])
      await supabase.from('sugestoes_ia').insert({ salao_id: profile!.salao_id, pergunta, resposta })
    } catch { setMsgs(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar. Tente novamente.' }]) }
    setEnviando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <Sparkles size={20} style={{ color: cor }} />
        <h1 className="font-bold text-gray-900 text-lg">Sugestoes IA</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {msgs.length === 0 && (
          <>
            <div className="card text-center py-6">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3" style={{ backgroundColor: salao?.cor_secundaria || '#FCE4F3' }}>
                <Sparkles size={28} style={{ color: cor }} />
              </div>
              <p className="font-bold text-gray-900">Ola! Sou sua consultora IA</p>
              <p className="text-sm text-gray-500 mt-1">Pergunte sobre promocoes, estrategias, posts e muito mais!</p>
            </div>
            {SUGESTOES.map((s, i) => (
              <button key={i} onClick={() => enviar(s)} className="card text-left text-sm text-gray-700 active:scale-95 transition-all">💡 {s}</button>
            ))}
          </>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={'max-w-[85%] px-4 py-3 rounded-2xl text-sm ' + (m.role === 'user' ? 'text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm shadow-sm')}
              style={m.role === 'user' ? { backgroundColor: cor } : {}}>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1">
              {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: cor, animationDelay: i * 0.15 + 's' }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white px-4 py-3 flex items-end gap-3 border-t border-gray-100">
        <textarea className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-sm outline-none resize-none max-h-32" placeholder="Digite sua pergunta..." rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} />
        <button onClick={() => enviar()} disabled={!input.trim() || enviando} className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40" style={{ backgroundColor: cor }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
