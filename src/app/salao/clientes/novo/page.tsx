'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User, Phone, Mail, Calendar } from 'lucide-react'

export default function NovoClientePage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSalvar() {
    if (!nome) { setErro('Nome é obrigatório.'); return }
    setSalvando(true)
    setErro('')

    const { error } = await supabase.from('clientes').insert({
      salao_id: profile!.salao_id,
      nome,
      telefone: telefone || null,
      email: email || null,
      data_nascimento: dataNascimento || null,
      observacoes: observacoes || null,
    })

    if (error) {
      setErro('Erro ao salvar cliente.')
      setSalvando(false)
      return
    }

    router.push('/salao/clientes')
  }

  return (
    <div className="min-h-screen bg-[#f8f4f6]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg">Nova Cliente</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 pb-8">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Nome completo <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" placeholder="Nome da cliente"
              value={nome} onChange={e => setNome(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Telefone</label>
          <div className="relative">
            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" placeholder="(11) 99999-9999"
              type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" placeholder="email@exemplo.com"
              type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Data de nascimento
          </label>
          <div className="relative">
            <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" type="date"
              value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Observações</label>
          <textarea className="input-field resize-none" rows={3}
            placeholder="Alergias, preferências..."
            value={observacoes} onChange={e => setObservacoes(e.target.value)} />
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}

        <button onClick={handleSalvar} disabled={salvando} className="btn-primary">
          {salvando
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Salvar Cliente'}
        </button>
      </div>
    </div>
  )
}
