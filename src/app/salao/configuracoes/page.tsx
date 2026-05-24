'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Palette, Clock, Calendar } from 'lucide-react'

const CORES = [
  { primaria: '#E91E8C', secundaria: '#FCE4F3', nome: 'Rosa' },
  { primaria: '#9C27B0', secundaria: '#F3E5F5', nome: 'Roxo' },
  { primaria: '#E91E63', secundaria: '#FCE4EC', nome: 'Pink' },
  { primaria: '#FF5722', secundaria: '#FBE9E7', nome: 'Laranja' },
  { primaria: '#009688', secundaria: '#E0F2F1', nome: 'Verde' },
  { primaria: '#1976D2', secundaria: '#E3F2FD', nome: 'Azul' },
  { primaria: '#5D4037', secundaria: '#EFEBE9', nome: 'Marrom' },
  { primaria: '#455A64', secundaria: '#ECEFF1', nome: 'Grafite' },
]

const DIAS = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sab' }, { key: 'dom', label: 'Dom' },
]

export default function ConfiguracoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', telefone: '', instagram: '', cidade: '', cor_primaria: '#E91E8C', cor_secundaria: '#FCE4F3', horario_abertura: '08:00', horario_fechamento: '18:00', dias_funcionamento: ['seg', 'ter', 'qua', 'qui', 'sex'] as string[] })
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    if (sal) setForm({ nome: sal.nome, telefone: sal.telefone || '', instagram: sal.instagram || '', cidade: sal.cidade || '', cor_primaria: sal.cor_primaria, cor_secundaria: sal.cor_secundaria, horario_abertura: sal.horario_abertura || '08:00', horario_fechamento: sal.horario_fechamento || '18:00', dias_funcionamento: sal.dias_funcionamento || ['seg', 'ter', 'qua', 'qui', 'sex'] })
  }

  function toggleDia(dia: string) {
    setForm(p => ({ ...p, dias_funcionamento: p.dias_funcionamento.includes(dia) ? p.dias_funcionamento.filter(d => d !== dia) : [...p.dias_funcionamento, dia] }))
  }

  async function handleSalvar() {
    setSalvando(true)
    await supabase.from('saloes').update({ nome: form.nome, telefone: form.telefone || null, instagram: form.instagram || null, cidade: form.cidade || null, cor_primaria: form.cor_primaria, cor_secundaria: form.cor_secundaria, horario_abertura: form.horario_abertura, horario_fechamento: form.horario_fechamento, dias_funcionamento: form.dias_funcionamento }).eq('id', salao.id)
    setSalvando(false); setSucesso(true)
    setTimeout(() => setSucesso(false), 3000)
    carregarDados()
  }

  const cor = form.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Configuracoes</h1>
        <button onClick={handleSalvar} disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: cor }}>
          <Save size={14} />{salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 pb-8">
        {sucesso && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3"><p className="text-green-600 text-sm text-center">Configuracoes salvas!</p></div>}

        <div className="card flex flex-col gap-4">
          <p className="font-bold text-gray-900">Informacoes do Salao</p>
          <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nome do Salao</label><input className="input-field" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
          <div><label className="text-sm font-medium text-gray-700 mb-1 block">Telefone</label><input className="input-field" type="tel" value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} /></div>
          <div><label className="text-sm font-medium text-gray-700 mb-1 block">Instagram</label><input className="input-field" placeholder="@seusalao" value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} /></div>
          <div><label className="text-sm font-medium text-gray-700 mb-1 block">Cidade</label><input className="input-field" value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} /></div>
        </div>

        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2"><Palette size={18} style={{ color: cor }} /><p className="font-bold text-gray-900">Paleta de Cores</p></div>
          <div className="grid grid-cols-4 gap-3">
            {CORES.map(c => (
              <button key={c.primaria} onClick={() => setForm(p => ({ ...p, cor_primaria: c.primaria, cor_secundaria: c.secundaria }))} className="flex flex-col items-center gap-1">
                <div className={'w-12 h-12 rounded-full border-4 transition-all ' + (form.cor_primaria === c.primaria ? 'border-gray-800 scale-110' : 'border-transparent')} style={{ backgroundColor: c.primaria }} />
                <span className="text-xs text-gray-500">{c.nome}</span>
              </button>
            ))}
          </div>
          <div className="p-3 rounded-xl" style={{ backgroundColor: form.cor_secundaria }}>
            <p className="text-sm font-medium text-center" style={{ color: cor }}>Previa das cores</p>
          </div>
        </div>

        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2"><Clock size={18} style={{ color: cor }} /><p className="font-bold text-gray-900">Horario de Funcionamento</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Abertura</label><input className="input-field" type="time" value={form.horario_abertura} onChange={e => setForm(p => ({ ...p, horario_abertura: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Fechamento</label><input className="input-field" type="time" value={form.horario_fechamento} onChange={e => setForm(p => ({ ...p, horario_fechamento: e.target.value }))} /></div>
          </div>
        </div>

        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2"><Calendar size={18} style={{ color: cor }} /><p className="font-bold text-gray-900">Dias de Funcionamento</p></div>
          <div className="flex gap-2">
            {DIAS.map(d => (
              <button key={d.key} onClick={() => toggleDia(d.key)}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                style={form.dias_funcionamento.includes(d.key) ? { backgroundColor: cor, color: 'white' } : { backgroundColor: '#f3f4f6', color: '#9ca3af' }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
