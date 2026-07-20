'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Clock, CheckCircle, XCircle, User } from 'lucide-react'

const DIAS = [
  { key: 'segunda', label: 'Segunda-feira', abrev: 'SEG' },
  { key: 'terca', label: 'Terça-feira', abrev: 'TER' },
  { key: 'quarta', label: 'Quarta-feira', abrev: 'QUA' },
  { key: 'quinta', label: 'Quinta-feira', abrev: 'QUI' },
  { key: 'sexta', label: 'Sexta-feira', abrev: 'SEX' },
  { key: 'sabado', label: 'Sábado', abrev: 'SÁB' },
  { key: 'domingo', label: 'Domingo', abrev: 'DOM' },
]

const CHAVE_DIA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

export default function ClienteHorariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [horarios, setHorarios] = useState<Record<string, any>>({})
  const [vagos, setVagos] = useState<any[]>([])
  const [reservando, setReservando] = useState<string | null>(null)
  const [reservados, setReservados] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'vagas' | 'funcionamento'>('vagas')

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase
      .from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    if (!cli) { setCarregando(false); return }
    setCliente(cli)
    setSalao(cli.saloes)
    setHorarios(cli.saloes?.horarios_funcionamento || {})

    const agora = new Date().toISOString()
    const { data: hrs } = await supabase
      .from('horarios_vagos')
      .select('*, profiles(nome)')
      .eq('salao_id', cli.saloes.id)
      .eq('reservado', false)
      .gte('data_hora', agora)
      .order('data_hora')
    setVagos(hrs || [])
    setCarregando(false)
  }

  async function reservarHorario(horario: any) {
    if (reservados.has(horario.id) || reservando === horario.id) return
    setReservando(horario.id)
    await supabase.from('horarios_vagos').update({
      reservado: true, cliente_id: cliente.id
    }).eq('id', horario.id)
await notificar({
  salaoId: salao.id,
  remetenteId: profile!.id,
  destinatarioId: salao.dono_id,
  titulo: 'Horário reservado!',
  mensagem: `${cliente.nome} reservou o horário de ${formatarDataHora(horario.data_hora)}.`,
  tipo: 'horario',
  url: '/salao/agenda'
})
setReservados(prev => new Set(Array.from(prev).concat(horario.id)))
setVagos(prev => prev.filter(h => h.id !== horario.id))
setReservando(null)
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

  const cor = salao?.cor_primaria || '#E91E8C'
  const diaHojeKey = CHAVE_DIA[new Date().getDay()]
  const hojeH = horarios[diaHojeKey]

  const hojeAberto = () => {
    if (!hojeH || !hojeH.ativo) return false
    const agora = new Date()
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
    const noManha = hojeH.manha_inicio && hojeH.manha_fim && horaAtual >= hojeH.manha_inicio && horaAtual <= hojeH.manha_fim
    const naTarde = hojeH.tarde_inicio && hojeH.tarde_fim && horaAtual >= hojeH.tarde_inicio && horaAtual <= hojeH.tarde_fim
    return noManha || naTarde
  }

  const gruposVagos: Record<string, any[]> = {}
  vagos.forEach(h => {
    const dia = new Date(h.data_hora).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!gruposVagos[dia]) gruposVagos[dia] = []
    gruposVagos[dia].push(h)
  })

  const aberto = hojeAberto()

  if (loading || carregando) return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Horários</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-4 animate-pulse h-20" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header igual ao de serviços */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between" style={{ backgroundColor: cor }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
          <h1 className="font-bold text-white text-lg">Horários</h1>
        </div>
      </div>

      {/* Abas igual ao de serviços/pacotes */}
      <div className="bg-white border-b border-gray-100 flex">
        <button onClick={() => setAba('vagas')}
          className={'flex-1 py-3 text-sm font-semibold transition-all ' + (aba === 'vagas' ? 'border-b-2' : 'text-gray-400')}
          style={aba === 'vagas' ? { color: cor, borderColor: cor } : {}}>
          Vagas {vagos.length > 0 && `(${vagos.length})`}
        </button>
        <button onClick={() => setAba('funcionamento')}
          className={'flex-1 py-3 text-sm font-semibold transition-all ' + (aba === 'funcionamento' ? 'border-b-2' : 'text-gray-400')}
          style={aba === 'funcionamento' ? { color: cor, borderColor: cor } : {}}>
          Funcionamento
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* ABA VAGAS */}
        {aba === 'vagas' && (
          vagos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${cor}15` }}>
                <Clock size={20} style={{ color: cor }} />
              </div>
              <p className="text-gray-500 text-sm font-medium">Nenhuma vaga disponível agora</p>
              <p className="text-gray-400 text-xs text-center leading-relaxed">
                Quando o salão liberar horários, eles aparecem aqui para você reservar
              </p>
            </div>
          ) : (
            Object.entries(gruposVagos).map(([dia, hrs]) => (
              <div key={dia} className="flex flex-col gap-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">{dia}</p>
                {hrs.map(h => {
                  const jaReservado = reservados.has(h.id)
                  return (
                    <div key={h.id} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cor}15` }}>
                        <span className="font-bold text-sm" style={{ color: cor }}>
                          {new Date(h.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {h.profiles?.nome && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <User size={11} />{h.profiles.nome}
                          </p>
                        )}
                        {h.observacao && (
                          <p className="text-xs text-gray-500 mt-0.5">{h.observacao}</p>
                        )}
                        <p className="text-xs text-gray-300">{formatarDuracao(h.duracao_minutos)}</p>
                      </div>
                      {jaReservado ? (
                        <div className="flex items-center gap-1 text-green-500 shrink-0">
                          <CheckCircle size={16} />
                          <span className="text-xs font-semibold">Reservado!</span>
                        </div>
                      ) : (
                        <button onClick={() => reservarHorario(h)} disabled={reservando === h.id}
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
            ))
          )
        )}

        {/* ABA FUNCIONAMENTO */}
        {aba === 'funcionamento' && (
          <>
            {/* Status hoje */}
            {hojeH && (
              <div className={'rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm ' +
                (aberto ? 'bg-green-50 border border-green-100' : 'bg-white border border-gray-100')}>
                {aberto
                  ? <CheckCircle size={20} className="text-green-500 shrink-0" />
                  : <XCircle size={20} className="text-gray-300 shrink-0" />}
                <div>
                  <p className={'font-bold ' + (aberto ? 'text-green-700' : 'text-gray-400')}>
                    {aberto ? 'Aberto agora' : !hojeH.ativo ? 'Fechado hoje' : 'Fora do horário'}
                  </p>
                  {hojeH.ativo && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {hojeH.manha_inicio && hojeH.manha_fim &&
                        `${hojeH.tarde_inicio ? 'Manhã: ' : ''}${hojeH.manha_inicio} – ${hojeH.manha_fim}`}
                      {hojeH.tarde_inicio && hojeH.tarde_fim &&
                        `  •  Tarde: ${hojeH.tarde_inicio} – ${hojeH.tarde_fim}`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tabela semanal */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {DIAS.map(({ key, label, abrev }, i) => {
                const h = horarios[key]
                const ehHoje = key === diaHojeKey
                return (
                  <div key={key}
                    className={'flex items-start gap-3 px-4 py-3 ' + (i < DIAS.length - 1 ? 'border-b border-gray-50' : '')}
                    style={ehHoje ? { backgroundColor: `${cor}08` } : {}}>
                    <div className={'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ' +
                      (ehHoje ? 'text-white' : 'text-gray-400 bg-gray-50')}
                      style={ehHoje ? { backgroundColor: cor } : {}}>
                      {abrev}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className={'text-sm font-semibold ' + (ehHoje ? 'text-gray-900' : 'text-gray-700')}>
                        {label}{ehHoje && <span className="text-xs font-normal text-gray-400"> (hoje)</span>}
                      </p>
                      {!h || !h.ativo ? (
                        <p className="text-xs text-gray-300 mt-0.5">Fechado</p>
                      ) : (
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          {h.manha_inicio && h.manha_fim && (
                            <p className="text-xs text-gray-500">
                              {h.tarde_inicio ? 'Manhã: ' : ''}{h.manha_inicio} – {h.manha_fim}
                            </p>
                          )}
                          {h.tarde_inicio && h.tarde_fim && (
                            <p className="text-xs text-gray-500">Tarde: {h.tarde_inicio} – {h.tarde_fim}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="pt-2">
                      <div className={'w-2 h-2 rounded-full ' + (h?.ativo ? 'bg-green-400' : 'bg-gray-200')} />
                    </div>
                  </div>
                )
              })}
            </div>

            {salao?.telefone && (
              <a href={`https://wa.me/55${salao.telefone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-medium text-sm"
                style={{ backgroundColor: cor }}>
                Falar no WhatsApp
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}