'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, CheckCircle, Clock } from 'lucide-react'

export default function ClientePacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [filtro, setFiltro] = useState<'ativos' | 'expirados' | 'todos'>('ativos')

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setSalao(cli?.saloes)
    const { data: pacs } = await supabase.from('cliente_pacotes')
      .select('*, pacotes(nome, descricao, regras, categoria)')
      .eq('cliente_id', cli?.id)
      .order('data_compra', { ascending: false })
    setPacotes(pacs || [])
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'

  const filtrados = pacotes.filter(p => {
    if (filtro === 'todos') return true
    if (filtro === 'ativos') return p.status === 'ativo'
    return p.status === 'expirado' || p.status === 'concluido'
  })

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Meus Pacotes</h1>
      </div>

      <div className="flex bg-white border-b border-gray-100">
        {(['ativos', 'expirados', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={'flex-1 py-3 text-xs font-medium transition-all ' + (filtro === f ? 'border-b-2' : 'text-gray-400')}
            style={filtro === f ? { color: cor, borderColor: cor } : {}}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {filtrados.length === 0 ? (
          <div className="card text-center py-10">
            <Package size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum pacote encontrado</p>
          </div>
        ) : filtrados.map(p => {
          const progresso = p.sessoes_total > 0 ? (p.sessoes_usadas / p.sessoes_total) * 100 : 0
          const expirado = p.data_expiracao && new Date(p.data_expiracao) < new Date()
          return (
            <div key={p.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{p.pacotes?.nome}</p>
                  {p.pacotes?.categoria && <p className="text-xs text-gray-400">{p.pacotes.categoria}</p>}
                </div>
                <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                  (p.status === 'ativo' && !expirado ? 'bg-green-50 text-green-600' :
                  p.status === 'concluido' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-400')}>
                  {expirado ? 'Expirado' : p.status}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{p.sessoes_usadas} sessoes usadas</span>
                  <span>{p.sessoes_total - p.sessoes_usadas} restantes</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-2 rounded-full transition-all" style={{ width: progresso + '%', backgroundColor: cor }} />
                </div>
              </div>

              <div className="flex gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <CheckCircle size={12} />{p.sessoes_usadas}/{p.sessoes_total} sessoes
                </div>
                {p.data_expiracao && (
                  <div className="flex items-center gap-1">
                    <Clock size={12} />Expira: {new Date(p.data_expiracao).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>

              {p.pacotes?.regras && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 font-medium mb-1">Regras do pacote</p>
                  <p className="text-xs text-gray-500">{p.pacotes.regras}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
