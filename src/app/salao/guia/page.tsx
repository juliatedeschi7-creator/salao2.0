// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  Notebook,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  ArrowLeft,
  BookOpen,
  Upload,
  Loader2,
  FolderPlus,
  Settings2,
  Check,
  AlertTriangle
} from 'lucide-react'

const CATEGORIAS_SUGERIDAS = [
  'Geral',
  'Cabelo',
  'Unhas',
  'Estética',
  'Sobrancelha / Cílios',
  'Atendimento',
  'Limpeza / Organização'
]

/*
 * IMPORTANTE:
 * Este é o nome EXATO do bucket que já existe
 * no Supabase.
 */
const BUCKET_GUIAS = 'guias'

/*
 * Limite de tamanho da imagem.
 */
const TAMANHO_MAXIMO_IMAGEM = 6 * 1024 * 1024 // 6 MB

/*
 * Tipos de imagem aceitos.
 */
const TIPOS_IMAGEM_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]

export default function GuiaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [guias, setGuias] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState('Todas')

  // ============================================================
  // MODAIS
  // ============================================================

  const [modalFormAberto, setModalFormAberto] =
    useState(false)

  const [modalCategoriasAberto, setModalCategoriasAberto] =
    useState(false)

  const [guiaLeitura, setGuiaLeitura] =
    useState<any | null>(null)

  // ============================================================
  // EDIÇÃO DE GUIA
  // ============================================================

  const [idEditando, setIdEditando] =
    useState<string | null>(null)

  // ============================================================
  // CATEGORIA
  // ============================================================

  const [categoriaEditando, setCategoriaEditando] =
    useState<any | null>(null)

  const [nomeNovaCategoria, setNomeNovaCategoria] =
    useState('')

  const [salvandoCategoria, setSalvandoCategoria] =
    useState(false)

  // ============================================================
  // FORMULÁRIO GUIA
  // ============================================================

  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('Geral')
  const [conteudo, setConteudo] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // ============================================================
  // CARREGAMENTO INICIAL
  // ============================================================

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    if (!profile.salao_id) return

    carregarDados()
  }, [loading, profile])

  // ============================================================
  // CARREGAR DADOS
  // ============================================================

  async function carregarDados() {
    if (!profile?.salao_id) return

    setCarregando(true)

    try {
      const [
        salRes,
        guiasRes,
        categoriasRes
      ] = await Promise.all([
        supabase
          .from('saloes')
          .select('*')
          .eq('id', profile.salao_id)
          .single(),

        supabase
          .from('guias')
          .select('*')
          .eq('salao_id', profile.salao_id)
          .order('created_at', {
            ascending: false
          }),

        supabase
          .from('guias_categorias')
          .select('*')
          .eq('salao_id', profile.salao_id)
          .order('nome', {
            ascending: true
          })
      ])

      if (salRes.error) {
        console.error(
          'Erro salão:',
          salRes.error
        )
      }

      if (guiasRes.error) {
        console.error(
          'Erro guias:',
          guiasRes.error
        )
      }

      if (categoriasRes.error) {
        console.error(
          'Erro categorias:',
          categoriasRes.error
        )
      }

      setSalao(salRes.data)
      setGuias(guiasRes.data || [])
      setCategorias(categoriasRes.data || [])
    } catch (error) {
      console.error(
        'Erro ao carregar dados:',
        error
      )
    } finally {
      setCarregando(false)
    }
  }

  // ============================================================
  // CATEGORIAS
  // ============================================================

  function abrirModalCategorias() {
    setCategoriaEditando(null)
    setNomeNovaCategoria('')
    setModalCategoriasAberto(true)
  }

  async function salvarCategoria() {
    const nome = nomeNovaCategoria.trim()

    if (!nome) {
      alert(
        'Digite o nome da categoria.'
      )
      return
    }

    if (!profile?.salao_id) return

    setSalvandoCategoria(true)

    try {
      if (categoriaEditando) {
        const nomeAntigo =
          categoriaEditando.nome

        const { error } =
          await supabase
            .from('guias_categorias')
            .update({
              nome
            })
            .eq(
              'id',
              categoriaEditando.id
            )
            .eq(
              'salao_id',
              profile.salao_id
            )

        if (error) throw error

        const {
          error: guiasError
        } = await supabase
          .from('guias')
          .update({
            categoria: nome
          })
          .eq(
            'salao_id',
            profile.salao_id
          )
          .eq(
            'categoria',
            nomeAntigo
          )

        if (guiasError) {
          throw guiasError
        }

        alert(
          'Categoria atualizada com sucesso.'
        )
      } else {
        const { error } =
          await supabase
            .from('guias_categorias')
            .insert([
              {
                salao_id:
                  profile.salao_id,
                nome
              }
            ])

        if (error) {
          if (
            error.code ===
            '23505'
          ) {
            throw new Error(
              'Já existe uma categoria com esse nome.'
            )
          }

          throw error
        }

        alert(
          'Categoria criada com sucesso.'
        )
      }

      setCategoriaEditando(null)
      setNomeNovaCategoria('')

      await carregarDados()
    } catch (err: any) {
      alert(
        'Erro ao salvar categoria: ' +
          (
            err.message ||
            'Tente novamente.'
          )
      )
    } finally {
      setSalvandoCategoria(false)
    }
  }

  function iniciarEdicaoCategoria(
    cat: any
  ) {
    setCategoriaEditando(cat)
    setNomeNovaCategoria(
      cat.nome
    )
  }

  function cancelarEdicaoCategoria() {
    setCategoriaEditando(null)
    setNomeNovaCategoria('')
  }

  async function excluirCategoria(
    cat: any
  ) {
    if (!profile?.salao_id) return

    const quantidadeGuias =
      guias.filter(
        g =>
          g.categoria ===
          cat.nome
      ).length

    if (quantidadeGuias > 0) {
      alert(
        `Não é possível excluir "${cat.nome}" porque existem ${quantidadeGuias} guia(s) usando essa categoria.\n\nPrimeiro edite esses guias e escolha outra categoria.`
      )
      return
    }

    const confirmar = confirm(
      `Deseja realmente excluir a categoria "${cat.nome}"?`
    )

    if (!confirmar) return

    try {
      const { error } =
        await supabase
          .from('guias_categorias')
          .delete()
          .eq('id', cat.id)
          .eq(
            'salao_id',
            profile.salao_id
          )

      if (error) throw error

      if (
        catFiltro ===
        cat.nome
      ) {
        setCatFiltro('Todas')
      }

      await carregarDados()
    } catch (err: any) {
      alert(
        'Erro ao excluir categoria: ' +
          (
            err.message ||
            'Tente novamente.'
          )
      )
    }
  }

  // ============================================================
  // GUIAS
  // ============================================================

  function abrirModalCriar() {
    setIdEditando(null)
    setTitulo('')

    setCategoria(
      categorias.length > 0
        ? categorias[0].nome
        : 'Geral'
    )

    setConteudo('')
    setImagemUrl('')
    setModalFormAberto(true)
  }

  function abrirModalEditar(
    g: any
  ) {
    setIdEditando(g.id)
    setTitulo(g.titulo || '')
    setCategoria(
      g.categoria || 'Geral'
    )
    setConteudo(
      g.conteudo || ''
    )
    setImagemUrl(
      g.imagem_url || ''
    )
    setModalFormAberto(true)
  }

  // ============================================================
  // UPLOAD DE IMAGEM
  // ============================================================

  async function handleUploadImagem(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const arquivo =
      e.target.files?.[0]

    /*
     * Limpa o input para permitir
     * selecionar novamente o mesmo arquivo.
     */
    e.target.value = ''

    if (!arquivo) return

    // ----------------------------------------------------------
    // VALIDAR TIPO
    // ----------------------------------------------------------

    if (
      !TIPOS_IMAGEM_PERMITIDOS.includes(
        arquivo.type
      )
    ) {
      alert(
        'Formato de imagem não permitido.\n\nUse JPG, PNG, WEBP ou GIF.'
      )
      return
    }

    // ----------------------------------------------------------
    // VALIDAR TAMANHO
    // ----------------------------------------------------------

    if (
      arquivo.size >
      TAMANHO_MAXIMO_IMAGEM
    ) {
      alert(
        'A imagem é muito grande.\n\nEscolha uma imagem de até 6 MB.'
      )
      return
    }

    // ----------------------------------------------------------
    // VALIDAR SALÃO
    // ----------------------------------------------------------

    if (!profile?.salao_id) {
      alert(
        'Não foi possível identificar o salão.\n\nFaça login novamente.'
      )
      return
    }

    setEnviandoFoto(true)

    try {
      /*
       * ========================================================
       * BUCKET
       * ========================================================
       *
       * O bucket "guias" já existe no Supabase.
       *
       * Não criamos bucket pelo navegador.
       */

      const bucket =
        BUCKET_GUIAS

      /*
       * ========================================================
       * EXTENSÃO
       * ========================================================
       */

      const extensoesPorMime: Record<
        string,
        string
      > = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
      }

      const extensao =
        extensoesPorMime[
          arquivo.type
        ] || 'jpg'

      /*
       * ========================================================
       * NOME DO ARQUIVO
       * ========================================================
       *
       * Estrutura:
       *
       * guias/
       *   SALAO_ID/
       *     timestamp-uuid.jpg
       *
       * O ID do salão separa os arquivos
       * de cada estabelecimento.
       */

      let identificador =
        ''

      try {
        identificador =
          crypto.randomUUID()
      } catch {
        identificador =
          `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2)}`
      }

      const nomeArquivo =
        `${profile.salao_id}/` +
        `${Date.now()}-${identificador}.` +
        `${extensao}`

      console.log(
        '📤 Iniciando upload da imagem...',
        {
          bucket,
          nomeArquivo,
          tipo: arquivo.type,
          tamanho: arquivo.size,
          salaoId:
            profile.salao_id
        }
      )

      /*
       * ========================================================
       * UPLOAD
       * ========================================================
       *
       * O Supabase aceita o File diretamente
       * no navegador.
       *
       * upsert false:
       * cada imagem terá seu próprio arquivo.
       */

      const {
        data: uploadData,
        error: uploadError
      } =
        await supabase.storage
          .from(bucket)
          .upload(
            nomeArquivo,
            arquivo,
            {
              cacheControl: '3600',
              contentType:
                arquivo.type,
              upsert: false
            }
          )

      console.log(
        '📤 Resultado do upload:',
        {
          uploadData,
          uploadError
        }
      )

      // --------------------------------------------------------
      // ERRO DO STORAGE
      // --------------------------------------------------------

      if (uploadError) {
        console.error(
          '❌ Erro completo do Storage:',
          uploadError
        )

        const mensagem =
          String(
            uploadError.message ||
              ''
          ).toLowerCase()

        /*
         * IMPORTANTE:
         *
         * Como o bucket EXISTE no seu Supabase,
         * se aparecer "Bucket not found" aqui,
         * a hipótese mais forte passa a ser:
         *
         * o aplicativo publicado está usando
         * outra NEXT_PUBLIC_SUPABASE_URL.
         */

        if (
          mensagem.includes(
            'bucket not found'
          ) ||
          mensagem.includes(
            'nosuchbucket'
          )
        ) {
          throw new Error(
            'O aplicativo não encontrou o bucket "guias". O bucket existe no seu Supabase, então verifique se o Vercel está conectado ao mesmo projeto Supabase.'
          )
        }

        if (
          mensagem.includes(
            'row-level security'
          ) ||
          mensagem.includes(
            'policy'
          ) ||
          mensagem.includes(
            'not authorized'
          ) ||
          mensagem.includes(
            'unauthorized'
          ) ||
          mensagem.includes(
            'permission'
          )
        ) {
          throw new Error(
            'O bucket "guias" foi encontrado, mas o usuário não tem permissão para enviar arquivos. Verifique a política INSERT de storage.objects.'
          )
        }

        throw uploadError
      }

      /*
       * ========================================================
       * GERAR URL PÚBLICA
       * ========================================================
       */

      const {
        data: publicUrlData
      } =
        supabase.storage
          .from(bucket)
          .getPublicUrl(
            nomeArquivo
          )

      const publicUrl =
        publicUrlData?.publicUrl

      if (!publicUrl) {
        throw new Error(
          'A imagem foi enviada, mas não foi possível obter a URL pública.'
        )
      }

      console.log(
        '✅ Imagem enviada com sucesso:',
        publicUrl
      )

      /*
       * Coloca a URL no formulário.
       *
       * Ela será salva na coluna
       * guias.imagem_url quando o usuário
       * clicar em "Salvar Guia".
       */

      setImagemUrl(
        publicUrl
      )

    } catch (err: any) {
      console.error(
        '🚨 Erro final ao enviar imagem:',
        err
      )

      alert(
        'Erro ao enviar imagem:\n\n' +
          (
            err?.message ||
            'Não foi possível enviar a imagem. Tente novamente.'
          )
      )
    } finally {
      setEnviandoFoto(false)
    }
  }

  // ============================================================
  // SALVAR GUIA
  // ============================================================

  async function handleSalvarGuia(
    e: React.FormEvent
  ) {
    e.preventDefault()

    if (
      !titulo.trim() ||
      !conteudo.trim()
    ) {
      alert(
        'Preencha o título e as instruções do guia.'
      )
      return
    }

    if (!profile?.salao_id) return

    if (enviandoFoto) {
      alert(
        'Aguarde o término do envio da imagem.'
      )
      return
    }

    setSalvando(true)

    try {
      const dadosGuia = {
        salao_id:
          profile.salao_id,

        titulo:
          titulo.trim(),

        categoria:
          categoria.trim() ||
          'Geral',

        conteudo:
          conteudo.trim(),

        imagem_url:
          imagemUrl.trim() ||
          null
      }

      if (idEditando) {
        const { error } =
          await supabase
            .from('guias')
            .update(
              dadosGuia
            )
            .eq(
              'id',
              idEditando
            )
            .eq(
              'salao_id',
              profile.salao_id
            )

        if (error) {
          throw error
        }
      } else {
        const { error } =
          await supabase
            .from('guias')
            .insert([
              dadosGuia
            ])

        if (error) {
          throw error
        }
      }

      setModalFormAberto(
        false
      )

      await carregarDados()
    } catch (err: any) {
      alert(
        'Erro ao salvar o guia: ' +
          (
            err.message ||
            'Tente novamente.'
          )
      )
    } finally {
      setSalvando(false)
    }
  }

  // ============================================================
  // EXCLUIR GUIA
  // ============================================================

  async function handleExcluirGuia(
    id: string
  ) {
    if (
      !confirm(
        'Deseja realmente excluir este guia?'
      )
    ) {
      return
    }

    if (!profile?.salao_id) return

    try {
      const { error } =
        await supabase
          .from('guias')
          .delete()
          .eq('id', id)
          .eq(
            'salao_id',
            profile.salao_id
          )

      if (error) {
        throw error
      }

      if (
        guiaLeitura?.id === id
      ) {
        setGuiaLeitura(null)
      }

      await carregarDados()
    } catch (err: any) {
      alert(
        'Erro ao excluir: ' +
          (
            err.message ||
            'Tente novamente.'
          )
      )
    }
  }

  // ============================================================
  // MARCAR GUIA COMO VISUALIZADO
  // ============================================================

  async function marcarComoVisualizado(
    guiaId: string
  ) {
    if (!profile?.id) return

    try {
      const {
        error
      } =
        await supabase
          .from(
            'guias_visualizados'
          )
          .upsert(
            {
              guia_id:
                guiaId,

              profile_id:
                profile.id,

              visualizado_em:
                new Date().toISOString()
            },
            {
              onConflict:
                'guia_id,profile_id'
            }
          )

      if (error) {
        console.error(
          'Erro ao marcar guia como visualizado:',
          error
        )
      }
    } catch (error) {
      console.error(
        'Erro ao registrar visualização:',
        error
      )
    }
  }

  function abrirGuia(
    g: any
  ) {
    setGuiaLeitura(g)
    marcarComoVisualizado(
      g.id
    )
  }

  // ============================================================
  // CATEGORIAS DISPONÍVEIS
  // ============================================================

  const nomesCategorias = [
    ...CATEGORIAS_SUGERIDAS,

    ...categorias.map(
      c => c.nome
    ),

    ...guias
      .map(
        g => g.categoria
      )
      .filter(Boolean)
  ]

  const categoriasUnicas =
    Array.from(
      new Set(
        nomesCategorias
      )
    )

  const categoriasDisponiveis =
    [
      'Todas',
      ...categoriasUnicas
    ]

  // ============================================================
  // FILTRO
  // ============================================================

  const guiasFiltrados =
    guias.filter(g => {
      const textoBusca =
        busca.toLowerCase()

      const atendeBusca =
        (
          g.titulo ||
          ''
        )
          .toLowerCase()
          .includes(
            textoBusca
          ) ||
        (
          g.conteudo ||
          ''
        )
          .toLowerCase()
          .includes(
            textoBusca
          )

      const atendeCategoria =
        catFiltro ===
          'Todas' ||
        g.categoria ===
          catFiltro

      return (
        atendeBusca &&
        atendeCategoria
      )
    })

  // ============================================================
  // COR DO SALÃO
  // ============================================================

  const cor =
    salao?.cor_primaria ||
    '#E91E8C'

  // ============================================================
  // LOADING
  // ============================================================

  if (
    loading ||
    carregando
  ) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] p-4 flex items-center justify-center">

        <div
          className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2"
          style={{
            borderColor:
              cor
          }}
        />

      </div>
    )
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">

        <div className="flex items-center gap-2">

          <button
            onClick={() =>
              router.back()
            }
            className="p-1"
          >
            <ArrowLeft
              size={22}
              className="text-gray-700"
            />
          </button>

          <div className="flex items-center gap-2">

            <Notebook
              size={22}
              style={{
                color: cor
              }}
            />

            <h1 className="font-bold text-gray-900 text-lg">
              Guia & Procedimentos
            </h1>

          </div>

        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={
              abrirModalCategorias
            }
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200"
            title="Gerenciar categorias"
          >
            <Settings2
              size={17}
            />
          </button>

          <button
            onClick={
              abrirModalCriar
            }
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-xs font-bold shadow-sm"
            style={{
              backgroundColor:
                cor
            }}
          >
            <Plus
              size={16}
            />

            Novo Guia
          </button>

        </div>

      </div>

      {/* ======================================================
          CONTEÚDO
      ====================================================== */}

      <div className="p-4 space-y-4 max-w-4xl mx-auto">

        {/* PESQUISA */}

        <div className="relative">

          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Buscar passo a passo, tarefa, produto..."
            value={busca}
            onChange={e =>
              setBusca(
                e.target.value
              )
            }
            className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-gray-100 text-sm focus:outline-none shadow-sm"
          />

        </div>

        {/* FILTRO DE CATEGORIAS */}

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">

          {categoriasDisponiveis.map(
            cat => (
              <button
                key={cat}
                onClick={() =>
                  setCatFiltro(
                    cat
                  )
                }
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  catFiltro ===
                  cat
                    ? 'text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-100'
                }`}
                style={{
                  backgroundColor:
                    catFiltro ===
                    cat
                      ? cor
                      : undefined
                }}
              >
                {cat}
              </button>
            )
          )}

        </div>

        {/* LISTAGEM */}

        {guiasFiltrados.length ===
        0 ? (

          <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center space-y-3 mt-4 shadow-sm">

            <div
              className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto"
              style={{
                color: cor
              }}
            >
              <Notebook
                size={28}
              />
            </div>

            <h3 className="font-bold text-gray-800 text-base">
              Nenhum guia encontrado
            </h3>

            <p className="text-xs text-gray-400 max-w-xs mx-auto">

              {busca ||
              catFiltro !==
                'Todas'
                ? 'Tente mudar a busca ou os filtros acima.'
                : 'Cadastre o primeiro guia de instrução para sua equipe.'}

            </p>

            <button
              onClick={
                abrirModalCriar
              }
              className="mt-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
              style={{
                backgroundColor:
                  cor
              }}
            >
              <Plus
                size={16}
              />

              Cadastrar Guia
            </button>

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {guiasFiltrados.map(
              g => (

                <div
                  key={g.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:border-pink-200 transition-all cursor-pointer"
                  onClick={() =>
                    abrirGuia(g)
                  }
                >

                  {/* FOTO */}

                  {g.imagem_url && (

                    <div className="h-44 w-full bg-gray-100 relative overflow-hidden">

                      <img
                        src={
                          g.imagem_url
                        }
                        alt={
                          g.titulo
                        }
                        className="w-full h-full object-cover"
                      />

                    </div>

                  )}

                  <div className="p-4 flex-1 flex flex-col justify-between">

                    <div>

                      <div className="flex items-center justify-between gap-2 mb-2">

                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-100">

                          {g.categoria ||
                            'Geral'}

                        </span>

                        <div
                          className="flex items-center gap-1"
                          onClick={e =>
                            e.stopPropagation()
                          }
                        >

                          <button
                            onClick={() =>
                              abrirModalEditar(
                                g
                              )
                            }
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                          >
                            <Edit2
                              size={15}
                            />
                          </button>

                          <button
                            onClick={() =>
                              handleExcluirGuia(
                                g.id
                              )
                            }
                            className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <Trash2
                              size={15}
                            />
                          </button>

                        </div>

                      </div>

                      <h2 className="font-bold text-gray-900 text-base leading-snug">
                        {g.titulo}
                      </h2>

                      <p className="text-xs text-gray-500 line-clamp-3 mt-1.5 leading-relaxed">
                        {g.conteudo}
                      </p>

                    </div>

                    <div
                      className="pt-3 mt-3 border-t border-gray-50 flex items-center justify-between text-xs font-semibold"
                      style={{
                        color: cor
                      }}
                    >

                      <span className="flex items-center gap-1">

                        <BookOpen
                          size={14}
                        />

                        Ler instrução

                      </span>

                      <span className="text-[10px] text-gray-300 font-normal">

                        {g.created_at
                          ? new Date(
                              g.created_at
                            ).toLocaleDateString(
                              'pt-BR'
                            )
                          : ''}

                      </span>

                    </div>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </div>

      {/* ======================================================
          MODAL CATEGORIAS
      ====================================================== */}

      {modalCategoriasAberto && (

        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-xl">

            <div className="flex items-center justify-between border-b pb-4">

              <div className="flex items-center gap-2">

                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor:
                      `${cor}18`,
                    color: cor
                  }}
                >
                  <FolderPlus
                    size={19}
                  />
                </div>

                <div>

                  <h3 className="font-bold text-gray-900">
                    Categorias
                  </h3>

                  <p className="text-[10px] text-gray-400">
                    Organize seus guias
                  </p>

                </div>

              </div>

              <button
                onClick={() =>
                  setModalCategoriasAberto(
                    false
                  )
                }
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>

            </div>

            {/* FORM CATEGORIA */}

            <div className="mt-5">

              <label className="block text-xs font-bold text-gray-700 mb-1.5">

                {categoriaEditando
                  ? 'Editar categoria'
                  : 'Nova categoria'}

              </label>

              <div className="flex gap-2">

                <input
                  type="text"
                  value={
                    nomeNovaCategoria
                  }
                  onChange={e =>
                    setNomeNovaCategoria(
                      e.target.value
                    )
                  }
                  onKeyDown={e => {
                    if (
                      e.key ===
                      'Enter'
                    ) {
                      e.preventDefault()
                      salvarCategoria()
                    }
                  }}
                  placeholder="Ex: Recepção"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
                />

                <button
                  onClick={
                    salvarCategoria
                  }
                  disabled={
                    salvandoCategoria
                  }
                  className="px-4 rounded-xl text-white text-xs font-bold disabled:opacity-50"
                  style={{
                    backgroundColor:
                      cor
                  }}
                >

                  {salvandoCategoria ? (

                    <Loader2
                      size={17}
                      className="animate-spin"
                    />

                  ) : (

                    <Check
                      size={17}
                    />

                  )}

                </button>

              </div>

              {categoriaEditando && (

                <button
                  onClick={
                    cancelarEdicaoCategoria
                  }
                  className="text-[11px] text-gray-400 mt-2"
                >
                  Cancelar edição
                </button>

              )}

            </div>

            {/* LISTA */}

            <div className="mt-6">

              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                Categorias cadastradas
              </p>

              {categorias.length ===
              0 ? (

                <div className="py-6 text-center border border-dashed border-gray-200 rounded-2xl">

                  <FolderPlus
                    size={24}
                    className="mx-auto text-gray-300 mb-2"
                  />

                  <p className="text-xs text-gray-400">
                    Nenhuma categoria personalizada.
                  </p>

                </div>

              ) : (

                <div className="space-y-2 max-h-64 overflow-y-auto">

                  {categorias.map(
                    cat => {

                      const quantidade =
                        guias.filter(
                          g =>
                            g.categoria ===
                            cat.nome
                        ).length

                      return (

                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
                        >

                          <div>

                            <p className="text-sm font-semibold text-gray-800">
                              {cat.nome}
                            </p>

                            <p className="text-[10px] text-gray-400">

                              {quantidade}{' '}

                              {quantidade ===
                              1
                                ? 'guia'
                                : 'guias'}

                            </p>

                          </div>

                          <div className="flex items-center gap-1">

                            <button
                              onClick={() =>
                                iniciarEdicaoCategoria(
                                  cat
                                )
                              }
                              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white"
                            >
                              <Edit2
                                size={15}
                              />
                            </button>

                            <button
                              onClick={() =>
                                excluirCategoria(
                                  cat
                                )
                              }
                              className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2
                                size={15}
                              />
                            </button>

                          </div>

                        </div>

                      )
                    }
                  )}

                </div>

              )}

            </div>

            <button
              onClick={() =>
                setModalCategoriasAberto(
                  false
                )
              }
              className="w-full mt-5 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium"
            >
              Fechar
            </button>

          </div>

        </div>

      )}

      {/* ======================================================
          MODAL LEITURA
      ====================================================== */}

      {guiaLeitura && (

        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">

          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl my-auto">

            {guiaLeitura.imagem_url && (

              <div className="w-full max-h-72 bg-gray-900 relative">

                <img
                  src={
                    guiaLeitura.imagem_url
                  }
                  alt={
                    guiaLeitura.titulo
                  }
                  className="w-full h-full object-contain"
                />

                <button
                  onClick={() =>
                    setGuiaLeitura(null)
                  }
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
                >
                  <X
                    size={18}
                  />
                </button>

              </div>

            )}

            <div className="p-6 space-y-4">

              {!guiaLeitura.imagem_url && (

                <div className="flex items-center justify-between">

                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-pink-50 text-pink-700">

                    {guiaLeitura.categoria}

                  </span>

                  <button
                    onClick={() =>
                      setGuiaLeitura(
                        null
                      )
                    }
                  >
                    <X
                      size={20}
                      className="text-gray-400"
                    />
                  </button>

                </div>

              )}

              {guiaLeitura.imagem_url && (

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-pink-50 text-pink-700 inline-block">

                  {guiaLeitura.categoria}

                </span>

              )}

              <h2 className="text-xl font-bold text-gray-900 leading-tight">
                {guiaLeitura.titulo}
              </h2>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">

                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {guiaLeitura.conteudo}
                </p>

              </div>

              <div className="flex items-center justify-between pt-2">

                <button
                  onClick={() => {

                    const g =
                      guiaLeitura

                    setGuiaLeitura(
                      null
                    )

                    abrirModalEditar(
                      g
                    )

                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900"
                >
                  <Edit2
                    size={15}
                  />

                  Editar Guia

                </button>

                <button
                  onClick={() =>
                    setGuiaLeitura(
                      null
                    )
                  }
                  className="px-5 py-2.5 rounded-xl text-white text-xs font-bold"
                  style={{
                    backgroundColor:
                      cor
                  }}
                >
                  Entendi / Fechar
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          MODAL CRIAR / EDITAR GUIA
      ====================================================== */}

      {modalFormAberto && (

        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">

          <form
            onSubmit={
              handleSalvarGuia
            }
            className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-xl space-y-4 my-auto"
          >

            <div className="flex items-center justify-between border-b pb-3">

              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">

                <Notebook
                  size={20}
                  style={{
                    color: cor
                  }}
                />

                {idEditando
                  ? 'Editar Guia'
                  : 'Novo Guia de Tarefa'}

              </h3>

              <button
                type="button"
                onClick={() =>
                  setModalFormAberto(
                    false
                  )
                }
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>

            </div>

            {/* TÍTULO */}

            <div>

              <label className="block text-xs font-bold text-gray-700 mb-1">
                Título do Guia / Tarefa *
              </label>

              <input
                type="text"
                placeholder="Ex: Passo a Passo de Morena Iluminada"
                value={titulo}
                onChange={e =>
                  setTitulo(
                    e.target.value
                  )
                }
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
              />

            </div>

            {/* CATEGORIA */}

            <div>

              <div className="flex items-center justify-between mb-1">

                <label className="block text-xs font-bold text-gray-700">
                  Categoria
                </label>

                <button
                  type="button"
                  onClick={() => {

                    setModalFormAberto(
                      false
                    )

                    abrirModalCategorias()

                  }}
                  className="text-[10px] font-bold"
                  style={{
                    color: cor
                  }}
                >
                  + Gerenciar categorias
                </button>

              </div>

              <select
                value={categoria}
                onChange={e =>
                  setCategoria(
                    e.target.value
                  )
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none bg-white"
              >

                {categoriasUnicas.map(
                  c => (

                    <option
                      key={c}
                      value={c}
                    >
                      {c}
                    </option>

                  )
                )}

              </select>

            </div>

            {/* FOTO */}

            <div>

              <label className="block text-xs font-bold text-gray-700 mb-1">
                Foto Ilustrativa (Opcional)
              </label>

              {imagemUrl ? (

                <div className="relative h-36 w-full rounded-xl bg-gray-100 overflow-hidden border">

                  <img
                    src={
                      imagemUrl
                    }
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setImagemUrl(
                        ''
                      )
                    }
                    className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-md hover:bg-red-700"
                  >
                    <X
                      size={14}
                    />
                  </button>

                </div>

              ) : (

                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-pink-500 bg-gray-50 transition-all">

                  <div className="flex flex-col items-center justify-center pt-3 pb-4">

                    {enviandoFoto ? (

                      <>

                        <Loader2
                          size={24}
                          className="animate-spin text-pink-600 mb-1"
                        />

                        <p className="text-xs text-gray-500 font-medium">
                          Enviando imagem...
                        </p>

                      </>

                    ) : (

                      <>

                        <Upload
                          size={22}
                          className="text-gray-400 mb-1"
                        />

                        <p className="text-xs text-gray-600 font-medium">
                          Clique para carregar uma foto
                        </p>

                        <p className="text-[10px] text-gray-400 mt-0.5">
                          PNG, JPG ou WEBP • até 6 MB
                        </p>

                      </>

                    )}

                  </div>

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={
                      handleUploadImagem
                    }
                    className="hidden"
                    disabled={
                      enviandoFoto
                    }
                  />

                </label>

              )}

              <div className="flex items-start gap-1.5 mt-2">

                <AlertTriangle
                  size={12}
                  className="text-gray-400 mt-0.5 shrink-0"
                />

                <p className="text-[10px] text-gray-400 leading-relaxed">
                  A imagem será armazenada
                  no espaço do seu salão.
                </p>

              </div>

            </div>

            {/* CONTEÚDO */}

            <div>

              <label className="block text-xs font-bold text-gray-700 mb-1">
                Instruções / Passo a Passo *
              </label>

              <textarea
                rows={5}
                placeholder="Descreva detalhadamente o processo, produtos utilizados, tempo de pausa e recomendações..."
                value={conteudo}
                onChange={e =>
                  setConteudo(
                    e.target.value
                  )
                }
                required
                className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
              />

            </div>

            {/* BOTÕES */}

            <div className="flex gap-3 pt-2">

              <button
                type="button"
                onClick={() =>
                  setModalFormAberto(
                    false
                  )
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={
                  salvando ||
                  enviandoFoto
                }
                className="flex-1 py-3 rounded-2xl text-white text-sm font-medium disabled:opacity-50"
                style={{
                  backgroundColor:
                    cor
                }}
              >

                {salvando
                  ? 'Salvando...'
                  : enviandoFoto
                    ? 'Enviando imagem...'
                    : 'Salvar Guia'}

              </button>

            </div>

          </form>

        </div>

      )}

    </div>
  )
}