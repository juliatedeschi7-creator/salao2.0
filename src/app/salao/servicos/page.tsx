// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Edit2, Trash2, Clock, DollarSign, Image,
  Tag, X, Camera, MessageSquare, FileText, Share2, Filter, Settings, Check
} from 'lucide-react'

export default function ServicosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [fotos, setFotos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [orcamentos, setOrcamentos] = useState<any[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')

  const [modal, setModal] = useState(false)
  const [modalCategorias, setModalCategorias] = useState(false)
  const [modalCompartilhar, setModalCompartilhar] = useState(false)
  const [modalMensagemWhats, setModalMensagemWhats] = useState(false)
  const [modalConfigTemplate, setModalConfigTemplate] = useState(false)

  const [textoMensagemEditavel, setTextoMensagemEditavel] = useState('')
  const [templateCustomizado, setTemplateCustomizado] = useState('')
  const [categoriaCompartilhar, setCategoriaCompartilhar] = useState('Todos')
  const [modalOrcamento, setModalOrcamento] = useState<any>(null)
  const [editando, setEditando] = useState<any>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [editandoCategoria, setEditandoCategoria] = useState<any>(null)

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    categoria_ids: [] as string[],
    duracao_minutos: 60,
    sessoes: 1,
    preco: '',
    preco_minimo: '',
    custo_material: '',
    comissao_percentual: '',
    tipo_preco: 'fixo' as 'fixo' | 'variavel',
    regras_foto_orcamento: '',
  })

  const [respostaOrcamento, setRespostaOrcamento] = useState({
    texto: '',
    valor: ''
  })

  const [salvando, setSalvando] = useState(false)
  const [uploadando, setUploadando] = useState(false)
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')
  const [carregando, setCarregando] = useState(true)

  const p = profile || {}
  const salaoId = p.salao_id

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    const tipoUser = p.tipo || p.cargo || p.role || ''

    const temPermissao =
      ['dono_salao', 'socio', 'admin'].includes(tipoUser) ||
      p.acesso_total === true ||
      (tipoUser === 'funcionario' && (
        p.acesso_total === true ||
        p.permissoes?.servicos === true ||
        p.permissoes?.agenda === true
      ))

    if (!temPermissao) {
      alert('Você não tem permissão para acessar esta página.')
      router.push('/salao/dashboard')
      return
    }

    if (salaoId) carregarDados(salaoId)
  }, [loading, profile])

  async function carregarDados(idSalao: string) {
    setCarregando(true)

    const [
      salRes,
      srvsRes,
      ftsRes,
      catsRes,
      relRes,
      orcsRes
    ] = await Promise.all([
      supabase
        .from('saloes')
        .select('*')
        .eq('id', idSalao)
        .single(),

      supabase
        .from('servicos')
        .select('*')
        .eq('salao_id', idSalao)
        .eq('ativo', true)
        .order('categoria'),

      supabase
        .from('fotos_servicos')
        .select('*')
        .eq('salao_id', idSalao),

      supabase
        .from('categorias_servicos')
        .select('*')
        .eq('salao_id', idSalao)
        .order('nome'),

      supabase
        .from('servicos_categorias')
        .select('id, servico_id, categoria_id')
        .eq('salao_id', idSalao),

      supabase
        .from('solicitacoes_orcamento')
        .select('*, servicos(nome), clientes(nome)')
        .eq('salao_id', idSalao)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false }),
    ])

    if (salRes.error) {
      console.error('Erro ao carregar salão:', salRes.error)
    }

    if (srvsRes.error) {
      console.error('Erro ao carregar serviços:', srvsRes.error)
    }

    if (catsRes.error) {
      console.error('Erro ao carregar categorias:', catsRes.error)
    }

    if (relRes.error) {
      console.error('Erro ao carregar relações serviço/categoria:', relRes.error)
    }

    const cats = catsRes.data || []
    const relacoes = relRes.data || []

    const servicosComCategorias = (srvsRes.data || []).map((servico: any) => {
      const relacoesServico = relacoes.filter(
        (r: any) => r.servico_id === servico.id
      )

      let categoriaIds = relacoesServico.map(
        (r: any) => r.categoria_id
      )

      let categoriasNomes = categoriaIds
        .map((id: string) => cats.find((c: any) => c.id === id)?.nome)
        .filter(Boolean)

      // Compatibilidade com serviços antigos:
      // se por algum motivo não houver relação, usa a categoria
      // antiga armazenada em servicos.categoria.
      if (categoriaIds.length === 0 && servico.categoria) {
        const categoriaAntiga = cats.find(
          (c: any) => c.nome === servico.categoria
        )

        if (categoriaAntiga) {
          categoriaIds = [categoriaAntiga.id]
          categoriasNomes = [categoriaAntiga.nome]
        } else {
          categoriasNomes = [servico.categoria]
        }
      }

      return {
        ...servico,
        categoria_ids: categoriaIds,
        categorias_nomes: categoriasNomes,
      }
    })

    setSalao(salRes.data)
    setServicos(servicosComCategorias)
    setFotos(ftsRes.data || [])
    setCategorias(cats)
    setOrcamentos(orcsRes.data || [])

    if (salRes.data?.template_whatsapp_catalogo) {
      setTemplateCustomizado(salRes.data.template_whatsapp_catalogo)
    }

    setCarregando(false)
  }

  function toggleCategoria(categoriaId: string) {
    setForm(prev => {
      const existe = prev.categoria_ids.includes(categoriaId)

      return {
        ...prev,
        categoria_ids: existe
          ? prev.categoria_ids.filter(id => id !== categoriaId)
          : [...prev.categoria_ids, categoriaId]
      }
    })
  }

  function obterNomesCategoriasDoServico(servico: any) {
    if (servico.categorias_nomes?.length) {
      return servico.categorias_nomes
    }

    if (servico.categoria) {
      return [servico.categoria]
    }

    return []
  }

  function prepararTextoWhatsApp() {
    const servicosParaCompartilhar = categoriaCompartilhar === 'Todos'
      ? servicos
      : servicos.filter(s =>
          obterNomesCategoriasDoServico(s).includes(categoriaCompartilhar)
        )

    let corpoServicos = ''

    servicosParaCompartilhar.forEach(servico => {
      const preco = servico.tipo_preco === 'variavel'
        ? `A partir de R$ ${Number(servico.preco).toFixed(2).replace('.', ',')}`
        : `R$ ${Number(servico.preco).toFixed(2).replace('.', ',')}`

      corpoServicos += `🔹 *${servico.nome}*\n`
      corpoServicos += `💰 ${preco} | ⏱️ ${formatarDuracao(servico.duracao_minutos)}\n`

      const categoriasServico = obterNomesCategoriasDoServico(servico)

      if (categoriasServico.length > 0) {
        corpoServicos += `🏷️ ${categoriasServico.join(' • ')}\n`
      }

      if (servico.descricao) {
        corpoServicos += `📝 _${servico.descricao}_\n`
      }

      corpoServicos += `\n`
    })

    if (templateCustomizado.trim()) {
      let textoFinal = templateCustomizado
        .replace('{nome_salao}', salao?.nome || 'Nosso Salão')
        .replace('{categoria}', categoriaCompartilhar)
        .replace('{servicos}', corpoServicos)

      setTextoMensagemEditavel(textoFinal)
    } else {
      let textoPadrao = `✨ *Catálogo de Serviços - ${salao?.nome || 'Nosso Salão'}* ✨\n\n`

      if (categoriaCompartilhar !== 'Todos') {
        textoPadrao += `📌 *Categoria: ${categoriaCompartilhar}*\n\n`
      }

      textoPadrao += corpoServicos
      textoPadrao += `📲 Agende seu horário conosco!`

      setTextoMensagemEditavel(textoPadrao)
    }

    setModalCompartilhar(false)
    setModalMensagemWhats(true)
  }

  function dispararWhatsAppEditado() {
    const urlWhatsApp =
      `https://api.whatsapp.com/send?text=${encodeURIComponent(textoMensagemEditavel)}`

    window.open(urlWhatsApp, '_blank')
    setModalMensagemWhats(false)
  }

  async function salvarTemplateSalao() {
    if (!salaoId) return

    const { error } = await supabase
      .from('saloes')
      .update({
        template_whatsapp_catalogo: templateCustomizado
      })
      .eq('id', salaoId)

    if (error) {
      alert('Erro ao salvar template: ' + error.message)
    } else {
      alert('Modelo de mensagem salvo com sucesso!')
      setModalConfigTemplate(false)
    }
  }

  function gerarPdfFiltrado() {
    const urlPdf = categoriaCompartilhar === 'Todos'
      ? `/salao/catalogo`
      : `/salao/catalogo?categoria=${encodeURIComponent(categoriaCompartilhar)}`

    window.open(urlPdf, '_blank')
    setModalCompartilhar(false)
  }

  function abrirModal(s?: any) {
    setErroSalvar('')

    if (s) {
      const ids = Array.isArray(s.categoria_ids)
        ? s.categoria_ids
        : []

      let categoriaIds = ids

      if (categoriaIds.length === 0 && s.categoria) {
        const cat = categorias.find(c => c.nome === s.categoria)
        if (cat) categoriaIds = [cat.id]
      }

      setEditando(s)

      setForm({
        nome: s.nome || '',
        descricao: s.descricao || '',
        categoria_ids: categoriaIds,
        duracao_minutos: s.duracao_minutos || 60,
        sessoes: s.sessoes || 1,
        preco: s.preco?.toString() || '',
        preco_minimo: s.preco_minimo?.toString() || '',
        custo_material: s.custo_material?.toString() || '',
        comissao_percentual: s.comissao_percentual?.toString() || '',
        tipo_preco: s.tipo_preco || 'fixo',
        regras_foto_orcamento: s.regras_foto_orcamento || '',
      })
    } else {
      setEditando(null)

      setForm({
        nome: '',
        descricao: '',
        categoria_ids: categorias[0]?.id
          ? [categorias[0].id]
          : [],
        duracao_minutos: 60,
        sessoes: 1,
        preco: '',
        preco_minimo: '',
        custo_material: '',
        comissao_percentual: '',
        tipo_preco: 'fixo',
        regras_foto_orcamento: '',
      })
    }

    setModal(true)
  }

  async function sincronizarCategoriasServico(
    servicoId: string,
    categoriaIds: string[]
  ) {
    const { error: deleteError } = await supabase
      .from('servicos_categorias')
      .delete()
      .eq('servico_id', servicoId)
      .eq('salao_id', salaoId)

    if (deleteError) {
      throw new Error(
        'Não foi possível atualizar as categorias: ' +
        deleteError.message
      )
    }

    const registros = categoriaIds.map(categoriaId => ({
      salao_id: salaoId,
      servico_id: servicoId,
      categoria_id: categoriaId,
    }))

    if (registros.length === 0) return

    const { error: insertError } = await supabase
      .from('servicos_categorias')
      .insert(registros)

    if (insertError) {
      throw new Error(
        'O serviço foi salvo, mas não foi possível vincular as categorias: ' +
        insertError.message
      )
    }
  }

  async function handleSalvar() {
    setErroSalvar('')

    if (!form.nome.trim()) {
      setErroSalvar('Preencha o nome do serviço.')
      return
    }

    if (!form.preco) {
      setErroSalvar('Preencha o preço.')
      return
    }

    if (form.categoria_ids.length === 0) {
      setErroSalvar('Selecione pelo menos uma categoria.')
      return
    }

    if (!salaoId) {
      setErroSalvar('Salão não identificado.')
      return
    }

    setSalvando(true)

    try {
      const categoriasSelecionadas = categorias.filter(c =>
        form.categoria_ids.includes(c.id)
      )

      const categoriaPrincipal =
        categoriasSelecionadas[0]?.nome || ''

      const dados = {
        salao_id: salaoId,
        nome: form.nome.trim(),
        descricao: form.descricao || null,

        // Mantemos este campo por compatibilidade com o restante
        // do sistema. A fonte real das múltiplas categorias é
        // servicos_categorias.
        categoria: categoriaPrincipal,

        duracao_minutos: form.duracao_minutos,
        sessoes: form.sessoes,
        preco: parseFloat(form.preco),

        preco_minimo:
          form.tipo_preco === 'variavel' && form.preco_minimo
            ? parseFloat(form.preco_minimo)
            : null,

        custo_material: parseFloat(form.custo_material || '0'),
        comissao_percentual: parseFloat(form.comissao_percentual || '0'),
        tipo_preco: form.tipo_preco,

        regras_foto_orcamento:
          form.tipo_preco === 'variavel'
            ? (form.regras_foto_orcamento || null)
            : null,

        criado_por: p.id,
      }

      let resultado
      let servicoSalvo

      if (editando) {
        resultado = await supabase
          .from('servicos')
          .update(dados)
          .eq('id', editando.id)
          .select()
          .single()

        servicoSalvo = resultado.data
      } else {
        resultado = await supabase
          .from('servicos')
          .insert(dados)
          .select()
          .single()

        servicoSalvo = resultado.data
      }

      if (resultado.error) {
        throw new Error(resultado.error.message)
      }

      if (!servicoSalvo?.id) {
        throw new Error('O serviço foi salvo, mas não foi possível identificar o serviço criado.')
      }

      await sincronizarCategoriasServico(
        servicoSalvo.id,
        form.categoria_ids
      )

      setModal(false)
      await carregarDados(salaoId)
    } catch (error: any) {
      console.error(error)
      setErroSalvar('Erro ao salvar: ' + error.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Deseja realmente desativar este serviço?')) return

    const { error } = await supabase
      .from('servicos')
      .update({ ativo: false })
      .eq('id', id)

    if (error) {
      alert('Erro ao excluir serviço: ' + error.message)
      return
    }

    carregarDados(salaoId)
  }

  async function uploadFoto(servicoId: string, file: File) {
    setUploadando(true)

    try {
      const ext = file.name.split('.').pop()
      const path = `${salaoId}/${servicoId}/${Date.now()}.${ext}`

      const { error } = await supabase
        .storage
        .from('fotos-servicos')
        .upload(path, file)

      if (error) {
        alert('Erro ao enviar foto: ' + error.message)
        return
      }

      const { data: urlData } = supabase
        .storage
        .from('fotos-servicos')
        .getPublicUrl(path)

      await supabase
        .from('fotos_servicos')
        .insert({
          salao_id: salaoId,
          servico_id: servicoId,
          url: urlData.publicUrl,
          adicionado_por: p.id
        })

      carregarDados(salaoId)
    } finally {
      setUploadando(false)
    }
  }

  async function removerFoto(fotoId: string) {
    await supabase
      .from('fotos_servicos')
      .delete()
      .eq('id', fotoId)

    carregarDados(salaoId)
  }

  async function adicionarCategoria() {
    const nome = novaCategoria.trim()

    if (!nome) return

    const existe = categorias.some(
      c => c.nome.toLowerCase() === nome.toLowerCase()
    )

    if (existe) {
      alert('Já existe uma categoria com esse nome.')
      return
    }

    const { error } = await supabase
      .from('categorias_servicos')
      .insert({
        salao_id: salaoId,
        nome
      })

    if (error) {
      alert('Erro ao criar categoria: ' + error.message)
      return
    }

    setNovaCategoria('')
    carregarDados(salaoId)
  }

  async function editarCategoria(cat: any, novoNome: string) {
    const nome = novoNome.trim()

    if (!nome) return

    if (
      categorias.some(
        c =>
          c.id !== cat.id &&
          c.nome.toLowerCase() === nome.toLowerCase()
      )
    ) {
      alert('Já existe uma categoria com esse nome.')
      return
    }

    const { error } = await supabase
      .from('categorias_servicos')
      .update({ nome })
      .eq('id', cat.id)

    if (error) {
      alert('Erro ao editar categoria: ' + error.message)
      return
    }

    // Mantém o campo legado "categoria" sincronizado para os
    // serviços cuja categoria principal era esta.
    await supabase
      .from('servicos')
      .update({ categoria: nome })
      .eq('categoria', cat.nome)
      .eq('salao_id', salaoId)

    setEditandoCategoria(null)
    carregarDados(salaoId)
  }

  async function excluirCategoria(cat: any) {
    const emUso = servicos.some(s =>
      Array.isArray(s.categoria_ids) &&
      s.categoria_ids.includes(cat.id)
    )

    if (emUso) {
      alert(
        'Esta categoria está vinculada a um ou mais serviços. ' +
        'Retire a categoria desses serviços antes de excluí-la.'
      )
      return
    }

    if (!confirm(`Excluir a categoria "${cat.nome}"?`)) return

    const { error } = await supabase
      .from('categorias_servicos')
      .delete()
      .eq('id', cat.id)

    if (error) {
      alert('Erro ao excluir categoria: ' + error.message)
      return
    }

    carregarDados(salaoId)
  }

  async function responderOrcamento() {
    if (!modalOrcamento) return

    setSalvandoOrcamento(true)

    const { error } = await supabase
      .from('solicitacoes_orcamento')
      .update({
        status: 'respondido',
        resposta: respostaOrcamento.texto,
        valor_resposta: respostaOrcamento.valor
          ? parseFloat(respostaOrcamento.valor)
          : null,
      })
      .eq('id', modalOrcamento.id)

    if (error) {
      alert('Erro ao responder orçamento: ' + error.message)
      setSalvandoOrcamento(false)
      return
    }

    setSalvandoOrcamento(false)
    setModalOrcamento(null)
    setRespostaOrcamento({
      texto: '',
      valor: ''
    })

    carregarDados(salaoId)
  }

  function formatarDuracao(minutos: number) {
    if (minutos < 60) return `${minutos} min`

    const h = Math.floor(minutos / 60)
    const m = minutos % 60

    if (m === 0) {
      return h === 1 ? '1 hora' : `${h} horas`
    }

    return `${h} hora${h > 1 ? 's' : ''} e ${m} minutos`
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  const nomesCategorias = [
    'Todos',
    ...categorias.map(c => c.nome)
  ]

  const filtrados = servicos.filter(s => {
    if (categoriaFiltro === 'Todos') return true

    return obterNomesCategoriasDoServico(s)
      .includes(categoriaFiltro)
  })

  if (loading || carregando) {
    return (
      <div className="min-h-screen pb-8 bg-[#f8f9fa]">
        <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>

          <h1 className="font-bold text-gray-900 text-lg flex-1">
            Catálogo de Serviços
          </h1>
        </div>

        <div className="px-4 py-4 flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 animate-pulse flex flex-col gap-3"
            >
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-8 bg-[#f8f9fa]">

      {/* CABEÇALHO */}
      <div className="bg-white px-4 py-4 flex items-center gap-2 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>

        <h1 className="font-bold text-gray-900 text-lg flex-1 truncate">
          Catálogo de Serviços
        </h1>

        <button
          onClick={() => setModalConfigTemplate(true)}
          title="Configurar Modelo de Mensagem"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <Settings size={16} className="text-gray-600" />
        </button>

        <button
          onClick={() => setModalCompartilhar(true)}
          title="Compartilhar Catálogo"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <Share2 size={16} className="text-gray-600" />
        </button>

        <button
          onClick={() => router.push('/salao/catalogo')}
          title="Gerar Catálogo PDF"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <FileText size={16} className="text-gray-600" />
        </button>

        {orcamentos.length > 0 && (
          <button
            onClick={() => setModalOrcamento(orcamentos[0])}
            className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-white text-xs font-medium"
            style={{ backgroundColor: cor }}
          >
            <MessageSquare size={13} />
            {orcamentos.length}
          </button>
        )}

        <button
          onClick={() => setModalCategorias(true)}
          title="Categorias"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <Tag size={16} className="text-gray-600" />
        </button>

        <button
          onClick={() => abrirModal()}
          title="Novo serviço"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {categorias.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-2xl">
            <p className="text-sm text-yellow-700">
              Crie uma categoria antes de adicionar serviços.
              Toque no ícone de etiqueta no topo.
            </p>
          </div>
        )}

        {/* FILTRO */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {nomesCategorias.map(c => (
            <button
              key={c}
              onClick={() => setCategoriaFiltro(c)}
              className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
              style={
                categoriaFiltro === c
                  ? {
                      backgroundColor: cor,
                      color: 'white'
                    }
                  : {
                      backgroundColor: 'white',
                      color: '#6b7280'
                    }
              }
            >
              {c}
            </button>
          ))}
        </div>

        {/* SERVIÇOS */}
        {filtrados.length === 0 && categorias.length > 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl">
            <p className="text-gray-400">
              Nenhum serviço nesta categoria
            </p>

            <button
              onClick={() => abrirModal()}
              className="mt-3 px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: cor }}
            >
              + Adicionar serviço
            </button>
          </div>
        ) : (
          filtrados.map(s => {
            const fotosServico = fotos.filter(
              f => f.servico_id === s.id
            )

            const aberto = expandido === s.id
            const variavel = s.tipo_preco === 'variavel'
            const categoriasServico =
              obterNomesCategoriasDoServico(s)

            return (
              <div
                key={s.id}
                className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col gap-3"
              >

                {fotosServico.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                    {fotosServico.map(f => (
                      <div
                        key={f.id}
                        className="relative shrink-0"
                      >
                        <img
                          src={f.url}
                          alt={s.nome}
                          className="w-28 h-28 rounded-2xl object-cover"
                        />

                        <button
                          onClick={() => removerFoto(f.id)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                        >
                          <X size={12} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex-1">

                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">
                        {s.nome}
                      </p>

                      {categoriasServico.map((nome: string) => (
                        <span
                          key={nome}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
                        >
                          {nome}
                        </span>
                      ))}

                      {variavel && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: cor }}
                        >
                          Preço variável
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">

                      <div className="flex items-center gap-1">
                        <DollarSign
                          size={14}
                          style={{ color: cor }}
                        />

                        <span
                          className="text-sm font-bold"
                          style={{ color: cor }}
                        >
                          {variavel
                            ? `A partir de R$ ${Number(s.preco).toFixed(2).replace('.', ',')}`
                            : `R$ ${Number(s.preco).toFixed(2).replace('.', ',')}`
                          }
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock size={13} />
                        <span className="text-xs">
                          {formatarDuracao(s.duracao_minutos)}
                        </span>
                      </div>

                      {s.sessoes > 1 && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: cor }}
                        >
                          {s.sessoes} sessões
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 ml-2">

                    <label className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer">
                      <Image
                        size={14}
                        className="text-gray-500"
                      />

                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          if (e.target.files?.[0]) {
                            uploadFoto(
                              s.id,
                              e.target.files[0]
                            )
                          }
                        }}
                      />
                    </label>

                    <button
                      onClick={() => abrirModal(s)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                    >
                      <Edit2
                        size={14}
                        className="text-gray-500"
                      />
                    </button>

                    <button
                      onClick={() => excluir(s.id)}
                      className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"
                    >
                      <Trash2
                        size={14}
                        className="text-red-400"
                      />
                    </button>
                  </div>
                </div>

                {s.descricao && (
                  <div>
                    <button
                      onClick={() =>
                        setExpandido(
                          aberto ? null : s.id
                        )
                      }
                      className="text-sm font-medium"
                      style={{ color: cor }}
                    >
                      {aberto
                        ? 'Ocultar descrição'
                        : 'Ver descrição'}
                    </button>

                    {aberto && (
                      <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                        {s.descricao}
                      </p>
                    )}
                  </div>
                )}

                {variavel &&
                  s.regras_foto_orcamento && (
                    <div className="bg-blue-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-blue-600 flex items-start gap-1">
                        <Camera
                          size={12}
                          className="mt-0.5 shrink-0"
                        />

                        <span>
                          <span className="font-semibold">
                            Regras da foto:
                          </span>{' '}
                          {s.regras_foto_orcamento}
                        </span>
                      </p>
                    </div>
                  )}

                {s.comissao_percentual > 0 && (
                  <p className="text-xs text-gray-400">
                    Comissão: {s.comissao_percentual}%
                  </p>
                )}

                {uploadando && (
                  <p
                    className="text-xs text-center"
                    style={{ color: cor }}
                  >
                    Enviando foto...
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* MODAL TEMPLATE WHATSAPP */}
      {modalConfigTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <Settings
                  size={20}
                  style={{ color: cor }}
                />
                Modelo de Mensagem do Salão
              </h3>

              <button
                onClick={() => setModalConfigTemplate(false)}
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Personalize como o salão gosta de enviar mensagens.
              Você pode usar as tags:
              {' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-pink-600">
                {'{nome_salao}'}
              </code>
              ,{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-pink-600">
                {'{categoria}'}
              </code>
              {' '}e{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-pink-600">
                {'{servicos}'}
              </code>.
            </p>

            <textarea
              className="w-full border border-gray-200 rounded-xl p-3.5 text-sm outline-none resize-none font-mono"
              rows={8}
              placeholder={
                'Ex: Olá! Aqui é do {nome_salao}. Confira nossos serviços da categoria {categoria}:\n\n{servicos}\nQualquer dúvida estamos à disposição!'
              }
              value={templateCustomizado}
              onChange={e =>
                setTemplateCustomizado(e.target.value)
              }
            />

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setModalConfigTemplate(false)
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm"
              >
                Cancelar
              </button>

              <button
                onClick={salvarTemplateSalao}
                className="flex-1 py-3 rounded-2xl text-white font-medium text-sm shadow-sm"
                style={{ backgroundColor: cor }}
              >
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMPARTILHAR */}
      {modalCompartilhar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">

            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <Share2
                  size={20}
                  style={{ color: cor }}
                />
                Compartilhar Catálogo
              </h3>

              <button
                onClick={() =>
                  setModalCompartilhar(false)
                }
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                <Filter size={14} />
                Filtrar Categoria para Envio
              </label>

              <select
                value={categoriaCompartilhar}
                onChange={e =>
                  setCategoriaCompartilhar(e.target.value)
                }
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none bg-gray-50"
              >
                <option value="Todos">
                  Todas as categorias
                </option>

                {categorias.map(c => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">

              <button
                onClick={prepararTextoWhatsApp}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-sm"
              >
                <MessageSquare size={18} />
                Pré-visualizar e Editar WhatsApp
              </button>

              <button
                onClick={gerarPdfFiltrado}
                className="w-full text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-sm"
                style={{ backgroundColor: cor }}
              >
                <FileText size={18} />
                Gerar / Visualizar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MENSAGEM WHATSAPP */}
      {modalMensagemWhats && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <MessageSquare
                  size={20}
                  className="text-emerald-600"
                />
                Editar Mensagem do WhatsApp
              </h3>

              <button
                onClick={() =>
                  setModalMensagemWhats(false)
                }
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Ajuste o texto livremente abaixo antes de enviar.
            </p>

            <textarea
              className="w-full border border-gray-200 rounded-xl p-3.5 text-sm outline-none resize-none font-sans leading-relaxed bg-gray-50"
              rows={12}
              value={textoMensagemEditavel}
              onChange={e =>
                setTextoMensagemEditavel(e.target.value)
              }
            />

            <div className="flex gap-3 pt-2">
              <button
                onClick={() =>
                  setModalMensagemWhats(false)
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm"
              >
                Cancelar
              </button>

              <button
                onClick={dispararWhatsAppEditado}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors text-sm shadow-sm"
              >
                <Share2 size={16} />
                Disparar no WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ORÇAMENTO */}
      {modalOrcamento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">

            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                Responder orçamento
              </h3>

              <button
                onClick={() =>
                  setModalOrcamento(null)
                }
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800">
                {modalOrcamento.clientes?.nome}
              </p>

              <p className="text-xs text-gray-500">
                {modalOrcamento.servicos?.nome}
              </p>

              {modalOrcamento.foto_url && (
                <img
                  src={modalOrcamento.foto_url}
                  alt="Foto"
                  className="w-full h-48 object-cover rounded-xl mt-2"
                />
              )}

              {modalOrcamento.observacoes && (
                <p className="text-xs text-gray-500 mt-2 italic">
                  "{modalOrcamento.observacoes}"
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Valor do orçamento (R$)
              </label>

              <input
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                type="number"
                placeholder="Ex: 250,00"
                value={respostaOrcamento.valor}
                onChange={e =>
                  setRespostaOrcamento(p => ({
                    ...p,
                    valor: e.target.value
                  }))
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Mensagem para a cliente
              </label>

              <textarea
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none"
                rows={3}
                placeholder="Ex: Com base na foto, ficará R$ 250. Posso atender na quinta às 14h."
                value={respostaOrcamento.texto}
                onChange={e =>
                  setRespostaOrcamento(p => ({
                    ...p,
                    texto: e.target.value
                  }))
                }
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setModalOrcamento(null)
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={responderOrcamento}
                disabled={salvandoOrcamento}
                className="flex-1 py-3 rounded-2xl text-white font-medium"
                style={{ backgroundColor: cor }}
              >
                {salvandoOrcamento
                  ? 'Enviando...'
                  : 'Enviar resposta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATEGORIAS */}
      {modalCategorias && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                Categorias
              </h3>

              <button
                onClick={() =>
                  setModalCategorias(false)
                }
              >
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Um serviço pode pertencer a várias categorias.
              Por exemplo: <strong>Manicure + Massagem</strong>.
            </p>

            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-sm outline-none"
                placeholder="Nova categoria"
                value={novaCategoria}
                onChange={e =>
                  setNovaCategoria(e.target.value)
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    adicionarCategoria()
                  }
                }}
              />

              <button
                onClick={adicionarCategoria}
                className="px-4 rounded-xl text-white font-medium"
                style={{ backgroundColor: cor }}
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {categorias.map(cat => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2"
                >
                  {editandoCategoria?.id === cat.id ? (
                    <input
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                      defaultValue={cat.nome}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          editarCategoria(
                            cat,
                            (e.target as HTMLInputElement).value
                          )
                        }
                      }}
                      onBlur={e =>
                        editarCategoria(
                          cat,
                          e.target.value
                        )
                      }
                    />
                  ) : (
                    <div className="flex-1 flex items-center gap-2">
                      <p className="text-sm text-gray-700">
                        {cat.nome}
                      </p>

                      <span className="text-[10px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-400">
                        {servicos.filter(s =>
                          Array.isArray(s.categoria_ids) &&
                          s.categoria_ids.includes(cat.id)
                        ).length}{' '}
                        serviços
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setEditandoCategoria(cat)
                    }
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <Edit2
                      size={12}
                      className="text-gray-500"
                    />
                  </button>

                  <button
                    onClick={() =>
                      excluirCategoria(cat)
                    }
                    className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center"
                  >
                    <Trash2
                      size={12}
                      className="text-red-400"
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL SERVIÇO */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                {editando
                  ? 'Editar Serviço'
                  : 'Novo Serviço'}
              </h3>

              <button onClick={() => setModal(false)}>
                <X
                  size={20}
                  className="text-gray-400"
                />
              </button>
            </div>

            {erroSalvar && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">
                  {erroSalvar}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Nome do serviço *
              </label>

              <input
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                placeholder="Ex: Corte Feminino"
                value={form.nome}
                onChange={e =>
                  setForm(p => ({
                    ...p,
                    nome: e.target.value
                  }))
                }
              />
            </div>

            {/* MULTICATEGORIA */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Categorias *
              </label>

              <p className="text-xs text-gray-400 mb-2">
                Selecione uma ou mais categorias para este serviço.
              </p>

              {categorias.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-xs text-yellow-700">
                    Crie uma categoria primeiro.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {categorias.map(cat => {
                    const selecionada =
                      form.categoria_ids.includes(cat.id)

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          toggleCategoria(cat.id)
                        }
                        className="flex items-center gap-2 text-left px-3 py-2.5 rounded-xl border-2 transition-all"
                        style={
                          selecionada
                            ? {
                                backgroundColor: `${cor}12`,
                                borderColor: cor,
                                color: cor
                              }
                            : {
                                backgroundColor: 'white',
                                borderColor: '#e5e7eb',
                                color: '#6b7280'
                              }
                        }
                      >
                        <span
                          className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
                          style={
                            selecionada
                              ? {
                                  backgroundColor: cor,
                                  borderColor: cor
                                }
                              : {
                                  backgroundColor: 'white',
                                  borderColor: '#d1d5db'
                                }
                          }
                        >
                          {selecionada && (
                            <Check
                              size={13}
                              className="text-white"
                            />
                          )}
                        </span>

                        <span className="text-sm font-medium truncate">
                          {cat.nome}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {form.categoria_ids.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {categorias
                    .filter(c =>
                      form.categoria_ids.includes(c.id)
                    )
                    .map(c => (
                      <span
                        key={c.id}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{
                          backgroundColor: `${cor}15`,
                          color: cor
                        }}
                      >
                        {c.nome}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Descrição
              </label>

              <textarea
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none"
                rows={3}
                placeholder="Descreva o serviço, cuidados, contraindicações..."
                value={form.descricao}
                onChange={e =>
                  setForm(p => ({
                    ...p,
                    descricao: e.target.value
                  }))
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Tipo de preço
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setForm(p => ({
                      ...p,
                      tipo_preco: 'fixo'
                    }))
                  }
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold border-2 transition-all"
                  style={
                    form.tipo_preco === 'fixo'
                      ? {
                          backgroundColor: cor,
                          color: 'white',
                          borderColor: cor
                        }
                      : {
                          borderColor: '#e5e7eb',
                          color: '#6b7280'
                        }
                  }
                >
                  💰 Preço fixo
                </button>

                <button
                  onClick={() =>
                    setForm(p => ({
                      ...p,
                      tipo_preco: 'variavel'
                    }))
                  }
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold border-2 transition-all"
                  style={
                    form.tipo_preco === 'variavel'
                      ? {
                          backgroundColor: cor,
                          color: 'white',
                          borderColor: cor
                        }
                      : {
                          borderColor: '#e5e7eb',
                          color: '#6b7280'
                        }
                  }
                >
                  📊 Preço variável
                </button>
              </div>
            </div>

            {form.tipo_preco === 'fixo' ? (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Preço (R$) *
                </label>

                <input
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={form.preco}
                  onChange={e =>
                    setForm(p => ({
                      ...p,
                      preco: e.target.value
                    }))
                  }
                />
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      A partir de (R$) *
                    </label>

                    <input
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 150,00"
                      value={form.preco}
                      onChange={e =>
                        setForm(p => ({
                          ...p,
                          preco: e.target.value
                        }))
                      }
                    />
                  </div>

                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Até (R$) opcional
                    </label>

                    <input
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 400,00"
                      value={form.preco_minimo}
                      onChange={e =>
                        setForm(p => ({
                          ...p,
                          preco_minimo: e.target.value
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1">
                    <Camera size={14} />
                    Regras da foto para orçamento
                  </label>

                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none"
                    rows={3}
                    placeholder="Ex: Tire uma foto com boa iluminação, de costas, com o cabelo solto e para frente."
                    value={form.regras_foto_orcamento}
                    onChange={e =>
                      setForm(p => ({
                        ...p,
                        regras_foto_orcamento: e.target.value
                      }))
                    }
                  />

                  <p className="text-xs text-gray-400 mt-1">
                    Este texto aparece para a cliente ao solicitar orçamento.
                  </p>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Duração (min)
                </label>

                <input
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  type="number"
                  min="1"
                  value={form.duracao_minutos}
                  onChange={e =>
                    setForm(p => ({
                      ...p,
                      duracao_minutos:
                        parseInt(e.target.value) || 0
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Sessões
                </label>

                <input
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  type="number"
                  min="1"
                  value={form.sessoes}
                  onChange={e =>
                    setForm(p => ({
                      ...p,
                      sessoes:
                        parseInt(e.target.value) || 1
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Comissão %
                </label>

                <input
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={form.comissao_percentual}
                  onChange={e =>
                    setForm(p => ({
                      ...p,
                      comissao_percentual:
                        e.target.value
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Custo material (R$)
                </label>

                <input
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={form.custo_material}
                  onChange={e =>
                    setForm(p => ({
                      ...p,
                      custo_material: e.target.value
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="flex-1 py-3 rounded-2xl text-white font-medium"
                style={{ backgroundColor: cor }}
              >
                {salvando
                  ? 'Salv