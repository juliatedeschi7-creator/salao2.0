'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Copy, Check, Share2, Printer,
  Filter, ChevronDown, ChevronUp
} from 'lucide-react'

function formatarDuracao(min: number) {
  if (!min) return ''
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${m}min`
}

function formatarPreco(v: number) {
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`
}

export default function ExportarServicosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<Set<string>>(new Set())
  const [mostrarFiltro, setMostrarFiltro] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: srvs } = await supabase.from('servicos').select('*')
      .eq('salao_id', profile!.salao_id!).eq('ativo', true).order('categoria').order('nome')
    setServicos(srvs || [])
    setCarregando(false)
  }

  const categorias = [...new Set(servicos.map(s => s.categoria).filter(Boolean))]
  const semCategoria = servicos.filter(s => !s.categoria)

  // Filtragem: se nenhuma selecionada = mostra todas
  const servicosFiltrados = categoriasSelecionadas.size === 0
    ? servicos
    : servicos.filter(s => !s.categoria
        ? categoriasSelecionadas.has('__sem_categoria__')
        : categoriasSelecionadas.has(s.categoria))

  function toggleCategoria(cat: string) {
    setCategoriasSelecionadas(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  // ── Gerar texto para WhatsApp ─────────────────────────────────
  function gerarTextoWhatsApp(): string {
    const linhas: string[] = []
    const nome = salao?.nome || 'Tabela de Preços'

    linhas.push(`💅 *${nome.toUpperCase()}*`)
    if (salao?.descricao) linhas.push(`_${salao.descricao}_`)
    linhas.push('')

    const grupos: Record<string, any[]> = {}
    for (const s of servicosFiltrados) {
      const cat = s.categoria || 'Outros'
      if (!grupos[cat]) grupos[cat] = []
      grupos[cat].push(s)
    }

    for (const [cat, srvs] of Object.entries(grupos)) {
      linhas.push(`──────────────────`)
      linhas.push(`🌸 *${cat.toUpperCase()}*`)
      linhas.push(`──────────────────`)
      for (const s of srvs) {
        linhas.push(`✨ *${s.nome}*`)
        // Remove os [[links]] do texto
        const desc = s.descricao?.replace(/\[\[.+?\|(.+?)\]\]/g, '$1').replace(/\[\[(.+?)\|.+?\]\]/g, '$1')
        const partes = []
        partes.push(formatarPreco(s.preco))
        if (s.duracao_minutos) partes.push(formatarDuracao(s.duracao_minutos))
        linhas.push(`   ${partes.join(' | ')}`)
        if (desc) linhas.push(`   _${desc.slice(0, 120)}${desc.length > 120 ? '...' : ''}_`)
        linhas.push('')
      }
    }

    if (salao?.telefone) {
      linhas.push(`──────────────────`)
      linhas.push(`📱 Agende pelo app ou WhatsApp: ${salao.telefone}`)
    }
    if (salao?.instagram) linhas.push(`📸 Instagram: ${salao.instagram}`)

    return linhas.join('\n')
  }

  async function copiarWhatsApp() {
    const texto = gerarTextoWhatsApp()
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 3000)
  }

  async function compartilhar() {
    const texto = gerarTextoWhatsApp()
    if (navigator.share) {
      await navigator.share({ title: salao?.nome || 'Tabela de Preços', text: texto })
    } else {
      await copiarWhatsApp()
    }
  }

  function imprimir() {
    window.print()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'

  // Agrupar para preview
  const grupos: Record<string, any[]> = {}
  for (const s of servicosFiltrados) {
    const cat = s.categoria || 'Outros'
    if (!grupos[cat]) grupos[cat] = []
    grupos[cat].push(s)
  }

  if (carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <>
      {/* CSS de impressão — só aparece na hora do print */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-area { padding: 20px; }
          .servico-card { break-inside: avoid; border: 1px solid #eee; margin-bottom: 8px; padding: 12px; border-radius: 8px; }
          .categoria-titulo { background: ${cor}22; color: ${cor}; padding: 6px 12px; border-radius: 6px; font-weight: bold; margin-top: 16px; margin-bottom: 8px; }
          .header-salao { text-align: center; margin-bottom: 24px; border-bottom: 2px solid ${cor}; padding-bottom: 16px; }
        }
      `}</style>

      <div className="min-h-screen bg-[#f8f9fa] pb-10">
        {/* Header */}
        <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm no-print">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg flex-1">Exportar Tabela</h1>
          <button onClick={() => setMostrarFiltro(!mostrarFiltro)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
            <Filter size={14} />
            Filtrar
            {mostrarFiltro ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Filtro de categorias */}
        {mostrarFiltro && (
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex flex-col gap-2 no-print">
            <p className="text-xs text-gray-500 font-medium">
              Selecione as categorias a exportar (vazio = todas):
            </p>
            <div className="flex flex-wrap gap-2">
              {categorias.map(cat => (
                <button key={cat} onClick={() => toggleCategoria(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all"
                  style={categoriasSelecionadas.has(cat)
                    ? { backgroundColor: cor, borderColor: cor, color: 'white' }
                    : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {cat}
                </button>
              ))}
              {semCategoria.length > 0 && (
                <button onClick={() => toggleCategoria('__sem_categoria__')}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all"
                  style={categoriasSelecionadas.has('__sem_categoria__')
                    ? { backgroundColor: cor, borderColor: cor, color: 'white' }
                    : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  Sem categoria
                </button>
              )}
            </div>
          </div>
        )}

        {/* Botões de exportação */}
        <div className="px-4 py-4 flex flex-col gap-3 no-print">
          <button onClick={copiarWhatsApp}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-semibold text-sm active:scale-95 transition-all"
            style={{ backgroundColor: '#25D366' }}>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              {copiado ? <Check size={18} /> : <Copy size={18} />}
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold">{copiado ? 'Copiado!' : 'Copiar texto para WhatsApp'}</p>
              <p className="text-white/80 text-xs font-normal">Cola direto no chat ou story</p>
            </div>
          </button>

          <button onClick={compartilhar}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-semibold text-sm active:scale-95 transition-all"
            style={{ backgroundColor: cor }}>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Share2 size={18} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold">Compartilhar</p>
              <p className="text-white/80 text-xs font-normal">Abre as opções do celular (WhatsApp, etc.)</p>
            </div>
          </button>

          <button onClick={imprimir}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-semibold text-sm active:scale-95 transition-all bg-white border-2 border-gray-200">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <Printer size={18} className="text-gray-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-gray-900">Salvar como PDF</p>
              <p className="text-gray-400 text-xs font-normal">Usa a impressão do browser para gerar PDF</p>
            </div>
          </button>
        </div>

        {/* Preview da tabela */}
        <div className="px-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 no-print">
            Prévia — {servicosFiltrados.length} serviço{servicosFiltrados.length !== 1 ? 's' : ''}
          </p>

          <div ref={previewRef} className="print-area">
            {/* Cabeçalho do salão */}
            <div className="header-salao bg-white rounded-2xl p-5 mb-4 shadow-sm text-center">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: cor }}>
                Tabela de Preços
              </p>
              <h1 className="text-xl font-bold text-gray-900">{salao?.nome}</h1>
              {salao?.descricao && (
                <p className="text-sm text-gray-500 mt-1">{salao.descricao}</p>
              )}
              {(salao?.telefone || salao?.instagram) && (
                <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
                  {salao.telefone && (
                    <span className="text-xs text-gray-400">📱 {salao.telefone}</span>
                  )}
                  {salao.instagram && (
                    <span className="text-xs text-gray-400">📸 {salao.instagram}</span>
                  )}
                </div>
              )}
            </div>

            {/* Grupos de serviços */}
            {Object.entries(grupos).map(([cat, srvs]) => (
              <div key={cat} className="mb-4">
                <div className="categoria-titulo flex items-center gap-2 px-4 py-2 rounded-xl mb-2"
                  style={{ backgroundColor: `${cor}18` }}>
                  <span className="font-bold text-sm" style={{ color: cor }}>{cat}</span>
                  <span className="text-xs ml-auto" style={{ color: cor }}>
                    {srvs.length} serviço{srvs.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {srvs.map(s => {
                    const desc = s.descricao
                      ?.replace(/\[\[(.+?)\|.+?\]\]/g, '$1')  // mantém só o texto do link
                    return (
                      <div key={s.id} className="servico-card bg-white rounded-2xl px-4 py-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm">{s.nome}</p>
                            {desc && (
                              <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">{desc}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-bold text-base" style={{ color: cor }}>
                              {s.tipo_preco === 'variavel' ? 'A partir de ' : ''}{formatarPreco(s.preco)}
                            </p>
                            {s.duracao_minutos > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">{formatarDuracao(s.duracao_minutos)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Rodapé */}
            <div className="mt-4 text-center py-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Valores sujeitos a alteração sem aviso prévio.
              </p>
              {salao?.telefone && (
                <p className="text-xs text-gray-500 mt-1">
                  Agende pelo WhatsApp: {salao.telefone}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}