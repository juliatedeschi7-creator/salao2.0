'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, CheckCircle, Clock } from 'lucide-react'

export default function ClienteContratosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [contratos, setContratos] = useState<any[]>([])

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setSalao(cli?.saloes)
    const { data: cnts } = await supabase.from('contratos').select('*').eq('cliente_id', cli?.id).order('created_at', { ascending: false })
    setContratos(cnts || [])
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Meus Contratos</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {contratos.length === 0 ? (
          <div className="card text-center py-10"><FileText size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhum contrato recebido</p></div>
        ) : contratos.map(c => (
          <button key={c.id} onClick={() => router.push('/cliente/contratos/' + c.id)}
            className="card flex flex-col gap-2 text-left active:scale-95 transition-all">
            <div className="flex items-start justify-between">
              <p className="font-bold text-gray-900">{c.titulo}</p>
              <span className={'text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ' +
                (c.status === 'assinado' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600')}>
                {c.status === 'assinado' ? <><CheckCircle size={10} />Assinado</> : <><Clock size={10} />Pendente assinatura</>}
              </span>
            </div>
            <p className="text-xs text-gray-400">Recebido: {new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
