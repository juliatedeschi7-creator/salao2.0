'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, CheckCircle2, Play, Coffee, Sun, LogOut } from 'lucide-react'

export default function PontoFuncionarioPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  
  const [salao, setSalao] = useState<any>(null)
  const [registroHoje, setRegistroHoje] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [horaAtual, setHoraAtual] = useState('')

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => {
      const agora = new Date()
      setHoraAtual(agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    const hoje = new Date().toISOString().split('T')[0]

    const [salRes, pontoRes] = await Promise.all([
      supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
      supabase.from('registro_horas')
        .select('*')
        .eq('salao_id', profile!.salao_id!)
        .eq('funcionario_id', profile!.id)
        .eq('data', hoje)
        .maybeSingle()
    ])

    setSalao(salRes.data)
    setRegistroHoje(pontoRes.data || null)
    setCarregando(false)
  }

  // Define qual ação deve ser tomada ao clicar no botão
  function getProximaAcao() {
    if (!registroHoje || !registroHoje.entrada) {
      return { campo: 'entrada', label: 'Registrar Entrada', icone: Play, cor: 'bg-emerald-600 hover:bg-emerald-700' }
    }
    if (!registroHoje.saida_almoco) {
      return { campo: 'saida_almoco', label: 'Saída para Almoço', icone: Coffee, cor: 'bg-amber-500 hover:bg-amber-600' }
    }
    if (!registroHoje.volta_almoco) {
      return { campo: 'volta_almoco', label: 'Retorno do Almoço', icone: Sun, cor: 'bg-blue-600 hover:bg-blue-700' }
    }
    if (!registroHoje.saida) {
      return { campo: 'saida', label: 'Registrar Saída', icone: LogOut, cor: 'bg-rose-600 hover:bg-rose-700' }
    }
    return null // Jornada concluída
  }

  async function handleBaterPonto() {
    const acao = getProximaAcao()
    if (!acao) return

    setSalvando(true)
    const hoje = new Date().toISOString().split('T')[0]
    const horaFormatada = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    try {
      if (!registroHoje) {
        // Primeiro registro do dia
        const { error } = await supabase.from('registro_horas').insert([{
          salao_id: profile!.salao_id,
          funcionario_id: profile!.id,
          data: hoje,
          entrada: horaFormatada
        }])
        if (error) throw error
      } else {
        // Atualiza a etapa atual
        const { error } = await supabase.from('registro_horas')
          .update({ [acao.campo]: horaFormatada })
          .eq('id', registroHoje.id)
        if (error) throw error
      }

      await carregarDados()
    } catch (err: any) {
      alert('Erro ao registrar ponto: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const acaoAtual = getProximaAcao()

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
            <h1 className="font-bold text-gray-900 text-lg">Ponto Eletrônico</h1>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-5">

        {/* RELÓGIO & BOTÃO DE BATER PONTO */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 capitalize">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight mt-1">{horaAtual || '00:00:00'}</h2>
          </div>

          {acaoAtual ? (
            <button
              onClick={handleBaterPonto}
              disabled={salvando}
              className={`w-full py-4 rounded-2xl text-white font-bold text-base shadow-md flex items-center justify-center gap-2.5 transition-all active:scale-95 ${acaoAtual.cor}`}>
              <acaoAtual.icone size={20} />
              {salvando ? 'Registrando...' : acaoAtual.label}
            </button>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold">
              <CheckCircle2 size={20} /> Jornada de hoje concluída!
            </div>
          )}
        </div>

        {/* RESUMO DO DIA */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Registros de Hoje
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              <span className="text-[11px] font-semibold text-gray-400 block">1. Entrada</span>
              <p className="text-base font-bold text-gray-800 mt-0.5">{registroHoje?.entrada || '--:--'}</p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              <span className="text-[11px] font-semibold text-gray-400 block">2. Saída Almoço</span>
              <p className="text-base font-bold text-gray-800 mt-0.5">{registroHoje?.saida_almoco || '--:--'}</p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              <span className="text-[11px] font-semibold text-gray-400 block">3. Volta Almoço</span>
              <p className="text-base font-bold text-gray-800 mt-0.5">{registroHoje?.volta_almoco || '--:--'}</p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              <span className="text-[11px] font-semibold text-gray-400 block">4. Saída</span>
              <p className="text-base font-bold text-gray-800 mt-0.5">{registroHoje?.saida || '--:--'}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
