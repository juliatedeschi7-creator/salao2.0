'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Calendar, CheckCircle, User } from 'lucide-react'

export default function HorariosClientePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [horarios, setHorarios] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [reservando, setReservando] = useState<string | null>(null)
  const [reservados, setReservados] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase
      .from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    if (!cli) { setCarregando(false); return }
    setCliente(cli)
    setSalao(cli.saloes)

    const agora = new Date().toISOString()
    const { data: hrs } = await supabase
      .from('horarios_vagos')
      .select('*, profiles(nome)')
      .eq('salao_id', cli.saloes.id)
      .eq('reservado', false)
      .gte('data_hora', agora)
      .order('data_hora')
    setHorarios(hrs || [])
    setCarregando(false)
  }

  async function reservarHorario(horario: any) {
    if (reservados.has(horario.id) || reservando === horario.id) return
    setReservando(horario.id)

    await supabase.from('horarios_vagos').update({
      reservado: true, cliente_id: cliente.id
    }).eq('id', horario.id)

    await supabase.from('notificacoes').insert({
      salao_id: salao.id,
      remetente_id: profile!.id,
      destinatario_id: salao.dono_id,
      titulo: '📅 Horário reservado!',
      mensagem: `${cliente.nome} reservou o horário de ${formatarDataHora(horario.data_hora)}.`,
      tipo: 'horario'
    })

    setReservados(prev => new Set(Array.from(prev).concat(horario.id)))
    setReservando(null)
    // Remove da lista localmente
    setHorarios(prev => prev.filter(h => h.id !== horario.id))
  }

  function formatarDataHora(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatarDuracao(min: number) {
    if (min < 60) return `${min} min`
    const h = Math.floor(min / 60), m = min % 60
    return m === 0 ? `${h}h` : `${h}h${m}min`
  }

  // Agrupa por dia
  const grupos: Record<string, any[]> = {}
  horarios.forEach(h => {
    const dia = new Date(h.data_hora).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!grupos[dia]) grupos[dia] = []
    grupos[dia].push(h)
  })

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) return (
    <div className="min-h-screen" style={{ backgroundColor: '#f4f4f8' }}>
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Horários disponíveis</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-1/3 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#f4f4f8' }}>
      <div className="relative px-4 pt-12 pb-8 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cor}, ${cor}bb)` }}>
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-10 bg-white" />
        <button onClick={() => router.back()}
          className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-4">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="relative text-white font-bold text-2xl">Horários disponíveis</h1>
        <p className="relative text-white/70 text-sm mt-1">
          Reserve seu horário com um toque
        </p>
      </div>

      <div className="px-4 py-5 flex flex-col gap-5">
        {horarios.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center flex flex-col items-center gap-3 shadow-sm">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${cor}15` }}>
              <Calendar size={24} style={{ color: cor }} />
            </div>
            <p className="font-semibold text-gray-800">Nenhum horário disponível</p>
            <p className="text-gray-400 text-sm text-center">
              Quando o salão liberar horários, eles aparecem aqui. Você também pode solicitar um agendamento nos serviços.
            </p>
          </div>
        ) : (
          Object.entries(grupos).map(([dia, hrs]) => (
            <div key={dia}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">{dia}</p>
              <div className="flex flex-col gap-2">
                {hrs.map(h => {
                  const jaReservado = reservados.has(h.id)
                  return (
                    <div key={h.id} className="bg-white rounded-2xl px-4 py-4 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cor}15` }}>
                        <Clock size={20} style={{ color: cor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-base">
                          {new Date(h.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {h.profiles?.nome && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <User size={11} />{h.profiles.nome}
                          </p>
                        )}
                        {h.observacao && (
                          <p className="text-xs text-gray-400 mt-0.5">{h.observacao}</p>
                        )}
                        <p className="text-xs text-gray-300 mt-0.5">{formatarDuracao(h.duracao_minutos)}</p>
                      </div>
                      {jaReservado ? (
                        <div className="flex items-center gap-1 text-green-500 shrink-0">
                          <CheckCircle size={18} />
                          <span className="text-xs font-semibold">Reservado!</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => reservarHorario(h)}
                          disabled={reservando === h.id}
                          className="px-4 py-2 rounded-xl text-white text-sm font-bold shrink-0 active:scale-95 transition-all"
                          style={{ backgroundColor: cor }}>
                          {reservando === h.id
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : 'Reservar'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
