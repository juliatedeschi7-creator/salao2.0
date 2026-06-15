'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { Palette, MapPin, Instagram } from 'lucide-react'

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
    return n.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Math.random().toString(36).substr(2, 5)
  }

  async function handleCriar() {
    if (!nome || !nomeDono || !telefone || !cidade) {
      setErro('Preencha todos os campos obrigatorios.')
      return
    }
    setSalvando(true); setErro('')
    const { data: salao, error } = await supabase.from('saloes').insert({
      nome, slug: gerarSlug(nome), telefone,
      instagram: instagram || null, cidade,
      dono_id: profile?.id, cor_primaria: corPrimaria,
      cor_secundaria: corSecundaria, ativo: true, pausado: false, aprovado: false
    }).select().single()

    if (error) { setErro('Erro ao criar salao.'); setSalvando(false); return }
    await supabase.from('profiles').update({ nome: nomeDono, salao_id: salao.id }).eq('id', profile?.id)
    setSalvando(false); setEnviado(true)
  }

  if (enviado) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-6 text-center">
      <div className="w-28 h-28 rounded-3xl bg-white flex items-center justify-center shadow-lg p-2">
        <img src="/logo.png" alt="Organiza" className="w-full h-full object-contain" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Salao cadastrado!</h2>
      <p className="text-gray-500 text-sm leading-relaxed">
        Seu salao foi enviado para analise. Voce sera notificado quando for aprovado.
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 w-full max-w-sm">
        <p className="text-blue-700 text-sm font-medium">Aguardando aprovacao do administrador</p>
        <p className="text-blue-500 text-xs mt-1">Normalmente aprovamos em ate 24 horas.</p>
      </div>
      <button onClick={() => window.location.href = '/aguardando'}
        className="w-full max-w-sm bg-gray-900 text-white rounded-2xl py-4 font-semibold">
        Ver status
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-gray-900 px-6 pt-14 pb-10 flex flex-col items-center">
        <div className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center mb-4 shadow-lg p-2">
          <img src="/logo.png" alt="Organiza" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-white text-2xl font-bold">Crie seu Salao</h1>
        <p className="text-gray-400 text-sm mt-1">Configure as informacoes do seu espaco</p>
      </div>

      <div className="flex-1 px-6 py-6 flex flex-col gap-5 pb-10">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">
            Nome do Salao <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none focus:border-gray-900 transition-colors"
            placeholder="Ex: Studio Beleza"
            value={nome} onChange={e => setNome(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">
            Seu nome <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none focus:border-gray-900 transition-colors"
            placeholder="Nome completo do dono"
            value={nomeDono} onChange={e => setNomeDono(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">
            Telefone / WhatsApp <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none focus:border-gray-900 transition-colors"
            type="tel"
            placeholder="(11) 99999-9999"
            value={telefone} onChange={e => setTelefone(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">
            Instagram <span className="text-gray-400 text-xs font-normal">(recomendado)</span>
          </label>
          <div className="relative">
            <Instagram size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-11 pr-4 text-base outline-none focus:border-gray-900 transition-colors"
              placeholder="@seusalao"
              value={instagram} onChange={e => setInstagram(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">
            Cidade <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-11 pr-4 text-base outline-none focus:border-gray-900 transition-colors"
              placeholder="Sua cidade"
              value={cidade} onChange={e => setCidade(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Palette size={16} />Paleta de Cores do Salao
          </label>
          <div className="grid grid-cols-4 gap-3">
            {CORES.map(c => (
              <button key={c.primaria}
                onClick={() => { setCorPrimaria(c.primaria); setCorSecundaria(c.secundaria) }}
                className="flex flex-col items-center gap-1">
                <div
                  className={'w-14 h-14 rounded-full border-4 transition-all ' +
                    (corPrimaria === c.primaria ? 'border-gray-900 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c.primaria }}
                />
                <span className="text-xs text-gray-500">{c.nome}</span>
              </button>
            ))}
          </div>
          <div className="p-3 rounded-2xl flex items-center gap-3" style={{ backgroundColor: corSecundaria }}>
            <div className="w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: corPrimaria }} />
            <p className="text-sm font-medium" style={{ color: corPrimaria }}>Previa das cores do seu salao</p>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}

        <button onClick={handleCriar} disabled={salvando}
          className="w-full text-white rounded-2xl py-4 font-semibold text-base flex items-center justify-center active:scale-95 transition-all"
          style={{ backgroundColor: corPrimaria }}>
          {salvando
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Enviar para aprovacao'}
        </button>
      </div>
    </div>
  )
}
