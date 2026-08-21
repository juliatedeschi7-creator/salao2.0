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
  FolderEdit,
  FolderX
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

export default function GuiaPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [guias, setGuias] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState('Todas')

  // Modais
  const [modalFormAberto, setModalFormAberto] = useState(false)
  const [modalCategoriasAberto, setModalCategoriasAberto] = useState(false)
  const [modalNovaCategoria, setModalNovaCategoria] = useState(false)
  const [modalEditarCategoria, setModalEditarCategoria] = useState(false)
  const [modalExcluirCategoria, setModalExcluirCategoria] = useState(false)

  const [guiaLeitura, setGuiaLeitura] = useState<any | null>(null)
  const [idEditando, setIdEditando] = useState<string | null>(null)

  const [categoriaEditando, setCategoriaEditando] = useState<any | null>(null)
  const [categoriaExcluindo, setCategoriaExcluindo] = useState<any | null>(null)

  // Categoria que receberá os guias ao excluir uma categoria
  const [categoriaDestinoExclusao, setCategoriaDestinoExclusao] = useState('Geral')

  // Formulário de guia
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('Geral')
  const [conteudo, setConteudo] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')

  // Formulário de categoria
  const [nomeCategoria, setNomeCategoria] = useState('')

  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoCategoria, setSalvandoCategoria] = useState(false)

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    if (profile.salao_id) {
      carregarDados()
    }
  }, [loading, profile, router])

  async function carregarDados() {
    if (!profile?.salao_id) return

    setCarregando(true)

    try {
      const [salRes, guiasRes, categoriasRes] = await Promise.all([
        supabase
          .from('saloes')
          .select('*')
          .eq('id', profile.salao_id)
          .single(),

        supabase
          .from('guias')
          .select('*')
          .eq('salao_id', profile.salao_id)
          .order('created_at', { ascending: false }),

        supabase
          .from('categorias_guias')
          .select('*')
          .eq('salao_id', profile.salao_id)
          .order('nome', { ascending: true })
      ])

      setSalao(salRes.data)

      if (guiasRes.error) {
        console.error('Erro ao carregar guias:', guiasRes.error)
      }

      if (categoriasRes.error) {
        console.error(
          'Erro ao carregar categorias:',
          categoriasRes.error
        )
      }

      setGuias(guiasRes.data || [])
      setCategorias(categoriasRes.data || [])

      // Se ainda não existem categorias cadastradas,
      // cria as categorias sugeridas para este salão.
      if (
        !categoriasRes.error &&
        (!categoriasRes.data || categoriasRes.data.length === 0)
      ) {
        await criarCategoriasIniciais()
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setCarregando(false)
    }
  }

  async function criarCategoriasIniciais() {
    if (!profile?.salao_id) return

    const categoriasParaCriar = CATEGORIAS_SUGERIDAS.map(nome => ({
      salao_id: profile.salao_id,
      nome
    }))

    const { data, error } = await supabase
      .from('categorias_guias')
      .insert(categoriasParaCriar)
      .select('*')

    if (error) {
      console.error(
        'Erro ao criar categorias iniciais:',
        error
      )
      return
    }

    setCategorias(data || [])
  }

  function abrirModalCriar() {
    setIdEditando(null)
    setTitulo('')
    setCategoria(
      categorias.length > 0
        ? categorias[0]?.nome || 'Geral'
        : 'Geral'
    )
    setConteudo('')
    setImagemUrl('')
    setModalFormAberto(true)
  }

  function abrirModalEditar(g: any) {
    setIdEditando(g.id)
    setTitulo(g.titulo)
    setCategoria(g.categoria || 'Geral')
    setConteudo(g.conteudo)
    setImagemUrl(g.imagem_url || '')
    setModalFormAberto(true)
  }

  // ============================================================
  // CATEGORIAS
  // ============================================================

  function abrirNovaCategoria() {
    setNomeCategoria('')
    setModalNovaCategoria(true)
  }

  function abrirEditarCategoria(cat: any) {
    setCategoriaEditando(cat)
    setNomeCategoria(cat.nome)
    setModalEditarCategoria(true)
  }

  function abrirExcluirCategoria(cat: any) {
    if (cat.nome === 'Geral') {
      alert('A categoria "Geral" não pode ser excluída.')
      return
    }

    setCategoriaExcluindo(cat)
    setCategoriaDestinoExclusao('Geral')
    setModalExcluirCategoria(true)
  }

  async function criarCategoria() {
    const nome = nomeCategoria.trim()

    if (!nome) {
      alert('Digite o nome da categoria.')
      return
    }

    if (!profile?.salao_id) return

    const existente = categorias.find(
      c => c.nome.trim().toLowerCase() === nome.toLowerCase()
    )

    if (existente) {
      alert('Já existe uma categoria com esse nome.')
      return
    }

    setSalvandoCategoria(true)

    try {
      const { data, error } = await supabase
        .from('categorias_guias')
        .insert({
          salao_id: profile.salao_id,
          nome
        })
        .select('*')
        .single()

      if (error) throw error

      setCategorias(prev =>
        [...prev, data].sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR')
        )
      )

      setModalNovaCategoria(false)
      setNomeCategoria('')

      alert('Categoria criada com sucesso!')
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error)

      if (
        error?.code === '23505'
      ) {
        alert('Já existe uma categoria com esse nome.')
      } else {
        alert(
          'Erro ao criar categoria: ' +
          (error?.message || 'Tente novamente.')
        )
      }
    } finally {
      setSalvandoCategoria(false)
    }
  }

  async function editarCategoria() {
    if (!categoriaEditando) return

    const novoNome = nomeCategoria.trim()

    if (!novoNome) {
      alert('Digite o nome da categoria.')
      return
    }

    if (novoNome.toLowerCase() === 'todas') {
      alert('Esse nome é reservado e não pode ser usado.')
      return
    }

    const existente = categorias.find(
      c =>
        c.id !== categoriaEditando.id &&
        c.nome.trim().toLowerCase() === novoNome.toLowerCase()
    )

    if (existente) {
      alert('Já existe uma categoria com esse nome.')
      return
    }

    setSalvandoCategoria(true)

    try {
      const nomeAntigo = categoriaEditando.nome

      const { error } = await supabase
        .from('categorias_guias')
        .update({
          nome: novoNome
        })
        .eq('id', categoriaEditando.id)
        .eq('salao_id', profile!.salao_id)

      if (error) throw error

      // Atualiza os guias que utilizavam o nome antigo.
      const { error: errorGuias } = await supabase
        .from('guias')
        .update({
          categoria: novoNome
        })
        .eq('salao_id', profile!.salao_id)
        .eq('categoria', nomeAntigo)

      if (errorGuias) {
        console.error(
          'Categoria alterada, mas não foi possível atualizar os guias:',
          errorGuias
        )

        alert(
          'A categoria foi alterada, mas houve um problema ao atualizar os guias que usavam essa categoria.'
        )
      }

      setCategorias(prev =>
        prev.map(c =>
          c.id === categoriaEditando.id
            ? { ...c, nome: novoNome }
            : c
        )
      )

      setGuias(prev =>
        prev.map(g =>
          g.categoria === nomeAntigo
            ? { ...g, categoria: novoNome }
            : g
        )
      )

      if (categoria === nomeAntigo) {
        setCategoria(novoNome)
      }

      if (catFiltro === nomeAntigo) {
        setCatFiltro(novoNome)
      }

      setModalEditarCategoria(false)
      setCategoriaEditando(null)
      setNomeCategoria('')

      alert('Categoria alterada com sucesso!')
    } catch (error: any) {
      console.error('Erro ao editar categoria:', error)

      if (error?.code === '23505') {
        alert('Já existe uma categoria com esse nome.')
      } else {
        alert(
          'Erro ao editar categoria: ' +
          (error?.message || 'Tente novamente.')
        )
      }
    } finally {
      setSalvandoCategoria(false)
    }
  }

  async function excluirCategoria() {
    if (!categoriaExcluindo) return

    if (categoriaExcluindo.nome === 'Geral') {
      alert('A categoria "Geral" não pode ser excluída.')
      return
    }

    if (!profile?.salao_id) return

    const destino = categoriaDestinoExclusao.trim()

    if (!destino) {
      alert('Escolha uma categoria de destino.')
      return
    }

    if (
      destino.toLowerCase() ===
      categoriaExcluindo.nome.toLowerCase()
    ) {
      alert(
        'A categoria de destino precisa ser diferente da categoria excluída.'
      )
      return
    }

    setSalvandoCategoria(true)

    try {
      const nomeExcluido = categoriaExcluindo.nome

      // Primeiro transfere os guias para outra categoria.
      const { error: errorGuias } = await supabase
        .from('guias')
        .update({
          categoria: destino
        })
        .eq('salao_id', profile.salao_id)
        .eq('categoria', nomeExcluido)

      if (errorGuias) throw errorGuias

      // Depois exclui a categoria.
      const { error: errorCategoria } = await supabase
        .from('categorias_guias')
        .delete()
        .eq('id', categoriaExcluindo.id)
        .eq('salao_id', profile.salao_id)

      if (errorCategoria) throw errorCategoria

      setCategorias(prev =>
        prev.filter(c => c.id !== categoriaExcluindo.id)
      )

      setGuias(prev =>
        prev.map(g =>
          g.categoria === nomeExcluido
            ? { ...g, categoria: destino }
            : g
        )
      )

      if (categoria === nomeExcluido) {
        setCategoria(destino)
      }

      if (catFiltro === nomeExcluido) {
        setCatFiltro(destino)
      }

      setModalExcluirCategoria(false)
      setCategoriaExcluindo(null)

      alert('Categoria excluída com sucesso!')
    } catch (error: any) {
      console.error(
        'Erro ao excluir categoria:',
        error
      )

      alert(
        'Erro ao excluir categoria: ' +
        (error?.message || 'Tente novamente.')
      )
    } finally {
      setSalvandoCategoria(false)
    }
  }

  // ============================================================
  // UPLOAD
  // ============================================================

  async function handleUploadImagem(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const arquivo = e.target.files?.[0]

    if (!arquivo) return

    if (!arquivo.type.startsWith('image/')) {
      alert(
        'Por favor, selecione um arquivo de imagem válido.'
      )
      return
    }

    setEnviandoFoto(true)

    try {
      const extensao = arquivo.name.split('.').pop()

      const nomeArquivo =
        `${profile!.salao_id}/${Date.now()}.${extensao}`

      const { error: uploadError } =
        await supabase.storage
          .from('guias')
          .upload(
            nomeArquivo,
            arquivo,
            {
              upsert: true
            }
          )

      if (uploadError) throw uploadError

      const { data } =
        supabase.storage
          .from('guias')
          .getPublicUrl(nomeArquivo)

      if (data?.publicUrl) {
        setImagemUrl(data.publicUrl)
      }
    } catch (err: any) {
      alert(
        'Erro ao enviar imagem: ' +
        (err.message || 'Tente novamente.')
      )
    } finally {
      setEnviandoFoto(false)
    }
  }

  // ============================================================
  // GUIAS
  // ============================================================

  async function handleSalvarGuia(
    e: React.FormEvent
  ) {
    e.preventDefault()

    if (!titulo.trim() || !conteudo.trim()) {
      alert(
        'Preencha o título e as instruções do guia.'
      )
      return
    }

    if (!categoria.trim()) {
      alert('Selecione uma categoria.')
      return
    }

    setSalvando(true)

    try {
      const dadosGuia = {
        salao_id: profile!.salao_id,
        titulo: titulo.trim(),
        categoria: categoria.trim(),
        conteudo: conteudo.trim(),
        imagem_url:
          imagemUrl.trim() || null
      }

      if (idEditando) {
        const { error } =
          await supabase
            .from('guias')
            .update(dadosGuia)
            .eq('id', idEditando)
            .eq('salao_id', profile!.salao_id)

        if (error) throw error
      } else {
        const { error } =
          await supabase
            .from('guias')
            .insert([dadosGuia])

        if (error) throw error
      }

      setModalFormAberto(false)

      await carregarDados()
    } catch (err: any) {
      alert(
        'Erro ao salvar o guia: ' +
        (err.message || 'Tente novamente.')
      )
    } finally {
      setSalvando(false)
    }
  }

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

    try {
      const { error } =
        await supabase
          .from('guias')
          .delete()
          .eq('id', id)
          .eq('salao_id', profile!.salao_id)

      if (error) throw error

      if (guiaLeitura?.id === id) {
        setGuiaLeitura(null)
      }

      await carregarDados()
    } catch (err: any) {
      alert(
        'Erro ao excluir: ' +
        err.message
      )
    }
  }

  const cor =
    salao?.cor_primaria ||
    '#E91E8C'

  const guiasFiltrados =
    guias.filter(g => {
      const tituloTexto =
        String(g.titulo || '').toLowerCase()

      const conteudoTexto =
        String(g.conteudo || '').toLowerCase()

      const buscaTexto =
        busca.toLowerCase()

      const atendeBusca =
        tituloTexto.includes(buscaTexto) ||
        conteudoTexto.includes(buscaTexto)

      const atendeCat =
        catFiltro === 'Todas' ||
        g.categoria === catFiltro

      return atendeBusca && atendeCat
    })

  const categoriasDisponiveis = [
    'Todas',
    ...categorias.map(c => c.nome)
  ]

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] p-4 flex items-center justify-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2"
          style={{
            borderColor: cor
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">

      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
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

          {/* GERENCIAR CATEGORIAS */}
          <button
            onClick={() =>
              setModalCategoriasAberto(true)
            }
            className="w-9 h-9 rounded-full flex items-center justify-center border border-gray-200 bg-white"
            title="Gerenciar categorias"
          >
            <FolderEdit
              size={17}
              style={{
                color: cor
              }}
            />
          </button>

          {/* NOVO GUIA */}
          <button
            onClick={abrirModalCriar}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-xs font-bold shadow-sm"
            style={{
              backgroundColor: cor
            }}
          >
            <Plus size={16} />
            Novo Guia
          </button>

        </div>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">

        {/* BARRA DE PESQUISA */}
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
              setBusca(e.target.value)
            }
            className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-gray-100 text-sm focus:outline-none shadow-sm"
          />
        </div>

        {/* CATEGORIAS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">

          {categoriasDisponiveis.map(cat => (
            <button
              key={cat}
              onClick={() =>
                setCatFiltro(cat)
              }
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                catFiltro === cat
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-100'
              }`}
              style={{
                backgroundColor:
                  catFiltro === cat
                    ? cor
                    : undefined
              }}
            >
              {cat}
            </button>
          ))}

          {/* BOTÃO + CATEGORIA */}
          <button
            onClick={abrirNovaCategoria}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-white border border-dashed"
            style={{
              borderColor: cor,
              color: cor
            }}
          >
            <span className="flex items-center gap-1">
              <Plus size={13} />
              Categoria
            </span>
          </button>

        </div>

        {/* LISTAGEM */}
        {guiasFiltrados.length === 0 ? (

          <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center space-y-3 mt-4 shadow-sm">

            <div
              className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto"
              style={{
                color: cor
              }}
            >
              <Notebook size={28} />
            </div>

            <h3 className="font-bold text-gray-800 text-base">
              Nenhum guia encontrado
            </h3>

            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {busca ||
              catFiltro !== 'Todas'
                ? 'Tente mudar a busca ou os filtros acima.'
                : 'Cadastre o primeiro guia de instrução para sua equipe.'}
            </p>

            <button
              onClick={abrirModalCriar}
              className="mt-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
              style={{
                backgroundColor: cor
              }}
            >
              <Plus size={16} />
              Cadastrar Guia
            </button>

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {guiasFiltrados.map(g => (

              <div
                key={g.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:border-pink-200 transition-all cursor-pointer"
                onClick={() =>
                  setGuiaLeitura(g)
                }
              >

                {g.imagem_url && (
                  <div className="h-44 w-full bg-gray-100 relative overflow-hidden">

                    <img
                      src={g.imagem_url}
                      alt={g.titulo}
                      className="w-full h-full object-cover"
                    />

                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col justify-between">

                  <div>

                    <div className="flex items-center justify-between gap-2 mb-2">

                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-100">
                        {g.categoria || 'Geral'}
                      </span>

                      <div
                        className="flex items-center gap-1"
                        onClick={e =>
                          e.stopPropagation()
                        }
                      >

                        <button
                          onClick={() =>
                            abrirModalEditar(g)
                          }
                          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                        >
                          <Edit2 size={15} />
                        </button>

                        <button
                          onClick={() =>
                            handleExcluirGuia(g.id)
                          }
                          className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 size={15} />
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
                      <BookOpen size={14} />
                      Ler instrução
                    </span>

                    <span className="text-[10px] text-gray-300 font-normal">
                      {new Date(
                        g.created_at
                      ).toLocaleDateString(
                        'pt-BR'
                      )}
                    </span>

                  </div>

                </div>

              </div>

            ))}

          </div>

        )}

      </div>

      {/* ============================================================
          MODAL GERENCIAR CATEGORIAS
      ============================================================ */}
      {modalCategoriasAberto && (

        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl">

            <div className="flex items-center justify-between mb-5">

              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  Categorias
                </h3>

                <p className="text-xs text-gray-400 mt-1">
                  Organize os guias da sua equipe.
                </p>
              </div>

              <button
                onClick={() =>
                  setModalCategoriasAberto(false)
                }
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>

            </div>

            <button
              onClick={abrirNovaCategoria}
              className="w-full py-3 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 mb-4"
              style={{
                backgroundColor: cor
              }}
            >
              <FolderPlus size={17} />
              Nova categoria
            </button>

            <div className="max-h-[55vh] overflow-y-auto space-y-2">

              {categorias.map(cat => {

                const quantidade =
                  guias.filter(
                    g =>
                      g.categoria ===
                      cat.nome
                  ).length

                const protegida =
                  cat.nome === 'Geral'

                return (

                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-3 bg-gray-50 rounded-2xl px-4 py-3"
                  >

                    <div className="min-w-0">

                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {cat.nome}
                      </p>

                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {quantidade}{' '}
                        {quantidade === 1
                          ? 'guia'
                          : 'guias'}
                      </p>

                    </div>

                    <div className="flex items-center gap-1 shrink-0">

                      <button
                        onClick={() =>
                          abrirEditarCategoria(cat)
                        }
                        className="p-2 rounded-xl bg-white text-gray-500 hover:text-gray-800 border border-gray-100"
                        title="Editar categoria"
                      >
                        <Edit2 size={15} />
                      </button>

                      <button
                        onClick={() =>
                          abrirExcluirCategoria(cat)
                        }
                        disabled={protegida}
                        className={`p-2 rounded-xl border border-gray-100 ${
                          protegida
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-white text-red-400 hover:text-red-600'
                        }`}
                        title={
                          protegida
                            ? 'Geral não pode ser excluída'
                            : 'Excluir categoria'
                        }
                      >
                        <Trash2 size={15} />
                      </button>

                    </div>

                  </div>

                )
              })}

            </div>

          </div>

        </div>

      )}

      {/* ============================================================
          MODAL NOVA CATEGORIA
      ============================================================ */}
      {modalNovaCategoria && (

        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">

            <div className="flex items-center justify-between mb-5">

              <h3 className="font-bold text-gray-900 text-lg">
                Nova categoria
              </h3>

              <button
                onClick={() =>
                  setModalNovaCategoria(false)
                }
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>

            </div>

            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Nome da categoria
            </label>

            <input
              autoFocus
              type="text"
              placeholder="Ex: Coloração"
              value={nomeCategoria}
              onChange={e =>
                setNomeCategoria(e.target.value)
              }
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  criarCategoria()
                }
              }}
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
            />

            <div className="flex gap-3 mt-5">

              <button
                onClick={() =>
                  setModalNovaCategoria(false)
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={criarCategoria}
                disabled={salvandoCategoria}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-medium disabled:opacity-50"
                style={{
                  backgroundColor: cor
                }}
              >
                {salvandoCategoria
                  ? 'Criando...'
                  : 'Criar categoria'}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ============================================================
          MODAL EDITAR CATEGORIA
      ============================================================ */}
      {modalEditarCategoria && categoriaEditando && (

        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">

            <div className="flex items-center justify-between mb-5">

              <h3 className="font-bold text-gray-900 text-lg">
                Editar categoria
              </h3>

              <button
                onClick={() =>
                  setModalEditarCategoria(false)
                }
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>

            </div>

            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Nome da categoria
            </label>

            <input
              autoFocus
              type="text"
              value={nomeCategoria}
              onChange={e =>
                setNomeCategoria(e.target.value)
              }
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  editarCategoria()
                }
              }}
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
            />

            <p className="text-[11px] text-gray-400 mt-2">
              Os guias que utilizam esta categoria também serão atualizados.
            </p>

            <div className="flex gap-3 mt-5">

              <button
                onClick={() =>
                  setModalEditarCategoria(false)
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={editarCategoria}
                disabled={salvandoCategoria}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-medium disabled:opacity-50"
                style={{
                  backgroundColor: cor
                }}
              >
                {salvandoCategoria
                  ? 'Salvando...'
                  : 'Salvar alteração'}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ============================================================
          MODAL EXCLUIR CATEGORIA
      ============================================================ */}
      {modalExcluirCategoria && categoriaExcluindo && (

        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">

            <div className="flex items-center gap-3 mb-4">

              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
                <FolderX size={20} />
              </div>

              <div>
                <h3 className="font-bold text-gray-900">
                  Excluir categoria
                </h3>

                <p className="text-xs text-gray-400">
                  {categoriaExcluindo.nome}
                </p>
              </div>

            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Os guias desta categoria não serão excluídos.
              Escolha para qual categoria eles devem ser transferidos.
            </p>

            <div className="mt-4">

              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Transferir guias para
              </label>

              <select
                value={categoriaDestinoExclusao}
                onChange={e =>
                  setCategoriaDestinoExclusao(
                    e.target.value
                  )
                }
                className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none"
              >

                {categorias
                  .filter(
                    c =>
                      c.id !==
                      categoriaExcluindo.id
                  )
                  .map(c => (
                    <option
                      key={c.id}
                      value={c.nome}
                    >
                      {c.nome}
                    </option>
                  ))}

              </select>

            </div>

            <div className="flex gap-3 mt-5">

              <button
                onClick={() =>
                  setModalExcluirCategoria(false)
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={excluirCategoria}
                disabled={salvandoCategoria}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {salvandoCategoria
                  ? 'Excluindo...'
                  : 'Excluir categoria'}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ============================================================
          MODAL LEITURA
      ============================================================ */}
      {guiaLeitura && (

        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">

          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl my-auto">

            {guiaLeitura.imagem_url && (

              <div className="w-full max-h-72 bg-gray-900 relative">

                <img
                  src={guiaLeitura.imagem_url}
                  alt={guiaLeitura.titulo}
                  className="w-full h-full object-contain"
                />

                <button
                  onClick={() =>
                    setGuiaLeitura(null)
                  }
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
                >
                  <X size={18} />
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
                      setGuiaLeitura(null)
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
                    const g = guiaLeitura

                    setGuiaLeitura(null)

                    abrirModalEditar(g)
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900"
                >
                  <Edit2 size={15} />
                  Editar Guia
                </button>

                <button
                  onClick={() =>
                    setGuiaLeitura(null)
                  }
                  className="px-5 py-2.5 rounded-xl text-white text-xs font-bold"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  Entendi / Fechar
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

      {/* ============================================================
          MODAL CRIAR / EDITAR GUIA
      ============================================================ */}
      {modalFormAberto && (

        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">

          <form
            onSubmit={handleSalvarGuia}
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
                  setModalFormAberto(false)
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
                  setTitulo(e.target.value)
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
                  onClick={abrirNovaCategoria}
                  className="text-[11px] font-bold flex items-center gap-1"
                  style={{
                    color: cor
                  }}
                >
                  <Plus size={12} />
                  Nova categoria
                </button>

              </div>

              <select
                value={categoria}
                onChange={e =>
                  setCategoria(e.target.value)
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none bg-white"
              >

                {categorias.length === 0 ? (
                  <option value="Geral">
                    Geral
                  </option>
                ) : (
                  categorias.map(c => (
                    <option
                      key={c.id}
                      value={c.nome}
                    >
                      {c.nome}
                    </option>
                  ))
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
                    src={imagemUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setImagemUrl('')
                    }
                    className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-md hover:bg-red-700"
                  >
                    <X size={14} />
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
                          PNG, JPG ou WEBP
                        </p>
                      </>

                    )}

                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadImagem}
                    className="hidden"
                    disabled={enviandoFoto}
                  />

                </label>

              )}

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
                  setConteudo(e.target.value)
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
                  setModalFormAberto(false)
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
                  backgroundColor: cor
                }}
              >
                {salvando
                  ? 'Salvando...'
                  : 'Salvar Guia'}
              </button>

            </div>

          </form>

        </div>

      )}

    </div>
  )
}