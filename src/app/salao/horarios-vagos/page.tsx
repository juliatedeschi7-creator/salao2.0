'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Clock, User, Check } from 'lucide-react'

export default function HorariosVagosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [horarios, setHorarios] = useState<any[]>([])
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    data: '', hora: '', duracao_minutos: 60,
    profissional_id: '', observacao: ''
  })

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const agora = new Date().toISOString()
    const { data: hrs } = await supabase
      .from('horarios_vagos')
      .select('*, profiles(nome), clientes(nome)')
      .eq('salao_id', profile!.salao_id!)
      .gte('data_hora', agora)
      .order('data_hora')
    setHorarios(hrs || [])

    const { data: funcs } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('salao_id', profile!.salao_id!)
      .in('role', ['funcionario', 'dono_salao'])
    setFuncionarios(funcs || [])
    setCarregando(false)
  }

  async function handleSalvar() {
    if (!form.data || !form.hora) return
    setSalvando(true)
    const dataHora = new Date(`${form.data}T${form.hora}:00`).toISOString()
    await supabase.from('horarios_vagos').insert({
      salao_id: profile!.salao_id,
      data_hora: dataHora,
      duracao_minutos: form.duracao_minutos,
      profissional_id: form.profissional_id || null,
      observacao: form.observacao || null,
    })
    setModal(false)
    setForm({ data: '', hora: '', duracao_minutos: 60, profissional_id: '', observacao: '' })
    setSalvando(false)
    carregarDados()
  }

  async function excluir(id: string) {
    await supabase.from('horarios_vagos').delete().eq('id', id)
    carregarDados()
  }

  function formatarDuracao(min: number) {
    if (min < 60) return `${min} min`
    const h = Math.floor(min / 60), m = min % 60
    return m === 0 ? (h === 1 ? '1 hora' : `${h} horas`) : `${h}h e ${m}min`
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const vagos = horarios.filter(h => !h.reservado)
  const reservados = horarios.filter(h => h.reservado)

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen pb-8 bg-[#f8f9fa]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Horários vagos</h1>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium"
          style={{ backgroundColor: cor }}>
          <Plus size={14} />Liberar horário
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Info */}
        <div className="bg-white rounded-2xl p-4 border-l-4 shadow-sm" style={{ borderColor: cor }}>
          <p className="text-sm font-semibold text-gray-800">Como funciona</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Libere horários vagos e suas clientes verão na página "Horários disponíveis". Com um toque elas reservam e você recebe uma notificação.
          </p>
        </div>

        {/* Vagos */}
        {vagos.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Disponíveis ({vagos.length})</p>
            <div className="flex flex-col gap-2">
              {vagos.map(h => (
                <div key={h.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cor}15` }}>
                    <Clock size={18} style={{ color: cor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {new Date(h.data_hora).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' · '}
                      {new Date(h.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatarDuracao(h.duracao_minutos)}
                      {h.profiles?.nome ? ` · ${h.profiles.nome}` : ''}
                    </p>
                    {h.observacao && <p className="text-xs text-gray-300 mt-0.5">{h.observacao}</p>}
                  </div>
                  <button onClick={() => excluir(h.id)} className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reservados */}
        {reservados.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Reservados ({reservados.length})</p>
            <div className="flex flex-col gap-2">
              {reservados.map(h => (
                <div key={h.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <Check size={18} className="text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {new Date(h.data_hora).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' · '}
                      {new Date(h.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-green-600 font-medium">
                      Reservado por {h.clientes?.nome || 'cliente'}
                    </p>
                  </div>
                  <button onClick={() => excluir(h.id)} className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {vagos.length === 0 && reservados.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
            <Clock size={36} className="text-gray-200" />
            <p className="text-gray-400 text-sm">Nenhum horário liberado ainda</p>
            <button onClick={() => setModal(true)}
              className="px-5 py-2.5 rounded-full text-white text-sm font-semibold"
              style={{ backgroundColor: cor }}>
              Liberar primeiro horário
            </button>
          </div>
        )}
      </div>

      {/* Modal novo horário */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">Liberar horário vago</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Data *</label>
                <input className="input-field" type="date" value={form.data}
                  onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                  style={{ colorScheme: 'light' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Horário *</label>
                <input className="input-field" type="time" value={form.hora}
                  onChange={e => setForm(p => ({ ...p, hora: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Duração (minutos)</label>
              <input className="input-field" type="number" value={form.duracao_minutos}
                onChange={e => setForm(p => ({ ...p, duracao_minutos: parseInt(e.target.value) }))} />
            </div>

            {funcionarios.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Profissional (opcional)</label>
                <select className="input-field" value={form.profissional_id}
                  onChange={e => setForm(p => ({ ...p, profissional_id: e.target.value }))}>
                  <option value="">Qualquer profissional</option>
                  {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Observação (opcional)</label>
              <input className="input-field" placeholder="Ex: Disponível para manicure ou sobrancelha"
                value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando || !form.data || !form.hora}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-40"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Liberar horário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
