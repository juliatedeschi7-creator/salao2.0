'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, CheckCircle, Clock, FileText, X } from 'lucide-react'

export default function ClientePacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [filtro, setFiltro] = useState<'ativos' | 'expirados' | 'todos'>('ativos')
  const [modalRegras, setModalRegras] = useState<any>(null)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setSalao(cli?.saloes)
    const { data: pacs } = await supabase.from('cliente_pacotes')
      .select('*, pacotes(nome, descricao, regras)')
      .eq('cliente_id', cli?.id)
      .order('data_compra', { ascending: false })
    setPacotes(pacs || [])
  }

  async function confirmarLeituraRegras(pacote: any) {
    setConfirmando(true)
    await supabase.from('cliente_pacotes').update({
      regras_confirmadas: true,
      regras_confirmadas_em: new Date().toISOString()
    }).eq('id', pacote.id)
    setConfirmando(false)
    setModalRegras(null)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  const filtrados = pacotes.filter(p => {
    if (filtro === 'todos') return true
    if (filtro === 'ativos') return p.status === 'ativo'
    return p.status === 'expirado' || p.status === 'concluido'
  })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

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
          const temRegras = !!p.pacotes?.regras

          return (
            <div key={p.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{p.pacotes?.nome || 'Pacote'}</p>
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

              {temRegras && (
                <button onClick={() => setModalRegras(p)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl border-2 transition-all"
                  style={{ borderColor: p.regras_confirmadas ? '#d1fae5' : cor }}>
                  <div className="flex items-center gap-2">
                    <FileText size={16} style={{ color: p.regras_confirmadas ? '#10b981' : cor }} />
                    <span className="text-sm font-medium" style={{ color: p.regras_confirmadas ? '#10b981' : cor }}>
                      {p.regras_confirmadas ? 'Regras confirmadas' : 'Ver regras do pacote'}
                    </span>
                  </div>
                  {p.regras_confirmadas && <CheckCircle size={16} className="text-green-500" />}
                </button>
              )}

              {p.regras_confirmadas_em && (
                <p className="text-xs text-gray-400 text-center">
                  Confirmado em {new Date(p.regras_confirmadas_em).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {modalRegras && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Regras do Pacote</h3>
              <button onClick={() => setModalRegras(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm font-semibold text-gray-700">{modalRegras.pacotes?.nome}</p>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {modalRegras.pacotes?.regras}
              </p>
            </div>

            {modalRegras.regras_confirmadas ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <p className="text-sm text-green-700">
                  Voce confirmou que leu em {new Date(modalRegras.regras_confirmadas_em).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ) : (
              <button onClick={() => confirmarLeituraRegras(modalRegras)} disabled={confirmando}
                className="w-full py-3 rounded-2xl text-white font-semibold"
                style={{ backgroundColor: cor }}>
                {confirmando ? 'Confirmando...' : 'Li e estou de acordo'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
