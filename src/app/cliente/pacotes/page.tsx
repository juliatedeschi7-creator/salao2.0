'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, ChevronDown, ChevronUp } from 'lucide-react'

export default function MeusPacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [meusPacotes, setMeusPacotes] = useState<any[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    // 1. Busca o cliente vinculado ao profile logado e os dados do salão
    const { data: cli } = await supabase
      .from('clientes')
      .select('*, saloes(*)')
      .eq('profile_id', profile!.id)
      .single()

    if (!cli) { 
      setCarregando(false)
      return 
    }
    
    setSalao(cli.saloes)

    // 2. Busca os pacotes na tabela unificada usada pelo painel do dono
    const { data: pacs, error } = await supabase
      .from('pacotes_clientes_resumo')
      .select('*')
      .eq('cliente_nome', cli.nome)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar pacotes do cliente:', error.message)
    }

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
    ativo: 'Ativo', 
    expirado: 'Expirado', 
    concluido: 'Concluído'
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

  const totalAtivos = meusPacotes.filter(p => (p.status || 'ativo') === 'ativo').length
  const totalRestantes = meusPacotes
    .filter(p => (p.status || 'ativo') === 'ativo')
    .reduce((acc, p) => acc + (p.sessoes_restantes ?? 0), 0)
  const totalRealizadas = meusPacotes.reduce((acc, p) => {
    const total = p.sessoes_total || 1
    const restantes = p.sessoes_restantes ?? total
    return acc + Math.max(0, total - restantes)
  }, 0)

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
              <p className="text-2xl font-bold text-gray-900">{totalAtivos}</p>
              <p className="text-xs text-gray-400 mt-0.5">Ativos</p>
            </div>
            <div className="px-3 py-3 text-center">
              <p className="text-2xl font-bold" style={{ color: cor }}>{totalRestantes}</p>
              <p className="text-xs text-gray-400 mt-0.5">Sessões restantes</p>
            </div>
            <div className="px-3 py-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalRealizadas}</p>
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
          const nomeServico = mp.servico || 'Pacote'
          const total = mp.sessoes_total || 1
          const restantes = mp.sessoes_restantes ?? total
          const usadas = Math.max(0, total - restantes)
          const progresso = total > 0 ? (usadas / total) * 100 : 0
          const status = mp.status || 'ativo'
          const historico = Array.isArray(mp.historico_sessoes) ? mp.historico_sessoes : []
          const aberto = expandido === mp.id

          return (
            <div key={mp.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              {/* Cabeçalho */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{nomeServico}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${statusCor[status] || 'bg-gray-100 text-gray-400'}`}>
                  {statusLabel[status] || status}
                </span>
              </div>

              {/* Barra de progresso */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>{usadas} sessões usadas</span>
                  <span className="font-semibold" style={{ color: status === 'ativo' ? cor : '#9ca3af' }}>
                    {restantes} restante{restantes !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${progresso}%`,
                      backgroundColor: status === 'ativo' ? cor : '#d1d5db'
                    }} />
                </div>
                <p className="text-xs text-gray-300 mt-1 text-right">{total} sessões no total</p>
              </div>

              {/* Data de Criação */}
              <div className="flex gap-4 text-xs text-gray-400">
                <div>
                  <p className="font-semibold text-gray-500 mb-0.5">Adquirido em</p>
                  <p>{new Date(mp.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {/* Histórico de sessões */}
              {historico.length > 0 && (
                <div className="border-t border-gray-50 pt-2">
                  <button onClick={() => setExpandido(aberto ? null : mp.id)}
                    className="w-full flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500">
                      Histórico de sessões ({historico.length})
                    </p>
                    {aberto ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>
                  {aberto && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {historico.map((s: any, idx: number) => {
                        const dataFormatada = s.data ? s.data.split('-').reverse().join('/') : ''
                        return (
                          <div key={s.id || idx} className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                            <span className="shrink-0 font-medium text-gray-600">
                              {dataFormatada}
                            </span>
                            <span className="flex-1 text-right truncate ml-2">{s.servico}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
