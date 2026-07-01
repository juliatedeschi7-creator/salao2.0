'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Upload, X, Check, Smile } from 'lucide-react'

const CORES_PRESET = [
  '#E91E8C', '#FF6B6B', '#FFB347', '#4CAF50',
  '#2196F3', '#9C27B0', '#FF4081', '#00BCD4',
  '#FF9800', '#607D8B', '#E91E63', '#3F51B5',
]

const EMOJIS = ['✨', '💫', '🌸', '💕', '🎀', '💎', '🌟', '🦋',
  '🌺', '💖', '🎊', '🌈', '🪄', '👑', '🌙', '⭐',
  '🎯', '💡', '🔮', '🌿', '🌻', '🍀', '🦄', '🎵']

const ESTILOS = [
  { id: 'bolha', label: 'Bolha' },
  { id: 'destaque', label: 'Destaque' },
  { id: 'citacao', label: 'Citação' },
]

interface Balao {
  id: string
  texto: string
  cor: string
  emoji: string
  estilo: string
}

export default function QuemSomosEdicaoPage() {
  const { profile, loading, temAcessoTotal } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [titulo, setTitulo] = useState('Nossa História')
  const [historia, setHistoria] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [baloes, setBaloes] = useState<Balao[]>([])
  const [salvando, setSalvando] = useState(false)
  const [uploadando, setUploadando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [carregando, setCarregando] = useState(true)

  // estado do balão sendo editado
  const [modalBalao, setModalBalao] = useState(false)
  const [balaoAtual, setBalaoAtual] = useState<Balao>({
    id: '', texto: '', cor: '#E91E8C', emoji: '✨', estilo: 'bolha'
  })
  const [mostrarEmojis, setMostrarEmojis] = useState(false)

  useEffect(() => {
    if (!loading && profile) {
      if (!temAcessoTotal) { router.push('/login'); return }
      carregarDados()
    }
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data } = await supabase.from('quem_somos').select('*').eq('salao_id', profile!.salao_id!).maybeSingle()
    if (data) {
      setTitulo(data.titulo || 'Nossa História')
      setHistoria(data.historia || '')
      setFotos(data.fotos || [])
      setBaloes(data.baloes || [])
    }
    setCarregando(false)
  }

  async function handleUploadFoto(file: File) {
    setUploadando(true)
    const ext = file.name.split('.').pop()
    const path = `quem-somos/${profile!.salao_id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos-salao').upload(path, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('fotos-salao').getPublicUrl(path)
      setFotos(prev => [...prev, urlData.publicUrl])
    }
    setUploadando(false)
  }

  function removerFoto(url: string) {
    setFotos(prev => prev.filter(f => f !== url))
  }

  function abrirModalBalao(b?: Balao) {
    if (b) {
      setBalaoAtual({ ...b })
    } else {
      setBalaoAtual({ id: crypto.randomUUID(), texto: '', cor: '#E91E8C', emoji: '✨', estilo: 'bolha' })
    }
    setMostrarEmojis(false)
    setModalBalao(true)
  }

  function salvarBalao() {
    if (!balaoAtual.texto) return
    setBaloes(prev => {
      const existe = prev.find(b => b.id === balaoAtual.id)
      if (existe) return prev.map(b => b.id === balaoAtual.id ? balaoAtual : b)
      return [...prev, balaoAtual]
    })
    setModalBalao(false)
  }

  function removerBalao(id: string) {
    setBaloes(prev => prev.filter(b => b.id !== id))
  }

  async function handleSalvar() {
    setSalvando(true)
    const dados = {
      salao_id: profile!.salao_id,
      titulo,
      historia,
      fotos,
      baloes,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('quem_somos').upsert(dados, { onConflict: 'salao_id' })
    if (!error) { setSalvo(true); setTimeout(() => setSalvo(false), 2500) }
    setSalvando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#f4f4f8' }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-5 flex items-center gap-3"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)` }}>
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-xl">Quem Somos</h1>
          <p className="text-white/70 text-xs mt-0.5">Editar página pública do salão</p>
        </div>
        <button onClick={handleSalvar} disabled={salvando}
          className="px-4 py-2 rounded-xl bg-white text-sm font-bold flex items-center gap-2"
          style={{ color: cor }}>
          {salvando ? '...' : salvo ? <><Check size={14} />Salvo!</> : 'Salvar'}
        </button>
      </div>

      <div className="px-4 py-5 flex flex-col gap-5">

        {/* Título */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Título da página</label>
          <input
            className="w-full text-gray-900 font-semibold text-lg outline-none border-b border-gray-100 pb-2"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Ex: Nossa História, Sobre nós, Quem sou..."
          />
        </div>

        {/* História */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Nossa história</label>
          <textarea
            className="w-full text-gray-700 text-sm leading-relaxed outline-none resize-none min-h-[160px]"
            value={historia}
            onChange={e => setHistoria(e.target.value)}
            placeholder="Conte a história do seu salão, sua trajetória, valores, o que te motivou a começar... Seja autêntica! ✨"
          />
          <p className="text-xs text-gray-300 mt-2 text-right">{historia.length} caracteres</p>
        </div>

        {/* Fotos */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fotos</label>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium cursor-pointer"
              style={{ backgroundColor: cor }}>
              <Upload size={13} />
              {uploadando ? 'Enviando...' : 'Adicionar foto'}
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleUploadFoto(e.target.files[0]) }} />
            </label>
          </div>

          {fotos.length === 0 ? (
            <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer">
              <Upload size={24} className="text-gray-300 mb-1" />
              <p className="text-xs text-gray-400">Toque para adicionar uma foto</p>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleUploadFoto(e.target.files[0]) }} />
            </label>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {fotos.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-24 h-24 rounded-xl object-cover" />
                  <button onClick={() => removerFoto(url)}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow">
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
              <label className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer">
                <Plus size={20} className="text-gray-300" />
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleUploadFoto(e.target.files[0]) }} />
              </label>
            </div>
          )}
        </div>

        {/* Balões */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Frases em destaque</label>
              <p className="text-xs text-gray-400 mt-0.5">Balões para destacar momentos ou frases marcantes</p>
            </div>
            <button onClick={() => abrirModalBalao()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-white text-xs font-medium"
              style={{ backgroundColor: cor }}>
              <Plus size={13} />Adicionar
            </button>
          </div>

          {baloes.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-2xl">
              <p className="text-gray-400 text-sm">Nenhum balão ainda</p>
              <p className="text-gray-300 text-xs mt-1">Adicione frases que representam seu salão ✨</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {baloes.map(b => (
                <div key={b.id} className="flex items-start gap-2">
                  <PreviewBalao balao={b} />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => abrirModalBalao(b)}
                      className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 text-xs">✏️</button>
                    <button onClick={() => removerBalao(b.id)}
                      className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pré-visualizar */}
        <button onClick={() => router.push('/cliente/quem-somos?preview=true')}
          className="w-full py-3 rounded-2xl border-2 font-medium text-sm"
          style={{ borderColor: cor, color: cor }}>
          👁 Pré-visualizar como cliente vê
        </button>
      </div>

      {/* Modal Balão */}
      {modalBalao && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">Frase em destaque</h3>

            {/* Preview */}
            {balaoAtual.texto && (
              <div className="flex justify-center py-2">
                <PreviewBalao balao={balaoAtual} />
              </div>
            )}

            {/* Texto */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">Texto do balão</label>
              <div className="flex gap-2">
                <button onClick={() => setMostrarEmojis(!mostrarEmojis)}
                  className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Smile size={18} className="text-gray-500" />
                </button>
                <input
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none"
                  value={balaoAtual.texto}
                  onChange={e => setBalaoAtual(p => ({ ...p, texto: e.target.value }))}
                  placeholder="Ex: Transformando autoestima desde 2018 ✨"
                />
              </div>

              {mostrarEmojis && (
                <div className="flex flex-wrap gap-2 mt-2 p-3 bg-gray-50 rounded-xl">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => {
                      setBalaoAtual(p => ({ ...p, emoji: e }))
                      setMostrarEmojis(false)
                    }} className="text-xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white">
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Emoji selecionado */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">Emoji (opcional)</label>
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.slice(0, 12).map(e => (
                  <button key={e} onClick={() => setBalaoAtual(p => ({ ...p, emoji: e }))}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                      balaoAtual.emoji === e ? 'ring-2 bg-gray-100' : ''
                    }`}
style={balaoAtual.emoji === e ? { outline: `2px solid ${cor}`, outlineOffset: '2px' } : {}}>
                    {e}
                  </button>
                ))}
                <button onClick={() => setBalaoAtual(p => ({ ...p, emoji: '' }))}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs text-gray-400 border ${
                    !balaoAtual.emoji ? 'border-gray-400' : 'border-gray-200'
                  }`}>
                  sem
                </button>
              </div>
            </div>

            {/* Estilo */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">Estilo</label>
              <div className="flex gap-2">
                {ESTILOS.map(e => (
                  <button key={e.id} onClick={() => setBalaoAtual(p => ({ ...p, estilo: e.id }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all`}
                    style={balaoAtual.estilo === e.id
                      ? { backgroundColor: balaoAtual.cor, color: 'white', borderColor: balaoAtual.cor }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cor */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {CORES_PRESET.map(c => (
                  <button key={c} onClick={() => setBalaoAtual(p => ({ ...p, cor: c }))}
                    className="w-9 h-9 rounded-xl transition-all"
                    style={{
                      backgroundColor: c,
                      outline: balaoAtual.cor === c ? `3px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <label className="text-xs text-gray-400">Ou cor personalizada:</label>
                <input type="color" value={balaoAtual.cor}
                  onChange={e => setBalaoAtual(p => ({ ...p, cor: e.target.value }))}
                  className="w-9 h-9 rounded-xl cursor-pointer border-0" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalBalao(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={salvarBalao}
                disabled={!balaoAtual.texto}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-40"
                style={{ backgroundColor: balaoAtual.cor }}>
                Salvar balão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PreviewBalao({ balao }: { balao: Balao }) {
  if (balao.estilo === 'citacao') {
    return (
      <div className="flex-1 px-4 py-3 rounded-2xl border-l-4 bg-gray-50"
        style={{ borderColor: balao.cor }}>
        {balao.emoji && <span className="text-lg mr-2">{balao.emoji}</span>}
        <span className="text-sm font-medium italic" style={{ color: balao.cor }}>{balao.texto || 'Sua frase aqui...'}</span>
      </div>
    )
  }
  if (balao.estilo === 'destaque') {
    return (
      <div className="flex-1 px-4 py-3 rounded-2xl text-white"
        style={{ backgroundColor: balao.cor }}>
        {balao.emoji && <span className="text-lg mr-2">{balao.emoji}</span>}
        <span className="text-sm font-bold">{balao.texto || 'Sua frase aqui...'}</span>
      </div>
    )
  }
  // bolha (default)
  return (
    <div className="flex-1 px-4 py-3 rounded-3xl rounded-bl-none text-white shadow-sm"
      style={{ backgroundColor: balao.cor }}>
      {balao.emoji && <span className="text-lg mr-2">{balao.emoji}</span>}
      <span className="text-sm font-medium">{balao.texto || 'Sua frase aqui...'}</span>
    </div>
  )
}