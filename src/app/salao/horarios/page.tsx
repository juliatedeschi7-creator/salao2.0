cat > /mnt/user-data/outputs/salao-horarios-page.tsx << 'ENDOFFILE'
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Check } from 'lucide-react'

const DIAS = [
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

type HorarioDia = {
  ativo: boolean
  manha_inicio: string | null
  manha_fim: string | null
  tarde_inicio: string | null
  tarde_fim: string | null
  tem_tarde: boolean
}

const PADRAO: HorarioDia = {
  ativo: false,
  manha_inicio: '08:00',
  manha_fim: '12:00',
  tarde_inicio: '13:00',
  tarde_fim: '18:00',
  tem_tarde: true,
}

export default function HorariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [horarios, setHorarios] = useState<Record<string, HorarioDia>>({})
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const base: Record<string, HorarioDia> = {}
    DIAS.forEach(d => {
      const s = sal?.horarios_funcionamento?.[d.key]
      base[d.key] = s
        ? { ...PADRAO, ...s, tem_tarde: !!(s.tarde_inicio) }
        : { ...PADRAO }
    })
    setHorarios(base)
  }

  function atualizar(dia: string, campo: keyof HorarioDia, valor: any) {
    setHorarios(prev => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }))
  }

  async function salvar() {
    setSalvando(true)
    const payload: Record<string, any> = {}
    DIAS.forEach(d => {
      const h = horarios[d.key]
      payload[d.key] = {
        ativo: h.ativo,
        manha_inicio: h.ativo ? h.manha_inicio : null,
        manha_fim: h.ativo ? h.manha_fim : null,
        tarde_inicio: h.ativo && h.tem_tarde ? h.tarde_inicio : null,
        tarde_fim: h.ativo && h.tem_tarde ? h.tarde_fim : null,
      }
    })
    await supabase.from('saloes').update({ horarios_funcionamento: payload }).eq('id', profile!.salao_id!)
    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-10">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Horários de Funcionamento</h1>
        <button onClick={salvar} disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium"
          style={{ backgroundColor: cor }}>
          {salvo ? <><Check size={14} />Salvo!</> : salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <p className="text-xs text-gray-400 px-1">
          Ative os dias e defina os períodos. Ative "Intervalo de almoço" para separar manhã e tarde.
        </p>

        {DIAS.map(({ key, label }) => {
          const h = horarios[key]
          if (!h) return null
          return (
            <div key={key} className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <Clock size={16} style={{ color: h.ativo ? cor : '#d1d5db' }} />
                  <span className={'font-semibold text-sm ' + (h.ativo ? 'text-gray-900' : 'text-gray-400')}>
                    {label}
                  </span>
                </div>
                <button onClick={() => atualizar(key, 'ativo', !h.ativo)}
                  className={'relative w-12 h-6 rounded-full transition-colors ' + (h.ativo ? '' : 'bg-gray-200')}
                  style={h.ativo ? { backgroundColor: cor } : {}}>
                  <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' +
                    (h.ativo ? 'left-6' : 'left-0.5')} />
                </button>
              </div>

              {h.ativo && (
                <div className="px-4 py-3 flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                      {h.tem_tarde ? 'Período da manhã' : 'Horário de funcionamento'}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block">Início</label>
                        <input type="time" className="input-field text-sm py-2"
                          value={h.manha_inicio || ''}
                          onChange={e => atualizar(key, 'manha_inicio', e.target.value)} />
                      </div>
                      <span className="text-gray-300 mt-5">até</span>
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block">Fim</label>
                        <input type="time" className="input-field text-sm py-2"
                          value={h.manha_fim || ''}
                          onChange={e => atualizar(key, 'manha_fim', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Intervalo de almoço</p>
                      <p className="text-xs text-gray-400">Adicionar período da tarde separado</p>
                    </div>
                    <button onClick={() => atualizar(key, 'tem_tarde', !h.tem_tarde)}
                      className={'relative w-12 h-6 rounded-full transition-colors ' + (h.tem_tarde ? '' : 'bg-gray-200')}
                      style={h.tem_tarde ? { backgroundColor: cor } : {}}>
                      <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' +
                        (h.tem_tarde ? 'left-6' : 'left-0.5')} />
                    </button>
                  </div>

                  {h.tem_tarde && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Período da tarde</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-gray-400 mb-1 block">Início</label>
                          <input type="time" className="input-field text-sm py-2"
                            value={h.tarde_inicio || ''}
                            onChange={e => atualizar(key, 'tarde_inicio', e.target.value)} />
                        </div>
                        <span className="text-gray-300 mt-5">até</span>
                        <div className="flex-1">
                          <label className="text-xs text-gray-400 mb-1 block">Fim</label>
                          <input type="time" className="input-field text-sm py-2"
                            value={h.tarde_fim || ''}
                            onChange={e => atualizar(key, 'tarde_fim', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!h.ativo && (
                <div className="px-4 py-2">
                  <p className="text-xs text-gray-300">Fechado</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
ENDOFFILE