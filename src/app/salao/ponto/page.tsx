'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Calendar, Users, CheckCircle, AlertCircle } from 'lucide-react'

export default function GestaoPontoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  
  const [salao, setSalao] = useState<any>(null)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [registros, setRegistros] = useState<any[]>([])
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile, dataFiltro])

  async function carregarDados() {
    setCarregando(true)

    const [salRes, funcRes, pontoRes] = await Promise.all([
      supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
      supabase.from('profiles').select('*').eq('salao_id', profile!.salao_id!).neq('role', 'cliente'),
      supabase.from('registro_horas').select('*').eq('salao_id', profile!.salao_id!).eq('data', dataFiltro)
    ])

    setSalao(salRes.data)
    setFuncionarios(funcRes.data || [])
    setRegistros(pontoRes.data || [])
    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: cor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Clock size={22} style={{ color: cor }} />
            <h1 className="font-bold text-gray-900 text-lg">Espelho de Ponto</h1>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* FILTRO DE DATA */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <Calendar size={18} style={{ color: cor }} /> Selecionar Data:
          </div>
          <input
            type="date"
            value={dataFiltro}
            onChange={e => setDataFiltro(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 focus:outline-none"
          />
        </div>

        {/* LISTA DE FUNCIONÁRIOS E SEUS HORÁRIOS */}
        <div className="space-y-3">
          {funcionarios.map(f => {
            const ponto = registros.find(r => r.funcionario_id === f.id)

            return (
              <div key={f.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: cor }}>
                      {f.nome?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{f.nome}</p>
                      <p className="text-[11px] text-gray-400 capitalize">{f.role || 'Profissional'}</p>
                    </div>
                  </div>

                  {ponto?.saida ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Concluído
                    </span>
                  ) : ponto?.entrada ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Em Expediente
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">
                      Sem Registro
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-50 text-center">
                  <div className="bg-gray-50 p-2 rounded-xl">
                    <span className="text-[9px] text-gray-400 uppercase font-semibold block">Entrada</span>
                    <span className="text-xs font-bold text-gray-800">{ponto?.entrada || '--:--'}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl">
                    <span className="text-[9px] text-gray-400 uppercase font-semibold block">Almoço</span>
                    <span className="text-xs font-bold text-gray-800">{ponto?.saida_almoco || '--:--'}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl">
                    <span className="text-[9px] text-gray-400 uppercase font-semibold block">Volta</span>
                    <span className="text-xs font-bold text-gray-800">{ponto?.volta_almoco || '--:--'}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl">
                    <span className="text-[9px] text-gray-400 uppercase font-semibold block">Saída</span>
                    <span className="text-xs font-bold text-gray-800">{ponto?.saida || '--:--'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
