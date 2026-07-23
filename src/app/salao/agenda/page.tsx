'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Calendar as CalendarIcon, Plus, Clock, User, Scissors } from 'lucide-react'

export default function AgendaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [carregandoDados, setCarregandoDados] = useState(true)

  useEffect(() => {
    if (loading) return
    
    // Se não houver perfil logado, envia para o login de forma segura
    if (!profile) {
      router.push('/login')
      return
    }

    if (profile.salao_id) {
      carregarAgenda(profile.salao_id)
    }
  }, [loading, profile])

  async function carregarAgenda(salaoId: string) {
    try {
      setCarregandoDados(true)
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, clientes(nome), servicos(nome, preco)')
        .eq('salao_id', salaoId)
        .order('data', { ascending: true })

      if (error) {
        console.error('Erro ao buscar agendamentos:', error.message)
      } else {
        setAgendamentos(data || [])
      }
    } catch (err) {
      console.error('Erro inesperado:', err)
    } finally {
      setCarregandoDados(false)
    }
  }

  if (loading || carregandoDados) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Agenda</h1>
          <p className="text-xs text-gray-500">Gerencie os horários e compromissos do salão.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs">
        {agendamentos.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            Nenhum agendamento encontrado para este salão.
          </div>
        ) : (
          <div className="space-y-3">
            {agendamentos.map((ag) => (
              <div key={ag.id} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold">
                    <CalendarIcon size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-xs">{ag.clientes?.nome || 'Cliente não informado'}</h3>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <Scissors size={12} /> {ag.servicos?.nome || 'Serviço'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-900">{ag.horario || ag.data}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
