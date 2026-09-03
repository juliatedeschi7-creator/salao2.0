'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
  X
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'

const CATEGORIAS = {
  Pele: [
    'Melasma',
    'Acne',
    'Rejuvenescimento',
    'Limpeza de Pele',
    'Hidratação',
    'Manchas',
    'Outros'
  ],
  Unhas: [
    'Manicure',
    'Pedicure',
    'Gel',
    'Fibra',
    'Nail Art',
    'Outros'
  ],
  Cabelo: [
    'Coloração',
    'Corte',
    'Tratamento',
    'Escova',
    'Progressiva',
    'Outros'
  ],
  Estética: [
    'Depilação',
    'Massagem',
    'Drenagem',
    'Brow Design',
    'Cílios',
    'Outros'
  ]
}

type Categoria = keyof typeof CATEGORIAS

interface EvolucaoRegistro {
  id: string
  salao_id: string
  cliente_id: string
  profissional_id?: string | null
  categoria?: string | null
  subcategoria?: string | null
  servico_nome?: string | null
  foto_antes?: string | null
  foto_depois?: string | null
  observacoes?: string | null
  data_registro?: string | null
  created_at?: string | null
  visivel_cliente?: boolean | null
  profiles?: {
    nome?: string | null
  } | null
}

export default function EvolucaoClientePage() {
  const params = useParams()
  const router = useRouter()
  const { profile, loading } = useAuth()

  const clienteId = String(params?.clienteId || '')

  const [cliente, setCliente] = useState<any>(null)
  const [salao, setSalao] = useState<any>(null)
  const [registros, setRegistros] = useState<EvolucaoRegistro[]>([])

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const [categoria, setCategoria] = useState<Categoria>('Pele')
  const [subcategoria, setSubcategoria] = useState('')
  const [servicoNome, setServicoNome] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [fotoAntes, setFotoAntes] = useState<File | null>(null)
  const [fotoDepois, setFotoDepois] = useState<File | null>(null)

  const [previewAntes, setPreviewAntes] = useState<string | null>(null)
  const [previewDepois, setPreviewDepois] = useState<string | null>(null)

  const [erro, setErro] = useState('')

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    if (!clienteId) {
      router.push('/salao/evolucao')
      return
    }

    carregarDados()
  }, [loading, profile, clienteId])

  async function carregarDados() {
    if (!profile?.salao_id || !clienteId) return

    setCarregando(true)
    setErro('')

    try {
      const [
        { data: sal, error: erroSalao },
        { data: cli, error: erroCliente },
        { data: regs, error: erroRegistros }
      ] = await Promise.all([
        supabase
          .from('saloes')
          .select('*')
          .eq('id', profile.salao_id)
          .single(),

        supabase
          .from('clientes')
          .select('*')
          .eq('id', clienteId)
          .eq('salao_id', profile.salao_id)
          .single(),

        supabase
          .from('evolucao_registros')
          .select(`
            *,
            profiles(nome)
          `)
          .eq('cliente_id', clienteId)
          .eq('salao_id', profile.salao_id)
          .order('data_registro', {
            ascending: false
          })
      ])

      if (erroSalao) {
        console.error(
          'Erro ao carregar salão:',
          erroSalao.message
        )
      }

      if (erroCliente) {
        console.error(
          'Erro ao carregar cliente:',
          erroCliente.message
        )

        setErro('Não foi possível encontrar esta cliente.')
        return
      }

      if (erroRegistros) {
        console.error(
          'Erro ao carregar evolução:',
          erroRegistros.message
        )

        setErro(
          'Não foi possível carregar os registros de evolução.'
        )
      }

      setSalao(sal)
      setCliente(cli)
      setRegistros(regs || [])
    } catch (e) {
      console.error(e)
      setErro('Ocorreu um erro ao carregar a evolução.')
    } finally {
      setCarregando(false)
    }
  }

  const cor =
    salao?.cor_primaria || '#E91E8C'

  function selecionarFoto(
    arquivo: File | null,
    tipo: 'antes' | 'depois'
  ) {
    if (!arquivo) return

    if (!arquivo.type.startsWith('image/')) {
      setErro('Selecione uma imagem válida.')
      return
    }

    if (arquivo.size > 10 * 1024 * 1024) {
      setErro('A imagem deve ter no máximo 10 MB.')
      return
    }

    setErro('')

    const preview = URL.createObjectURL(arquivo)

    if (tipo === 'antes') {
      if (previewAntes) {
        URL.revokeObjectURL(previewAntes)
      }

      setFotoAntes(arquivo)
      setPreviewAntes(preview)
    } else {
      if (previewDepois) {
        URL.revokeObjectURL(previewDepois)
      }

      setFotoDepois(arquivo)
      setPreviewDepois(preview)
    }
  }

  function removerFoto(tipo: 'antes' | 'depois') {
    if (tipo === 'antes') {
      if (previewAntes) {
        URL.revokeObjectURL(previewAntes)
      }

      setFotoAntes(null)
      setPreviewAntes(null)
    } else {
      if (previewDepois) {
        URL.revokeObjectURL(previewDepois)
      }

      setFotoDepois(null)
      setPreviewDepois(null)
    }
  }

  function limparFormulario() {
    if (previewAntes) {
      URL.revokeObjectURL(previewAntes)
    }

    if (previewDepois) {
      URL.revokeObjectURL(previewDepois)
    }

    setCategoria('Pele')
    setSubcategoria('')
    setServicoNome('')
    setObservacoes('')
    setFotoAntes(null)
    setFotoDepois(null)
    setPreviewAntes(null)
    setPreviewDepois(null)
    setErro('')
  }

  async function enviarFoto(
    arquivo: File,
    registroId: string,
    tipo: 'antes' | 'depois'
  ) {
    if (!profile?.salao_id || !clienteId) {
      throw new Error('Dados do salão ou cliente não encontrados.')
    }

    const extensao =
      arquivo.name.split('.').pop()?.toLowerCase() || 'jpg'

    const nomeArquivo =
      `${profile.salao_id}/${clienteId}/${registroId}_${tipo}.${extensao}`

    const { error } = await supabase.storage
      .from('evolucao')
      .upload(nomeArquivo, arquivo, {
        cacheControl: '3600',
        upsert: true,
        contentType: arquivo.type
      })

    if (error) {
      throw error
    }

    const {
      data: publicData
    } = supabase.storage
      .from('evolucao')
      .getPublicUrl(nomeArquivo)

    return publicData.publicUrl
  }

  async function salvarRegistro() {
    if (!profile?.salao_id) return

    if (!clienteId) {
      setErro('Cliente não identificada.')
      return
    }

    if (!categoria) {
      setErro('Selecione uma categoria.')
      return
    }

    setSalvando(true)
    setErro('')

    try {
      const registroId = crypto.randomUUID()

      let urlAntes: string | null = null
      let urlDepois: string | null = null

      if (fotoAntes) {
        urlAntes = await enviarFoto(
          fotoAntes,
          registroId,
          'antes'
        )
      }

      if (fotoDepois) {
        urlDepois = await enviarFoto(
          fotoDepois,
          registroId,
          'depois'
        )
      }

      const { error } = await supabase
        .from('evolucao_registros')
        .insert({
          id: registroId,
          salao_id: profile.salao_id,
          cliente_id: clienteId,
          profissional_id: profile.id,
          categoria,
          subcategoria: subcategoria || null,
          servico_nome: servicoNome.trim() || null,
          foto_antes: urlAntes,
          foto_depois: urlDepois,
          observacoes: observacoes.trim() || null,
          data_registro: new Date().toISOString(),
          visivel_cliente: true
        })

      if (error) {
        throw error
      }

      limparFormulario()
      setMostrarFormulario(false)

      await carregarDados()
    } catch (e: any) {
      console.error(
        'Erro ao salvar evolução:',
        e
      )

      setErro(
        e?.message ||
          'Não foi possível salvar o registro.'
      )
    } finally {
      setSalvando(false)
    }
  }

  async function alternarVisibilidade(
    registro: EvolucaoRegistro
  ) {
    const novoValor =
      registro.visivel_cliente !== true

    const { error } = await supabase
      .from('evolucao_registros')
      .update({
        visivel_cliente: novoValor
      })
      .eq('id', registro.id)
      .eq('salao_id', profile?.salao_id)

    if (error) {
      console.error(
        'Erro ao alterar visibilidade:',
        error.message
      )

      setErro(
        'Não foi possível alterar a visibilidade.'
      )

      return
    }

    setRegistros(lista =>
      lista.map(item =>
        item.id === registro.id
          ? {
              ...item,
              visivel_cliente: novoValor
            }
          : item
      )
    )
  }

  async function excluirRegistro(
    registro: EvolucaoRegistro
  ) {
    const confirmar = window.confirm(
      'Deseja realmente excluir este registro de evolução?'
    )

    if (!confirmar) return

    setErro('')

    try {
      const { error } = await supabase
        .from('evolucao_registros')
        .delete()
        .eq('id', registro.id)
        .eq('salao_id', profile?.salao_id)

      if (error) {
        throw error
      }

      setRegistros(lista =>
        lista.filter(
          item => item.id !== registro.id
        )
      )
    } catch (e: any) {
      console.error(
        'Erro ao excluir registro:',
        e
      )

      setErro(
        e?.message ||
          'Não foi possível excluir o registro.'
      )
    }
  }

  function formatarData(data?: string | null) {
    if (!data) return ''

    const valor = new Date(data)

    if (Number.isNaN(valor.getTime())) {
      return ''
    }

    return valor.toLocaleDateString(
      'pt-BR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }
    )
  }

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div
          className="w-9 h-9 border-4 border-t-transparent rounded-full animate-spin"
          style={{
            borderColor: cor,
            borderTopColor: 'transparent'
          }}
        />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 text-center shadow-sm max-w-sm w-full">

          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{
              backgroundColor: `${cor}15`
            }}
          >
            <User
              size={26}
              style={{ color: cor }}
            />
          </div>

          <p className="font-bold text-gray-800">
            Cliente não encontrada
          </p>

          <p className="text-sm text-gray-400 mt-2">
            Não foi possível localizar esta cliente neste salão.
          </p>

          <button
            onClick={() =>
              router.push('/salao/evolucao')
            }
            className="mt-5 px-5 py-3 rounded-xl text-white text-sm font-semibold"
            style={{
              backgroundColor: cor
            }}
          >
            Voltar para Evolução
          </button>

        </div>
      </div>
    )
  }

  const subcategorias =
    CATEGORIAS[categoria] || []

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">

      {/* =====================================================
          TOPO
      ===================================================== */}

      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-30">

        <button
          onClick={() =>
            router.push('/salao/evolucao')
          }
          className="p-1 shrink-0"
        >
          <ArrowLeft
            size={22}
            className="text-gray-700"
          />
        </button>

        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `${cor}15`
          }}
        >
          <User
            size={20}
            style={{
              color: cor
            }}
          />
        </div>

        <div className="min-w-0 flex-1">

          <h1 className="font-bold text-gray-900 text-base truncate">
            {cliente.nome}
          </h1>

          <p className="text-xs text-gray-400">
            Evolução
          </p>

        </div>

        <button
          onClick={() => {
            setMostrarFormulario(true)
            setErro('')
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{
            backgroundColor: cor
          }}
          title="Novo registro"
        >
          <Plus size={21} />
        </button>

      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4">

        {/* ===================================================
            ERRO
        =================================================== */}

        {erro && (
          <div className="bg-red-50 border border-red-100 text-red-600 rounded-2xl px-4 py-3 text-sm">
            {erro}
          </div>
        )}

        {/* ===================================================
            RESUMO
        =================================================== */}

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">

          <div className="flex items-center gap-3">

            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: `${cor}15`
              }}
            >
              <Sparkles
                size={23}
                style={{
                  color: cor
                }}
              />
            </div>

            <div className="flex-1">

              <p className="font-bold text-gray-900">
                Acompanhamento de evolução
              </p>

              <p className="text-xs text-gray-400 mt-1">
                {registros.length === 0
                  ? 'Nenhum registro realizado ainda.'
                  : `${registros.length} ${
                      registros.length === 1
                        ? 'registro'
                        : 'registros'
                    } realizado${
                      registros.length === 1
                        ? ''
                        : 's'
                    }.`}
              </p>

            </div>

          </div>

        </div>

        {/* ===================================================
            FORMULÁRIO
        =================================================== */}

        {mostrarFormulario && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">

            <div className="flex items-center justify-between mb-5">

              <div>
                <p className="font-bold text-gray-900">
                  Novo registro
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  Registre o acompanhamento do procedimento.
                </p>
              </div>

              <button
                onClick={() => {
                  limparFormulario()
                  setMostrarFormulario(false)
                }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X
                  size={18}
                  className="text-gray-500"
                />
              </button>

            </div>

            {/* CATEGORIA */}

            <div className="space-y-2 mb-4">

              <label className="text-xs font-semibold text-gray-600">
                Categoria
              </label>

              <div className="relative">

                <select
                  value={categoria}
                  onChange={e => {
                    setCategoria(
                      e.target.value as Categoria
                    )
                    setSubcategoria('')
                  }}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm outline-none"
                >
                  {Object.keys(CATEGORIAS).map(
                    item => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />

              </div>

            </div>

            {/* SUBCATEGORIA */}

            <div className="space-y-2 mb-4">

              <label className="text-xs font-semibold text-gray-600">
                Procedimento
              </label>

              <div className="relative">

                <select
                  value={subcategoria}
                  onChange={e =>
                    setSubcategoria(
                      e.target.value
                    )
                  }
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm outline-none"
                >
                  <option value="">
                    Selecione o procedimento
                  </option>

                  {subcategorias.map(
                    item => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}

                </select>

                <ChevronDown
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />

              </div>

            </div>

            {/* SERVIÇO */}

            <div className="space-y-2 mb-4">

              <label className="text-xs font-semibold text-gray-600">
                Serviço realizado
              </label>

              <input
                value={servicoNome}
                onChange={e =>
                  setServicoNome(
                    e.target.value
                  )
                }
                placeholder="Ex.: Limpeza de pele profunda"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none"
              />

            </div>

            {/* FOTOS */}

            <div className="grid grid-cols-2 gap-3 mb-4">

              {/* ANTES */}

              <div>

                <label className="text-xs font-semibold text-gray-600 block mb-2">
                  Foto antes
                </label>

                {previewAntes ? (
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100">

                    <img
                      src={previewAntes}
                      alt="Antes"
                      className="w-full h-full object-cover"
                    />

                    <button
                      onClick={() =>
                        removerFoto('antes')
                      }
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <X size={16} />
                    </button>

                  </div>
                ) : (
                  <label
                    className="aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors"
                    style={{
                      borderColor: `${cor}55`,
                      backgroundColor: `${cor}08`
                    }}
                  >
                    <Camera
                      size={25}
                      style={{
                        color: cor
                      }}
                    />

                    <span
                      className="text-xs font-semibold mt-2"
                      style={{
                        color: cor
                      }}
                    >
                      Adicionar
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e =>
                        selecionarFoto(
                          e.target.files?.[0] || null,
                          'antes'
                        )
                      }
                    />
                  </label>
                )}

              </div>

              {/* DEPOIS */}

              <div>

                <label className="text-xs font-semibold text-gray-600 block mb-2">
                  Foto depois
                </label>

                {previewDepois ? (
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100">

                    <img
                      src={previewDepois}
                      alt="Depois"
                      className="w-full h-full object-cover"
                    />

                    <button
                      onClick={() =>
                        removerFoto('depois')
                      }
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <X size={16} />
                    </button>

                  </div>
                ) : (
                  <label
                    className="aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors"
                    style={{
                      borderColor: `${cor}55`,
                      backgroundColor: `${cor}08`
                    }}
                  >
                    <Camera
                      size={25}
                      style={{
                        color: cor
                      }}
                    />

                    <span
                      className="text-xs font-semibold mt-2"
                      style={{
                        color: cor
                      }}
                    >
                      Adicionar
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e =>
                        selecionarFoto(
                          e.target.files?.[0] || null,
                          'depois'
                        )
                      }
                    />
                  </label>
                )}

              </div>

            </div>

            {/* OBSERVAÇÕES */}

            <div className="space-y-2 mb-5">

              <label className="text-xs font-semibold text-gray-600">
                Observações
              </label>

              <textarea
                value={observacoes}
                onChange={e =>
                  setObservacoes(
                    e.target.value
                  )
                }
                rows={4}
                placeholder="Anote observações sobre o procedimento, evolução, produtos utilizados..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none resize-none"
              />

            </div>

            {/* SALVAR */}

            <button
              onClick={salvarRegistro}
              disabled={salvando}
              className="w-full rounded-xl py-3.5 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              style={{
                backgroundColor: cor
              }}
            >

              {salvando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Salvar evolução
                </>
              )}

            </button>

          </div>
        )}

        {/* ===================================================
            SEM REGISTROS
        =================================================== */}

        {registros.length === 0 && !mostrarFormulario && (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">

            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
              style={{
                backgroundColor: `${cor}15`
              }}
            >
              <ImageIcon
                size={28}
                style={{
                  color: cor
                }}
              />
            </div>

            <p className="font-bold text-gray-800">
              Ainda não há registros
            </p>

            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              Adicione fotos e informações para acompanhar a evolução desta cliente.
            </p>

            <button
              onClick={() => {
                setMostrarFormulario(true)
                setErro('')
              }}
              className="mt-5 px-5 py-3 rounded-xl text-white text-sm font-semibold inline-flex items-center gap-2"
              style={{
                backgroundColor: cor
              }}
            >
              <Plus size={17} />
              Adicionar primeiro registro
            </button>

          </div>
        )}

        {/* ===================================================
            REGISTROS
        =================================================== */}

        {registros.map(registro => (
          <div
            key={registro.id}
            className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100"
          >

            <div className="flex items-start gap-3 mb-4">

              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${cor}15`
                }}
              >
                <Sparkles
                  size={19}
                  style={{
                    color: cor
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">

                <div className="flex items-start justify-between gap-2">

                  <div>

                    <p className="font-bold text-gray-800 text-sm">
                      {registro.subcategoria ||
                        registro.servico_nome ||
                        registro.categoria ||
                        'Registro de evolução'}
                    </p>

                    <p className="text-xs text-gray-400 mt-0.5">
                      {registro.categoria &&
                        registro.subcategoria &&
                        `${registro.categoria} • ${registro.subcategoria}`}

                      {registro.data_registro &&
                        ` • ${formatarData(
                          registro.data_registro
                        )}`}
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      excluirRegistro(
                        registro
                      )
                    }
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>

                </div>

                {registro.servico_nome &&
                  registro.subcategoria && (
                    <p className="text-xs text-gray-500 mt-2">
                      Serviço: {registro.servico_nome}
                    </p>
                  )}

              </div>

            </div>

            {/* FOTOS */}

            {(registro.foto_antes ||
              registro.foto_depois) && (
              <div className="grid grid-cols-2 gap-3 mb-4">

                <div>

                  <p className="text-[11px] font-semibold text-gray-400 mb-1.5">
                    ANTES
                  </p>

                  {registro.foto_antes ? (
                    <img
                      src={registro.foto_antes}
                      alt="Foto antes"
                      className="w-full aspect-square object-cover rounded-2xl bg-gray-100"
                    />
                  ) : (
                    <div className="w-full aspect-square rounded-2xl bg-gray-50 flex items-center justify-center">
                      <span className="text-xs text-gray-300">
                        Sem foto
                      </span>
                    </div>
                  )}

                </div>

                <div>

                  <p className="text-[11px] font-semibold text-gray-400 mb-1.5">
                    DEPOIS
                  </p>

                  {registro.foto_depois ? (
                    <img
                      src={registro.foto_depois}
                      alt="Foto depois"
                      className="w-full aspect-square object-cover rounded-2xl bg-gray-100"
                    />
                  ) : (
                    <div className="w-full aspect-square rounded-2xl bg-gray-50 flex items-center justify-center">
                      <span className="text-xs text-gray-300">
                        Sem foto
                      </span>
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* OBSERVAÇÕES */}

            {registro.observacoes && (
              <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-4">

                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                  Observações
                </p>

                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {registro.observacoes}
                </p>

              </div>
            )}

            {/* VISIBILIDADE */}

            <button
              onClick={() =>
                alternarVisibilidade(
                  registro
                )
              }
              className="w-full rounded-xl px-4 py-3 flex items-center justify-between gap-3 border"
              style={{
                borderColor:
                  registro.visivel_cliente
                    ? `${cor}35`
                    : '#e5e7eb',
                backgroundColor:
                  registro.visivel_cliente
                    ? `${cor}08`
                    : '#fafafa'
              }}
            >

              <div className="flex items-center gap-2">

                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor:
                      registro.visivel_cliente
                        ? `${cor}18`
                        : '#f3f4f6'
                  }}
                >
                  <Check
                    size={15}
                    style={{
                      color:
                        registro.visivel_cliente
                          ? cor
                          : '#9ca3af'
                    }}
                  />
                </div>

                <div className="text-left">

                  <p className="text-xs font-semibold text-gray-700">
                    {registro.visivel_cliente
                      ? 'Visível para a cliente'
                      : 'Oculto para a cliente'}
                  </p>

                  <p className="text-[11px] text-gray-400">
                    Toque para alterar
                  </p>

                </div>

              </div>

              <span
                className="text-xs font-semibold"
                style={{
                  color:
                    registro.visivel_cliente
                      ? cor
                      : '#9ca3af'
                }}
              >
                {registro.visivel_cliente
                  ? 'Visível'
                  : 'Oculto'}
              </span>

            </button>

          </div>
        ))}

      </div>
    </div>
  )
}