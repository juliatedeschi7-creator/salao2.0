'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { Scissors, Instagram, Phone, MapPin, Palette } from 'lucide-react'

const CORES_PRESET = [
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

  function selecionarCor(cor: typeof CORES_PRESET[0]) {
    setCorPrimaria(cor.primaria)
    setCorSecundaria(cor.secundaria)
  }

  function gerarSlug(nome: string) {
    return nome.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') +
      '-' + Math.random().toString(36).substr(2, 5)
  }

  async function handleCriar() {
    if (!nome || !nomeDono || !telefone || !cidade) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    setSalvando(true)
    setErro('')

    const slug = gerarSlug(nome)

    const { data: salao, error } = await supabase
      .from('saloes')
      .insert({
        nome,
        slug,
        telefone,
        instagram: instagram || null,
        cidade,
        dono_id: profile?.id,
        cor_primaria: corPrimaria,
        cor_secundaria: corSecundaria,
        ativo: true,
        pausado: false,
      })
      .select()
      .single()

    if (error) {
      setErro('Erro ao criar salão. Tente novamente.')
      setSalvando(false)
      return
    }

    await supabase.from('profiles').update({
      nome: nomeDono,
      salao_id: salao.id,
      aprovado: true,
    }).eq('id', profile?.id)

    window.location.href = '/salao'
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-6 py-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: corSecundaria }}>
          <Scissors size={28} style={{ color: corPrimaria }} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Crie seu Salão</h1>
        <p className="text-gray-500 text-sm mt-1 text-center">
          Configure as informações do seu espaço
        </p>
      </div>

      <div className="flex-1 px-6 flex flex-col gap-4 pb-8">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Nome do Salão <span className="text-red-400">*</span>
          </label>
          <input className="input-field" placeholder="Ex: Studio Beleza"
            value={nome} onChange={e => setNome(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Seu nome (dono) <span className="text-red-400">*</span>
          </label>
          <input className="input-field" placeholder="Seu nome completo"
            value={nomeDono} onChange={e => setNomeDono(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Telefone / WhatsApp <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" placeholder="(11) 99999-9999"
              type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Instagram <span className="text-gray-400 text-xs">(recomendado)</span>
          </label>
          <div className="relative">
            <Instagram size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" placeholder="@seusalao"
              value={instagram} onChange={e => setInstagram(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Cidade <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" placeholder="Sua cidade"
              value={cidade} onChange={e => setCidade(e.target.value)} />
          </div>
        </div>

        {/* Paleta de cores */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
            <Palette size={16} />
            Paleta de Cores do Salão
          </label>
          <div className="grid grid-cols-4 gap-3 mt-2">
            {CORES_PRESET.map(cor => (
              <button key={cor.primaria} onClick={() => selecionarCor(cor)}
                className="flex flex-col items-center gap-1">
                <div
                  className={`w-12 h-12 rounded-full border-4 transition-all ${corPrimaria === cor.primaria ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: cor.primaria }}
                />
                <span className="text-xs text-gray-500">{cor.nome}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-xl flex items-center gap-3"
            style={{ backgroundColor: corSecundaria }}>
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: corPrimaria }} />
            <p className="text-sm font-medium" style={{ color: corPrimaria }}>
              Prévia das cores do seu salão
            </p>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}

        <button className="btn-primary mt-2" onClick={handleCriar} disabled={salvando}
          style={{ backgroundColor: corPrimaria }}>
          {salvando
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : '✨ Criar meu Salão'}
        </button>
      </div>
    </div>
  )
}
