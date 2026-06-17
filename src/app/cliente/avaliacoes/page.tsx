'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Star, Send } from 'lucide-react'

export default function ClienteAvaliacoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [depoimentos, setDepoimentos] = useState<any[]>([])
  const [servicoId, setServicoId] = useState('')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setCliente(cli); setSalao(cli?.saloes)
    const { data: srvs } = await supabase.from('servicos').select('id, nome').eq('salao_id', cli?.saloes?.id).eq('ativo', true)
    setServicos(srvs || [])
    const { data: deps } = await supabase.from('depoimentos').select('*, clientes(nome), servicos(nome)')
      .eq('salao_id', cli?.saloes?.id).eq('publico', true).order('created_at', { ascending: false })
    setDepoimentos(deps || [])
  }

  async function enviarAvaliacao() {
    if (!texto) return
    setSalvando(true)
    await supabase.from('depoimentos').insert({
      salao_id: salao.id,
      cliente_id: cliente.id,
      servico_id: servicoId || null,
      texto,
      publico: true
    })
    setTexto(''); setServicoId(''); setSalvando(false); setSucesso(true)
    carregarDados()
    setTimeout(() => setSucesso(false), 3000)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Avaliacoes</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="card flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2">
            <Star size={18} style={{ color: cor }} />Deixar avaliacao
          </p>
          {sucesso && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3"><p className="text-green-600 text-sm text-center">Avaliacao enviada!</p></div>}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Servico (opcional)</label>
            <select className="input-field" value={servicoId} onChange={e => setServicoId(e.target.value)}>
              <option value="">Avaliacao geral do salao</option>
              {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Seu comentario</label>
            <textarea className="input-field resize-none" rows={4}
              placeholder="Conte sua experiencia, sugestoes de servicos..."
              value={texto} onChange={e => setTexto(e.target.value)} />
          </div>
          <button onClick={enviarAvaliacao} disabled={!texto || salvando}
            className="w-full text-white rounded-2xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: cor }}>
            <Send size={16} />{salvando ? 'Enviando...' : 'Enviar avaliacao'}
          </button>
        </div>

        <p className="font-bold text-gray-900">Avaliacoes do salao ({depoimentos.length})</p>
        {depoimentos.length === 0 ? (
          <div className="card text-center py-8"><p className="text-gray-400">Nenhuma avaliacao ainda</p></div>
        ) : depoimentos.map(d => (
          <div key={d.id} className="card flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: cor }}>
                {d.clientes?.nome?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{d.clientes?.nome}</p>
                {d.servicos?.nome && <p className="text-xs text-gray-400">{d.servicos.nome}</p>}
              </div>
              <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <p className="text-sm text-gray-600">{d.texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
