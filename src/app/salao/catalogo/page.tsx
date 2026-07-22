'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Share2, Sparkles, Phone, MapPin, Instagram } from 'lucide-react'

export default function CatalogoPDFPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [categorias, setCategorias] = useState<Record<string, any[]>>({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!profile?.salao_id) return
    carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    try {
      // 1. Busca dados do salão
      const { data: sal } = await supabase
        .from('saloes')
        .select('*')
        .eq('id', profile!.salao_id)
        .single()
      
      setSalao(sal)

      // 2. Busca todos os serviços ativos do salão
      const { data: servicos, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('salao_id', profile!.salao_id)
        .eq('ativo', true)
        .order('categoria')
        .order('nome')

      if (error) throw error

      // 3. Agrupa serviços por Categoria
      const agrupado: Record<string, any[]> = {}
      ;(servicos || []).forEach(servico => {
        const cat = servico.categoria || 'Geral'
        if (!agrupado[cat]) {
          agrupado[cat] = []
        }
        agrupado[cat].push(servico)
      })

      setCategorias(agrupado)
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err)
    } finally {
      setCarregando(false)
    }
  }

  function handleImprimir() {
    window.print()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white text-gray-800">
      
      {/* Barra de Ações (Oculta na Impressão/PDF) */}
      <div className="print:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-sm sm:text-base">Catálogo em PDF</h1>
            <p className="text-xs text-gray-400">Pronto para imprimir ou salvar como PDF</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImprimir}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium text-sm shadow-sm transition-opacity hover:opacity-95"
            style={{ backgroundColor: cor }}
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Salvar em PDF / Imprimir</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>

      {/* Conteúdo do Documento (Formatado para PDF A4) */}
      <div className="max-w-3xl mx-auto my-0 sm:my-6 print:my-0 bg-white shadow-lg print:shadow-none min-h-screen print:min-h-0 p-8 sm:p-12 print:p-8 rounded-none sm:rounded-2xl">
        
        {/* CAPA DO CATÁLOGO */}
        <div className="border-b-2 border-gray-100 pb-8 mb-8 text-center flex flex-col items-center justify-center min-h-[280px] rounded-2xl p-6 relative overflow-hidden"
             style={{ background: `linear-gradient(135deg, ${cor}15, ${cor}05)` }}>
          
          <div className="w-20 h-20 rounded-3xl bg-white shadow-md flex items-center justify-center mb-4 border border-gray-100">
            {salao?.logo_url ? (
              <img src={salao.logo_url} alt={salao?.nome} className="w-16 h-16 object-contain rounded-2xl" />
            ) : (
              <Sparkles size={36} style={{ color: cor }} />
            )}
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{salao?.nome || 'Menu de Serviços'}</h1>
          <p className="text-sm font-semibold uppercase tracking-widest mt-2" style={{ color: cor }}>Catálogo de Serviços & Tabela de Preços</p>

          {/* Informações de Contato do Salão */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-gray-500 border-t border-gray-200/60 pt-4 w-full max-w-md">
            {salao?.telefone && (
              <div className="flex items-center gap-1.5">
                <Phone size={13} style={{ color: cor }} />
                <span>{salao.telefone}</span>
              </div>
            )}
            {salao?.instagram && (
              <div className="flex items-center gap-1.5">
                <Instagram size={13} style={{ color: cor }} />
                <span>@{salao.instagram.replace('@', '')}</span>
              </div>
            )}
            {salao?.endereco && (
              <div className="flex items-center gap-1.5">
                <MapPin size={13} style={{ color: cor }} />
                <span className="truncate max-w-[200px]">{salao.endereco}</span>
              </div>
            )}
          </div>
        </div>

        {/* LISTA DE SERVIÇOS POR CATEGORIA */}
        {Object.keys(categorias).length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>Nenhum serviço ativo cadastrado para exibição.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(categorias).map(([categoria, listaServicos]) => (
              <div key={categoria} className="break-inside-avoid">
                
                {/* Título da Categoria */}
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-gray-100">
                  <div className="w-2.5 h-6 rounded-full" style={{ backgroundColor: cor }} />
                  <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{categoria}</h2>
                  <span className="text-xs text-gray-400 font-normal ml-auto">({listaServicos.length} {listaServicos.length === 1 ? 'item' : 'itens'})</span>
                </div>

                {/* Lista dos Itens da Categoria */}
                <div className="space-y-3">
                  {listaServicos.map(servico => (
                    <div key={servico.id} className="flex items-start justify-between gap-4 py-2 border-b border-dashed border-gray-100 last:border-0">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{servico.nome}</h3>
                          {servico.duracao_minutos && (
                            <span className="text-[11px] text-gray-400">({servico.duracao_minutos} min)</span>
                          )}
                        </div>
                        {servico.descricao && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{servico.descricao}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-sm sm:text-base" style={{ color: cor }}>
                          R$ {Number(servico.preco || 0).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>
        )}

        {/* RODAPÉ DO PDF */}
        <div className="mt-12 pt-6 border-t border-gray-100 text-center text-xs text-gray-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>Valores e disponibilidades sujeitos a alteração sem aviso prévio.</p>
          <p className="font-medium text-gray-500">{salao?.nome}</p>
        </div>

      </div>
    </div>
  )
}
