'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { Scissors, Phone, MapPin, Instagram, Palette } from 'lucide-react'

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

export default function CriarSalaoPage() {
  const { profile } = useAuth()
  const [nome, setNome] = useState('')
  const [nomeDono, setNomeDono] = useState('')
  const [telefone, setTelefone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [cidade, setCidade] = useState('')
  const [corPrimaria, setCorPrimaria] = useState('#E91E8C')
  const [corSecundaria, setCorSecundaria] = useState('#FCE4F3')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  function gerarSlug(n: string) {
    return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Math.random().toString(36).substr(2, 5)
  }

  async function handleCriar() {
    if (!nome || !nomeDono || !telefone || !cidade) { setErro('Preencha todos os campos.'); return }
    setSalvando(true); setErro('')
    const { data: salao, error } = await supabase.from('saloes').insert({
      nome, slug: gerarSlug(nome), telefone, instagram: instagram || null, cidade,
      dono_id: profile?.id, cor_primaria: corPrimaria, cor_secundaria: corSecundaria,
      ativo: true, pausado: false, aprovado: false
    }).select().single()
    if (error) { setErro('Erro ao criar salao.'); setSalvando(false); return }
    await supabase.from('profiles').update({ nome: nomeDono, salao_id: salao.id }).eq('id', profile?.id)
    setSalvando(false); setEnviado(true)
  }

  if (enviado) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-6 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: corSecundaria }}>
        <Scissors size={36} style={{ color: corPrimaria }} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Salao cadastrado!</h2>
      <p className="text-gray-500">Seu salao foi enviado para analise. Voce sera notificado quando for aprovado.</p>
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 w-full">
        <p className="text-blue-700 text-sm font-medium">Aguardando aprovacao do administrador</p>
        <p className="text-blue-500 text-xs mt-1">Normalmente aprovamos em ate 24 horas.</p>
      </div>
      <button onClick={() => window.location.href = '/aguardando'} className="btn-primary" style={{ backgroundColor: corPrimaria }}>
        Ver status
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-gray-900 px-6 pt-12 pb-8 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mb-3">
          <Scissors size={26} className="text-gray-900" />
        </div>
        <h1 className="text-white text-xl font-bold">Crie seu Salao</h1>
        <p className="text-gray-400 text-sm mt-1">Configure as informacoes do seu espaco</p>
      </div>

      <div className="flex-1 px-6 py-6 flex flex-col gap-4 pb-8">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do Salao *</label>
          <input className="input-field" placeholder="Ex: Studio Beleza" value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Seu nome *</label>
          <input className="input-field" placeholder="Nome completo do dono" value={nomeDono} onChange={e => setNomeDono(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Telefone / WhatsApp *</label>
          <div className="relative">
            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" type="tel" placeholder="(11) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Instagram <span className="text-gray-400 text-xs">(recomendado)</span></label>
          <div className="relative">
            <Instagram size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" placeholder="@seusalao" value={instagram} onChange={e => setInstagram(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Cidade *</label>
          <div className="relative">
            <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" placeholder="Sua cidade" value={cidade} onChange={e => setCidade(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><Palette size={16} />Paleta de Cores</label>
          <div className="grid grid-cols-4 gap-3 mt-2">
            {CORES.map(c => (
              <button key={c.primaria} onClick={() => { setCorPrimaria(c.primaria); setCorSecundaria(c.secundaria) }} className="flex flex-col items-center gap-1">
                <div className={'w-12 h-12 rounded-full border-4 transition-all ' + (corPrimaria === c.primaria ? 'border-gray-800 scale-110' : 'border-transparent')} style={{ backgroundColor: c.primaria }} />
                <span className="text-xs text-gray-500">{c.nome}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: corSecundaria }}>
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: corPrimaria }} />
            <p className="text-sm font-medium" style={{ color: corPrimaria }}>Previa das cores</p>
          </div>
        </div>
        {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-red-600 text-sm text-center">{erro}</p></div>}
        <button className="btn-primary" onClick={handleCriar} disabled={salvando} style={{ backgroundColor: corPrimaria }}>
          {salvando ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Enviar para aprovacao'}
        </button>
      </div>
    </div>
  )
}
