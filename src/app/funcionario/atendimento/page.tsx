'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Upload, Sparkles, CheckCircle2, User, Scissors } from 'lucide-react'

export default function RegistrarFotosAtendimentoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [clienteId, setClienteId] = useState('')
  const [servicoNome, setServicoNome] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [fotoAntes, setFotoAntes] = useState<File | null>(null)
  const [fotoDepois, setFotoDepois] = useState<File | null>(null)
  const [previewAntes, setPreviewAntes] = useState<string | null>(null)
  const [previewDepois, setPreviewDepois] = useState<string | null>(null)

  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    const [salRes, cliRes] = await Promise.all([
      supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
      supabase.from('profiles').select('*').eq('salao_id', profile!.salao_id!).eq('role', 'cliente')
    ])

    setSalao(salRes.data)
    setClientes(cliRes.data || [])
    setCarregando(false)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>, tipo: 'antes' | 'depois') {
    const file = e.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    if (tipo === 'antes') {
      setFotoAntes(file)
      setPreviewAntes(previewUrl)
    } else {
      setFotoDepois(file)
      setPreviewDepois(previewUrl)
    }
  }

  async function uploadImagem(file: File) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `evolucao/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('atendimentos')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('atendimentos')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteId) return alert('Selecione a cliente!')
    if (!previewAntes && !previewDepois) return alert('Anexe pelo menos uma foto (Antes ou Depois).')

    setSalvando(true)

    try {
      let urlAntes = null
      let urlDepois = null

      if (fotoAntes) urlAntes = await uploadImagem(fotoAntes)
      if (fotoDepois) urlDepois = await uploadImagem(fotoDepois)

      const { error } = await supabase.from('atendimento_fotos').insert([{
        salao_id: profile!.salao_id,
        cliente_id: clienteId,
        servico_nome: servicoNome.trim() || 'Atendimento Geral',
        foto_antes: urlAntes,
        foto_depois: urlDepois,
        observacoes: observacoes.trim()
      }])

      if (error) throw error

      alert('Evolução registrada com sucesso! A cliente já pode visualizar no perfil dela.')
      router.back()
    } catch (err: any) {
      alert('Erro ao salvar fotos: ' + (err.message || 'Tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: cor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Camera size={22} style={{ color: cor }} />
            <h1 className="font-bold text-gray-900 text-lg">Antes & Depois</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSalvar} className="p-4 max-w-lg mx-auto space-y-5">

        {/* SELEÇÃO DA CLIENTE E SERVIÇO */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <User size={15} style={{ color: cor }} /> Cliente *
            </label>
            <select
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none bg-white">
              <option value="">Selecione a cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome || c.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <Scissors size={15} style={{ color: cor }} /> Serviço / Procedimento
            </label>
            <input
              type="text"
              placeholder="Ex: Mechas Morena Iluminada / Limpeza de Pele"
              value={servicoNome}
              onChange={e => setServicoNome(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* CARDS DE FOTO (ANTES x DEPOIS) */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* FOTO ANTES */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-center flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-500 mb-2 block">1. ANTES 📸</span>
            
            {previewAntes ? (
              <div className="relative h-40 w-full rounded-2xl overflow-hidden border">
                <img src={previewAntes} alt="Antes" className="w-full h-full object-cover" />
                <label className="absolute bottom-2 right-2 bg-black/60 text-white p-1.5 rounded-full cursor-pointer">
                  <Upload size={14} />
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, 'antes')} />
                </label>
              </div>
            ) : (
              <label className="h-40 w-full rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50/50 flex flex-col items-center justify-center cursor-pointer p-3 hover:bg-pink-50 transition-colors">
                <Camera size={26} className="text-pink-400 mb-1" />
                <span className="text-[11px] font-bold text-pink-600">Tirar / Anexar Foto</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, 'antes')} />
              </label>
            )}
          </div>

          {/* FOTO DEPOIS */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-center flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-500 mb-2 block">2. DEPOIS ✨</span>
            
            {previewDepois ? (
              <div className="relative h-40 w-full rounded-2xl overflow-hidden border">
                <img src={previewDepois} alt="Depois" className="w-full h-full object-cover" />
                <label className="absolute bottom-2 right-2 bg-black/60 text-white p-1.5 rounded-full cursor-pointer">
                  <Upload size={14} />
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, 'depois')} />
                </label>
              </div>
            ) : (
              <label className="h-40 w-full rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50/50 flex flex-col items-center justify-center cursor-pointer p-3 hover:bg-pink-50 transition-colors">
                <Sparkles size={26} className="text-pink-400 mb-1" />
                <span className="text-[11px] font-bold text-pink-600">Tirar / Anexar Foto</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, 'depois')} />
              </label>
            )}
          </div>

        </div>

        {/* OBSERVAÇÕES */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <label className="block text-xs font-bold text-gray-700 mb-1">Observações do Procedimento</label>
          <textarea
            rows={3}
            placeholder="Ex: Utilizado tom 7.3, tempo de pausa 45min, tratamento de reconstrução pós-química."
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none"
          />
        </div>

        {/* BOTÃO SALVAR */}
        <button
          type="submit"
          disabled={salvando}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
          style={{ backgroundColor: cor }}>
          {salvando ? 'Salvando fotos...' : 'Salvar e Disponibilizar para Cliente'}
        </button>

      </form>
    </div>
  )
}
