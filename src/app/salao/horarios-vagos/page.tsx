'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Plus, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react'

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

export default function SalaoHorariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)

  // ── Horários vagos ────────────────────────────────────────────
  const [vagos, setVagos] = useState<any[]>([])
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [modalVago, setModalVago] = useState(false)
  const [salvandoVago, setSalvandoVago] = useState(false)
  const [formVago, setFormVago] = useState({
    data: '', hora: '', duracao_minutos: 60,
    profissional_id: '', observacao: ''
  })

  // ── Funcionamento ─────────────────────────────────────────────
  const [horarios, setHorarios] = useState<Record<string, HorarioDia>>({})
  const [salvandoFunc, setSalvandoFunc] = useState(false)
  const [salvouFunc, setSalvouFunc] = useState(false)
  const [secaoAberta, setSecaoAberta] = useState<'vagos' | 'funcionamento'>('vagos')

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    // Horários de funcionamento
    const base: Record<string, HorarioDia> = {}
    DIAS.forEach(d => {
      const s = sal?.horarios_funcionamento?.[d.key]
      base[d.key] = s
        ? { ...PADRAO, ...s, tem_tarde: !!(s.tarde_inicio) }
        : { ...PADRAO }
    })
    setHorarios(base)

    // Horários vagos futuros
    const agora = new Date().toISOString()
    const { data: hrs } = await supabase
      .from('horarios_vagos')
      .select('*, profiles(nome), clientes(nome)')
      .eq('salao_id', profile!.salao_id!)
      .gte('data_hora', agora)
      .order('data_hora')
    setVagos(hrs || [])

    // Funcionários
    const { data: funcs } = await supabase
      .from('profiles').select('id, nome')
      .eq('salao_id', profile!.salao_id!)
      .in('role', ['funcionario', 'dono_salao'])
    setFuncionarios(funcs || [])
  }

  // ── Ações horários vagos ──────────────────────────────────────
  async function liberarHorario() {
    if (!formVago.data || !formVago.hora) return
    setSalvandoVago(true)
    const dataHora = new Date(`${formVago.data}T${formVago.hora}:00`).toISOString()
    const { error } = await supabase.from('horarios_vagos').insert({
      salao_id: profile!.salao_id,
      data_hora: dataHora,
      duracao_minutos: formVago.duracao_minutos,
      profissional_id: formVago.profissional_id || null,
      observacao: formVago.observacao || null,
    })
    if (error) { alert('Erro: ' + error.message); setSalvandoVago(false); return }
    setModalVago(false)
    setFormVago({ data: '', hora: '', duracao_minutos: 60, profissional_id: '', observacao: '' })
    setSalvandoVago(false)
    carregarDados()
  }

  async function excluirVago(id: string) {
    await supabase.from('horarios_vagos').delete().eq('id', id)
    carregarDados()
  }

  // ── Ações funcionamento ───────────────────────────────────────
  function atualizarDia(dia: string, campo: keyof HorarioDia, valor: any) {
    setHorarios(prev => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }))
  }

  async function salvarFuncionamento() {
    setSalvandoFunc(true)
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
    setSalvandoFunc(false)
    setSalvouFunc(true)
    setTimeout(() => setSalvouFunc(false), 2500)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const vagosLivres = vagos.filter(h => !h.reservado)
  const vagosReservados = vagos.filter(h => h.reservado)

  function formatarDuracao(min: number) {
    if (min < 60) return `${min} min`
    const h = Math.floor(min / 60), m = min % 60
    return m === 0 ? `${h}h` : `${h}h${m}min`
  }

  function formatarDataHora(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      weekday: 'short', day: 'numeric', month: 'short'
    }) + ' · ' + new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-10">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Horários</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {/* ── SEÇÃO HORÁRIOS VAGOS ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setSecaoAberta(secaoAberta === 'vagos' ? 'funcionamento' : 'vagos')}
            className="w-full flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${cor}15` }}>
                <Clock size={18} style={{ color: cor }} />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">Horários Vagos</p>
                <p className="text-xs text-gray-400">
                  {vagosLivres.length} disponível(is) · {vagosReservados.length} reservado(s)
                </p>
              </div>
            </div>
            {secaoAberta === 'vagos'
              ? <ChevronUp size={18} className="text-gray-400" />
              : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {secaoAberta === 'vagos' && (
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-50 pt-3">
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 leading-relaxed">
                Libere horários disponíveis e suas clientes poderão reservar diretamente pelo app.
              </div>

              <button onClick={() => setModalVago(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
                style={{ backgroundColor: cor }}>
                <Plus size={15} />Liberar horário vago
              </button>

              {vagosLivres.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Disponíveis ({vagosLivres.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {vagosLivres.map(h => (
                      <div key={h.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{formatarDataHora(h.data_hora)}</p>
                          <p className="text-xs text-gray-400">
                            {formatarDuracao(h.duracao_minutos)}
                            {h.profiles?.nome ? ` · ${h.profiles.nome}` : ''}
                            {h.observacao ? ` · ${h.observacao}` : ''}
                          </p>
                        </div>
                        <button onClick={() => excluirVago(h.id)}
                          className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {vagosReservados.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Reservados ({vagosReservados.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {vagosReservados.map(h => (
                      <div key={h.id} className="flex items-center gap-3 bg-green-50 rounded-xl px-3 py-3">
                        <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                          <Check size={14} className="text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{formatarDataHora(h.data_hora)}</p>
                          <p className="text-xs text-green-600 font-medium">
                            Reservado por {h.clientes?.nome || 'cliente'}
                          </p>
                        </div>
                        <button onClick={() => excluirVago(h.id)}
                          className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {vagos.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm">Nenhum horário liberado ainda</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SEÇÃO FUNCIONAMENTO ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setSecaoAberta(secaoAberta === 'funcionamento' ? 'vagos' : 'funcionamento')}
            className="w-full flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${cor}15` }}>
                <Clock size={18} style={{ color: cor }} />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">Horários de Funcionamento</p>
                <p className="text-xs text-gray-400">
                  Dias e horários que o salão atende
                </p>
              </div>
            </div>
            {secaoAberta === 'funcionamento'
              ? <ChevronUp size={18} className="text-gray-400" />
              : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {secaoAberta === 'funcionamento' && (
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-50 pt-3">
              <p className="text-xs text-gray-400">
                Ative os dias e defina os períodos. Ative "Intervalo de almoço" para separar manhã e tarde.
              </p>

              {DIAS.map(({ key, label }) => {
                const h = horarios[key]
                if (!h) return null
                return (
                  <div key={key} className="bg-gray-50 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Clock size={15} style={{ color: h.ativo ? cor : '#d1d5db' }} />
                        <span className={'text-sm font-semibold ' + (h.ativo ? 'text-gray-900' : 'text-gray-400')}>
                          {label}
                        </span>
                      </div>
                      <button onClick={() => atualizarDia(key, 'ativo', !h.ativo)}
                        className={'relative w-11 h-6 rounded-full transition-colors ' + (h.ativo ? '' : 'bg-gray-200')}
                        style={h.ativo ? { backgroundColor: cor } : {}}>
                        <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' +
                          (h.ativo ? 'left-5' : 'left-0.5')} />
                      </button>
                    </div>

                    {h.ativo && (
                      <div className="px-4 pb-3 flex flex-col gap-3">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                            {h.tem_tarde ? 'Período da manhã' : 'Funcionamento'}
                          </p>
                          <div className="flex items-center gap-2">
                            <input type="time" className="input-field flex-1 text-sm py-2"
                              value={h.manha_inicio || ''}
                              onChange={e => atualizarDia(key, 'manha_inicio', e.target.value)} />
                            <span className="text-gray-300 text-xs">até</span>
                            <input type="time" className="input-field flex-1 text-sm py-2"
                              value={h.manha_fim || ''}
                              onChange={e => atualizarDia(key, 'manha_fim', e.target.value)} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Intervalo de almoço</p>
                            <p className="text-xs text-gray-400">Período da tarde separado</p>
                          </div>
                          <button onClick={() => atualizarDia(key, 'tem_tarde', !h.tem_tarde)}
                            className={'relative w-11 h-6 rounded-full transition-colors ' + (h.tem_tarde ? '' : 'bg-gray-200')}
                            style={h.tem_tarde ? { backgroundColor: cor } : {}}>
                            <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' +
                              (h.tem_tarde ? 'left-5' : 'left-0.5')} />
                          </button>
                        </div>

                        {h.tem_tarde && (
                          <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Período da tarde</p>
                            <div className="flex items-center gap-2">
                              <input type="time" className="input-field flex-1 text-sm py-2"
                                value={h.tarde_inicio || ''}
                                onChange={e => atualizarDia(key, 'tarde_inicio', e.target.value)} />
                              <span className="text-gray-300 text-xs">até</span>
                              <input type="time" className="input-field flex-1 text-sm py-2"
                                value={h.tarde_fim || ''}
                                onChange={e => atualizarDia(key, 'tarde_fim', e.target.value)} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!h.ativo && (
                      <div className="px-4 pb-2">
                        <p className="text-xs text-gray-300">Fechado</p>
                      </div>
                    )}
                  </div>
                )
              })}

              <button onClick={salvarFuncionamento} disabled={salvandoFunc}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ backgroundColor: cor }}>
                {salvouFunc ? '✓ Salvo!' : salvandoFunc ? 'Salvando...' : 'Salvar horários'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal liberar horário vago */}
      {modalVago && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">Liberar horário vago</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Data *</label>
                <input className="input-field" type="date"
                  value={formVago.data}
                  onChange={e => setFormVago(p => ({ ...p, data: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Horário *</label>
                <input className="input-field" type="time"
                  value={formVago.hora}
                  onChange={e => setFormVago(p => ({ ...p, hora: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Duração (minutos)</label>
              <input className="input-field" type="number"
                value={formVago.duracao_minutos}
                onChange={e => setFormVago(p => ({ ...p, duracao_minutos: parseInt(e.target.value) || 60 }))} />
            </div>

            {funcionarios.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Profissional (opcional)</label>
                <select className="input-field" value={formVago.profissional_id}
                  onChange={e => setFormVago(p => ({ ...p, profissional_id: e.target.value }))}>
                  <option value="">Qualquer profissional</option>
                  {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Observação (opcional)</label>
              <input className="input-field" placeholder="Ex: Disponível para manicure"
                value={formVago.observacao}
                onChange={e => setFormVago(p => ({ ...p, observacao: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalVago(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={liberarHorario}
                disabled={salvandoVago || !formVago.data || !formVago.hora}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-40"
                style={{ backgroundColor: cor }}>
                {salvandoVago ? 'Salvando...' : 'Liberar horário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
