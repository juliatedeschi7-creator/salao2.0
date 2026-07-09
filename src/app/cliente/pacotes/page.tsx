'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'

export default function MeusPacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [meusPacotes, setMeusPacotes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase
      .from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    if (!cli) { setCarregando(false); return }
    setCliente(cli)
    setSalao(cli.saloes)

    const { data: pacs } = await supabase
      .from('cliente_pacotes')
      .select('*, pacotes(nome, descricao, categoria)')
      .eq('cliente_id', cli.id)
      .order('data_compra', { ascending: false })
    setMeusPacotes(pacs || [])
    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  const statusCor: Record<string, string> = {
    ativo: 'bg-green-50 text-green-600',
    expirado: 'bg-red-50 text-red-500',
    concluido: 'bg-gray-100 text-gray-400',
  }
  const statusLabel: Record<string, string> = {
    ativo: 'Ativo', expirado: 'Expirado', concluido: 'Concluído'
  }

  if (loading || carregando) return (
    <div className="min-h-screen" style={{ backgroundColor: '#f4f4f8' }}>
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Meus pacotes</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl p-4 animate-pulse h-28" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#f4f4f8' }}>
      {/* Header */}
      <div className="relative px-4 pt-12 pb-8 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cor}, ${cor}bb)` }}>
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-10 bg-white" />
        <button onClick={() => router.back()}
          className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-4">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="relative text-white font-bold text-2xl">Meus pacotes</h1>
        <p className="relative text-white/70 text-sm mt-1">Datas e sessões dos seus pacotes</p>
      </div>

      {/* Stats flutuantes */}
      {meusPacotes.length > 0 && (
        <div className="px-4 -mt-5 relative z-10 mb-4">
          <div className="bg-white rounded-2xl shadow-md grid grid-cols-3 divide-x divide-gray-100">
            <div className="px-3 py-3 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {meusPacotes.filter(p => p.status === 'ativo').length}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Ativos</p>
            </div>
            <div className="px-3 py-3 text-center">
              <p className="text-2xl font-bold" style={{ color: cor }}>
                {meusPacotes.filter(p => p.status === 'ativo').reduce((acc, p) => acc + (p.sessoes_total - p.sessoes_usadas), 0)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Sessões restantes</p>
            </div>
            <div className="px-3 py-3 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {meusPacotes.reduce((acc, p) => acc + p.sessoes_usadas, 0)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Realizadas</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 flex flex-col gap-3">
        {meusPacotes.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${cor}15` }}>
              <Package size={24} style={{ color: cor }} />
            </div>
            <p className="font-semibold text-gray-700">Você ainda não tem pacotes</p>
            <p className="text-gray-400 text-xs text-center leading-relaxed">
              Quando o salão registrar um pacote para você, ele aparece aqui com o progresso das sessões.
            </p>
          </div>
        ) : meusPacotes.map(mp => {
          const progresso = mp.sessoes_total > 0 ? (mp.sessoes_usadas / mp.sessoes_total) * 100 : 0
          const restantes = mp.sessoes_total - mp.sessoes_usadas

          return (
            <div key={mp.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              {/* Cabeçalho */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{mp.pacotes?.nome}</p>
                  {mp.pacotes?.categoria && (
                    <p className="text-xs text-gray-400 mt-0.5">{mp.pacotes.categoria}</p>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${statusCor[mp.status] || 'bg-gray-100 text-gray-400'}`}>
                  {statusLabel[mp.status] || mp.status}
                </span>
              </div>

              {/* Barra de progresso */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>{mp.sessoes_usadas} sessões usadas</span>
                  <span className="font-semibold" style={{ color: mp.status === 'ativo' ? cor : '#9ca3af' }}>
                    {restantes} restante{restantes !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${progresso}%`,
                      backgroundColor: mp.status === 'ativo' ? cor : '#d1d5db'
                    }} />
                </div>
                <p className="text-xs text-gray-300 mt-1 text-right">{mp.sessoes_total} sessões no total</p>
              </div>

              {/* Datas */}
              <div className="flex gap-4 text-xs text-gray-400">
                <div>
                  <p className="font-semibold text-gray-500 mb-0.5">Compra</p>
                  <p>{new Date(mp.data_compra).toLocaleDateString('pt-BR')}</p>
                </div>
                {mp.data_expiracao && (
                  <div>
                    <p className="font-semibold text-gray-500 mb-0.5">Expira em</p>
                    <p className={new Date(mp.data_expiracao) < new Date() ? 'text-red-400 font-medium' : ''}>
                      {new Date(mp.data_expiracao).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>

              {mp.pacotes?.descricao && (
                <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-50 pt-2">
                  {mp.pacotes.descricao}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}