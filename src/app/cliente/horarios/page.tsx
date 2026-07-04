'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, CheckCircle, XCircle } from 'lucide-react'

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
  const [horarios, setHorarios] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase
      .from('clientes').select('salao_id, saloes(*)').eq('profile_id', profile!.id).single()
    if (cli?.saloes) {
      setSalao(cli.saloes)
      setHorarios((cli.saloes as any).horarios_funcionamento || {})
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const diaHojeKey = CHAVE_DIA[new Date().getDay()]

  const hojeAberto = () => {
    const h = horarios[diaHojeKey]
    if (!h || !h.ativo) return false
    const agora = new Date()
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
    const noManha = h.manha_inicio && h.manha_fim && horaAtual >= h.manha_inicio && horaAtual <= h.manha_fim
    const naTarde = h.tarde_inicio && h.tarde_fim && horaAtual >= h.tarde_inicio && horaAtual <= h.tarde_fim
    return noManha || naTarde
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  const aberto = hojeAberto()
  const hojeH = horarios[diaHojeKey]

  return (
    <div className="min-h-screen bg-[#f0f0f5] pb-10">
      <div className="px-4 pt-12 pb-6" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()} className="mb-4 flex items-center gap-2 text-white/80">
          <ArrowLeft size={20} />
          <span className="text-sm">Voltar</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Clock size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">Horários de Atendimento</h1>
            <p className="text-white/70 text-sm">{salao?.nome}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 flex flex-col gap-3 pb-6">
        {hojeH && (
          <div className={'rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm ' +
            (aberto ? 'bg-green-50 border border-green-100' : 'bg-white border border-gray-100')}>
            {aberto
              ? <CheckCircle size={22} className="text-green-500 shrink-0" />
              : <XCircle size={22} className="text-gray-300 shrink-0" />}
            <div>
              <p className={'font-bold text-base ' + (aberto ? 'text-green-700' : 'text-gray-400')}>
                {aberto ? 'Aberto agora' : !hojeH.ativo ? 'Fechado hoje' : 'Fora do horário'}
              </p>
              {hojeH.ativo && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {hojeH.manha_inicio && hojeH.manha_fim &&
                    `${hojeH.tarde_inicio ? 'Manhã: ' : ''}${hojeH.manha_inicio} – ${hojeH.manha_fim}`}
                  {hojeH.tarde_inicio && hojeH.tarde_fim &&
                    `  •  Tarde: ${hojeH.tarde_inicio} – ${hojeH.tarde_fim}`}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="font-bold text-gray-900 text-sm">Todos os horários</p>
          </div>
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
      </div>
    </div>
  )
}
