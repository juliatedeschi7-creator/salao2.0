'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle, RotateCcw } from 'lucide-react'

export default function AssinarContratoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const [salao, setSalao] = useState<any>(null)
  const [contrato, setContrato] = useState<any>(null)
  const [assinando, setAssinando] = useState(false)
  const [desenhando, setDesenhando] = useState(false)
  const [temAssinatura, setTemAssinatura] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setSalao(cli?.saloes)
    const { data: cont } = await supabase.from('contratos').select('*').eq('id', params.id).single()
    setContrato(cont)
  }

  function iniciarDesenho(e: React.TouchEvent | React.MouseEvent) {
    setDesenhando(true)
    desenhar(e)
  }

  function desenhar(e: React.TouchEvent | React.MouseEvent) {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    let x, y
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
    setTemAssinatura(true)
  }

  function pararDesenho() {
    setDesenhando(false)
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.beginPath()
  }

  function limparAssinatura() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setTemAssinatura(false)
  }

  async function gerarHash(texto: string) {
    const encoder = new TextEncoder()
    const data = encoder.encode(texto)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function confirmarAssinatura() {
    if (!temAssinatura || !canvasRef.current || !contrato) return
    setAssinando(true)

    const assinaturaBase64 = canvasRef.current.toDataURL('image/png')
    const agora = new Date().toISOString()
    const hash = await gerarHash(contrato.conteudo + assinaturaBase64 + agora + profile!.id)

    await supabase.from('contratos').update({
      status: 'assinado',
      assinatura_imagem: assinaturaBase64,
      assinado_em: agora,
      user_agent: navigator.userAgent,
      hash_documento: hash
    }).eq('id', contrato.id)

    await supabase.from('notificacoes').insert({
      salao_id: contrato.salao_id,
      remetente_id: profile!.id,
      destinatario_id: salao.dono_id,
      titulo: 'Contrato assinado',
      mensagem: profile!.nome + ' assinou: ' + contrato.titulo,
      tipo: 'contrato'
    })

    setAssinando(false)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (!contrato) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  if (contrato.status === 'assinado') {
    return (
      <div className="min-h-screen bg-gray-50 pb-8">
        <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
          <h1 className="font-bold text-white text-lg">{contrato.titulo}</h1>
        </div>
        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="card bg-green-50 border border-green-200 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-700">Contrato assinado</p>
              <p className="text-xs text-green-600">{new Date(contrato.assinado_em).toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{contrato.conteudo}</p>
          </div>
          {contrato.assinatura_imagem && (
            <div className="card">
              <p className="text-xs text-gray-400 mb-2">Assinatura</p>
              <img src={contrato.assinatura_imagem} alt="assinatura" className="max-h-32" />
            </div>
          )}
          <p className="text-xs text-gray-400 text-center">Codigo de verificacao: {contrato.hash_documento?.substring(0, 16)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">{contrato.titulo}</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="card">
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{contrato.conteudo}</p>
        </div>

        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900 text-sm">Assine abaixo com o dedo</p>
            <button onClick={limparAssinatura} className="flex items-center gap-1 text-xs text-gray-400">
              <RotateCcw size={12} />Limpar
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={320}
            height={160}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl bg-white touch-none"
            onTouchStart={iniciarDesenho}
            onTouchMove={e => desenhando && desenhar(e)}
            onTouchEnd={pararDesenho}
            onMouseDown={iniciarDesenho}
            onMouseMove={e => desenhando && desenhar(e)}
            onMouseUp={pararDesenho}
          />
          <p className="text-xs text-gray-400 text-center">Ao assinar, voce confirma que leu e concorda com os termos acima</p>
          <button onClick={confirmarAssinatura} disabled={!temAssinatura || assinando}
            className="w-full py-3 rounded-2xl text-white font-semibold disabled:opacity-40"
            style={{ backgroundColor: cor }}>
            {assinando ? 'Assinando...' : 'Confirmar assinatura'}
          </button>
        </div>
      </div>
    </div>
  )
}
