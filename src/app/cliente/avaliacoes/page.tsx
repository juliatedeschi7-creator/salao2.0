// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Star, Send, Camera, Upload } from 'lucide-react'

export default function ClienteAvaliacoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [depoimentos, setDepoimentos] = useState<any[]>([])
  const [servicoId, setServicoId] = useState('')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  // Estados para gerenciar o upload da foto do salão
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const p = profile as any
  const ehDonoOuAdmin = profile && (['dono_salao', 'socio', 'admin'].includes(profile.tipo) || p?.acesso_total)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    if (profile.tipo === 'cliente') {
      const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
      setCliente(cli); setSalao(cli?.saloes)
      if (cli?.saloes?.id) {
        const { data: srvs } = await supabase.from('servicos').select('id, nome').eq('salao_id', cli.saloes.id).eq('ativo', true)
        setServicos(srvs || [])
        const { data: deps } = await supabase.from('depoimentos').select('*, clientes(nome), servicos(nome)')
          .eq('salao_id', cli.saloes.id).eq('publico', true).order('created_at', { ascending: false })
        setDepoimentos(deps || [])
      }
    } else if (ehDonoOuAdmin && profile.salao_id) {
      const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile.salao_id).single()
      setSalao(sal)
      const { data: srvs } = await supabase.from('servicos').select('id, nome').eq('salao_id', profile.salao_id).eq('ativo', true)
      setServicos(srvs || [])
      const { data: deps } = await supabase.from('depoimentos').select('*, clientes(nome), servicos(nome)')
        .eq('salao_id', profile.salao_id).eq('publico', true).order('created_at', { ascending: false })
      setDepoimentos(deps || [])
    }
  }

  async function enviarAvaliacao() {
    if (!texto || !salao) return
    setSalvando(true)
    await supabase.from('depoimentos').insert({
      salao_id: salao.id,
      cliente_id: cliente?.id || null,
      servico_id: servicoId || null,
      texto,
      publico: true
    })
    setTexto(''); setServicoId(''); setSalvando(false); setSucesso(true)
    carregarDados()
    setTimeout(() => setSucesso(false), 3000)
  }

  // Função para fazer upload da foto/logo do salão
  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !salao) return

    setUploadingFoto(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${salao.id}-${Math.random()}.${fileExt}`
      const filePath = `saloes-logos/${fileName}`

      const { error: uploadError } = await supabase.storage.from('saloes').upload(filePath, file)
      
      let fotoUrl = ''
      if (uploadError) {
        const { data: publicUrlData } = supabase.storage.from('public').getPublicUrl(filePath)
        fotoUrl = publicUrlData.publicUrl
      } else {
        const { data: publicUrlData } = supabase.storage.from('saloes').getPublicUrl(filePath)
        fotoUrl = publicUrlData.publicUrl
      }

      const { error: updateError } = await supabase
        .from('saloes')
        .update({ logo_url: fotoUrl })
        .eq('id', salao.id)

      if (updateError) {
        alert('Erro ao salvar foto no banco: ' + updateError.message)
      } else {
        setSalao((prev: any) => ({ ...prev, logo_url: fotoUrl }))
        alert('Foto do salão atualizada com sucesso!')
      }
    } catch (err: any) {
      alert('Erro ao enviar imagem: ' + (err.message || err))
    } finally {
      setUploadingFoto(false)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Topo personalizado com foto do salão e botão de alteração para o dono */}
      <div className="px-4 pt-10 pb-6 flex items-center justify-between shadow-sm" style={{ backgroundColor: cor }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
          <div className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-full bg-white/20 border border-white/40 overflow-hidden flex items-center justify-center shrink-0">
              {salao?.logo_url ? (
                <img src={salao.logo_url} alt="Logo do Salão" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">{salao?.nome?.charAt(0) || 'S'}</span>
              )}

              {ehDonoOuAdmin && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  title="Alterar foto do salão"
                >
                  <Camera size={14} className="text-white" />
                </button>
              )}
            </div>
            <h1 className="font-bold text-white text-lg">Avaliações</h1>
          </div>
        </div>

        {ehDonoOuAdmin && (
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploadingFoto}
            className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
          >
            <Upload size={14} /> {uploadingFoto ? 'Enviando...' : 'Alterar Foto'}
          </button>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleUploadFoto} 
          accept="image/*" 
          className="hidden" 
        />
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {profile?.tipo === 'cliente' && (
          <div className="card flex flex-col gap-3">
            <p className="font-bold text-gray-900 flex items-center gap-2">
              <Star size={18} style={{ color: cor }} />Deixar avaliação
            </p>
            {sucesso && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3"><p className="text-green-600 text-sm text-center">Avaliação enviada!</p></div>}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Serviço (opcional)</label>
              <select className="input-field" value={servicoId} onChange={e => setServicoId(e.target.value)}>
                <option value="">Avaliação geral do salão</option>
                {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Seu comentário</label>
              <textarea className="input-field resize-none" rows={4}
                placeholder="Conte sua experiência, sugestões de serviços..."
                value={texto} onChange={e => setTexto(e.target.value)} />
            </div>
            <button onClick={enviarAvaliacao} disabled={!texto || salvando}
              className="w-full text-white rounded-2xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: cor }}>
              <Send size={16} />{salvando ? 'Enviando...' : 'Enviar avaliação'}
            </button>
          </div>
        )}

        <p className="font-bold text-gray-900">Avaliações do salão ({depoimentos.length})</p>
        {depoimentos.length === 0 ? (
          <div className="card text-center py-8"><p className="text-gray-400">Nenhuma avaliação ainda</p></div>
        ) : depoimentos.map(d => (
          <div key={d.id} className="card flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: cor }}>
                {d.clientes?.nome?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{d.clientes?.nome}</p>
                {d.servicos?.nome && <p className="text-xs text-gray-400">{d.servicos.nome}</p>}
              </div>
              <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <p className="text-sm text-gray-600">{d.texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
