// @ts-nocheck
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { toPng } from 'html-to-image'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Circle,
  Clock,
  Download,
  Flower2,
  Heart,
  Image as ImageIcon,
  Instagram,
  Layers,
  LayoutTemplate,
  Megaphone,
  Palette,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Type,
  WandSparkles,
  Smile,
  MessageCircle,
  Gift,
  Camera,
  Quote,
  PartyPopper,
  Tag,
} from 'lucide-react'

/* =========================================================
   TIPOS
========================================================= */

type ObjetivoId =
  | 'horario'
  | 'ultimas'
  | 'servico'
  | 'promocao'
  | 'novidade'
  | 'comunicado'
  | 'data'
  | 'resultado'
  | 'depoimento'
  | 'personalizado'

type FormatoId =
  | 'story'
  | 'post'
  | 'quadrado'
  | 'status'

type ElementoDecorativo =
  | 'nenhum'
  | 'flores'
  | 'estrelas'
  | 'coracoes'
  | 'bolinhas'
  | 'brilhos'
  | 'folhas'

/* =========================================================
   DADOS
========================================================= */

const OBJETIVOS = [
  {
    id: 'horario',
    titulo: 'Horário disponível',
    descricao: 'Divulgue uma vaga que acabou de surgir.',
    icon: Clock,
  },
  {
    id: 'ultimas',
    titulo: 'Últimas vagas',
    descricao: 'Mostre que restam poucos horários.',
    icon: Tag,
  },
  {
    id: 'servico',
    titulo: 'Serviço',
    descricao: 'Apresente um procedimento do salão.',
    icon: Sparkles,
  },
  {
    id: 'promocao',
    titulo: 'Promoção',
    descricao: 'Crie uma arte promocional.',
    icon: Gift,
  },
  {
    id: 'novidade',
    titulo: 'Novidade',
    descricao: 'Conte uma novidade para suas clientes.',
    icon: WandSparkles,
  },
  {
    id: 'comunicado',
    titulo: 'Comunicado',
    descricao: 'Avise sobre algo importante.',
    icon: MessageCircle,
  },
  {
    id: 'data',
    titulo: 'Data especial',
    descricao: 'Crie conteúdo para datas especiais.',
    icon: PartyPopper,
  },
  {
    id: 'resultado',
    titulo: 'Resultado',
    descricao: 'Mostre um trabalho realizado.',
    icon: Camera,
  },
  {
    id: 'depoimento',
    titulo: 'Depoimento',
    descricao: 'Compartilhe uma experiência de cliente.',
    icon: Quote,
  },
  {
    id: 'personalizado',
    titulo: 'Personalizado',
    descricao: 'Comece uma arte do zero.',
    icon: LayoutTemplate,
  },
]

const FORMATOS = [
  {
    id: 'story',
    nome: 'Instagram Story',
    proporcao: '9:16',
    largura: 1080,
    altura: 1920,
    icon: Instagram,
  },
  {
    id: 'post',
    nome: 'Instagram Post',
    proporcao: '4:5',
    largura: 1080,
    altura: 1350,
    icon: Instagram,
  },
  {
    id: 'quadrado',
    nome: 'Post quadrado',
    proporcao: '1:1',
    largura: 1080,
    altura: 1080,
    icon: Circle,
  },
  {
    id: 'status',
    nome: 'WhatsApp Status',
    proporcao: '9:16',
    largura: 1080,
    altura: 1920,
    icon: MessageCircle,
  },
]

const FONTES = [
  {
    id: 'serif',
    nome: 'Clássica',
    css: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'sans',
    nome: 'Moderna',
    css: 'Arial, Helvetica, sans-serif',
  },
  {
    id: 'elegante',
    nome: 'Elegante',
    css: '"Trebuchet MS", Arial, sans-serif',
  },
  {
    id: 'minimal',
    nome: 'Minimal',
    css: 'Verdana, Geneva, sans-serif',
  },
  {
    id: 'romantica',
    nome: 'Romântica',
    css: '"Brush Script MT", "Segoe Script", cursive',
  },
  {
    id: 'forte',
    nome: 'Impacto',
    css: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
  },
]

const MODELOS = [
  {
    id: 'floral',
    nome: 'Floral delicado',
    descricao: 'Flores, leveza e elegância',
    fundo: '#F9EFF2',
    texto: '#573B44',
    secundario: '#8D6975',
    destaque: '#D98FA5',
    decoracao: 'flores',
    fonte: 'serif',
    alinhamento: 'center',
  },
  {
    id: 'clean',
    nome: 'Clean',
    descricao: 'Claro, moderno e sofisticado',
    fundo: '#FFFFFF',
    texto: '#252525',
    secundario: '#707070',
    destaque: '#D98FA5',
    decoracao: 'nenhum',
    fonte: 'sans',
    alinhamento: 'center',
  },
  {
    id: 'rose',
    nome: 'Rose',
    descricao: 'Feminino e marcante',
    fundo: '#D98FA5',
    texto: '#FFFFFF',
    secundario: '#FFF5F7',
    destaque: '#FFFFFF',
    decoracao: 'flores',
    fonte: 'elegante',
    alinhamento: 'center',
  },
  {
    id: 'editorial',
    nome: 'Editorial',
    descricao: 'Visual de revista',
    fundo: '#F3F0EC',
    texto: '#292724',
    secundario: '#77716A',
    destaque: '#8D7565',
    decoracao: 'nenhum',
    fonte: 'serif',
    alinhamento: 'left',
  },
  {
    id: 'romantico',
    nome: 'Romântico',
    descricao: 'Delicado e acolhedor',
    fundo: '#FCECEF',
    texto: '#7B4D5A',
    secundario: '#A16E7B',
    destaque: '#D98FA5',
    decoracao: 'coracoes',
    fonte: 'romantica',
    alinhamento: 'center',
  },
  {
    id: 'botanico',
    nome: 'Botânico',
    descricao: 'Natural e orgânico',
    fundo: '#F1F3EC',
    texto: '#3D4A38',
    secundario: '#68705F',
    destaque: '#728567',
    decoracao: 'folhas',
    fonte: 'serif',
    alinhamento: 'center',
  },
  {
    id: 'luxo',
    nome: 'Luxo',
    descricao: 'Escuro, elegante e premium',
    fundo: '#242222',
    texto: '#FFFFFF',
    secundario: '#D5D0D0',
    destaque: '#D7A7B5',
    decoracao: 'brilhos',
    fonte: 'serif',
    alinhamento: 'center',
  },
  {
    id: 'impacto',
    nome: 'Impacto',
    descricao: 'Grande, direto e chamativo',
    fundo: '#D98FA5',
    texto: '#FFFFFF',
    secundario: '#FFF7F9',
    destaque: '#FFFFFF',
    decoracao: 'estrelas',
    fonte: 'forte',
    alinhamento: 'center',
  },
  {
    id: 'soft',
    nome: 'Soft',
    descricao: 'Suave e contemporâneo',
    fundo: '#FAF7F5',
    texto: '#4E4744',
    secundario: '#817873',
    destaque: '#B99285',
    decoracao: 'bolinhas',
    fonte: 'minimal',
    alinhamento: 'center',
  },
  {
    id: 'minimalista',
    nome: 'Minimalista',
    descricao: 'Poucos elementos e muito espaço',
    fundo: '#FFFFFF',
    texto: '#1E1E1E',
    secundario: '#666666',
    destaque: '#D98FA5',
    decoracao: 'nenhum',
    fonte: 'minimal',
    alinhamento: 'left',
  },
]

const EMOJIS = [
  '✨',
  '💗',
  '💕',
  '💖',
  '🌸',
  '🌷',
  '🌺',
  '💅',
  '💇‍♀️',
  '💆‍♀️',
  '🧖‍♀️',
  '👑',
  '🤍',
  '🩷',
  '⭐',
  '🌟',
  '🎀',
  '🥰',
  '📅',
  '⏰',
  '📲',
  '💌',
  '🔥',
  '🎉',
]

/* =========================================================
   HELPERS
========================================================= */

function obterValorServico(servico: any) {
  const campos = [
    'valor',
    'preco',
    'preco_venda',
    'valor_servico',
    'valor_cobrado',
  ]

  for (const campo of campos) {
    const valor = Number(servico?.[campo])

    if (
      Number.isFinite(valor) &&
      valor > 0
    ) {
      return valor
    }
  }

  return null
}

function formatarMoeda(valor: any) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) return ''

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function obterImagemServico(servico: any) {
  if (!servico) return ''

  const campos = [
    'imagem_url',
    'foto_url',
    'imagem',
    'foto',
    'foto_url_principal',
    'imagem_principal',
  ]

  for (const campo of campos) {
    if (servico?.[campo]) {
      return servico[campo]
    }
  }

  if (Array.isArray(servico?.fotos)) {
    return servico.fotos[0] || ''
  }

  if (Array.isArray(servico?.imagens)) {
    return servico.imagens[0] || ''
  }

  return ''
}

function obterNomeSalao(salao: any) {
  return (
    salao?.nome ||
    salao?.nome_fantasia ||
    salao?.razao_social ||
    'Seu salão'
  )
}

function obterCorSalao(salao: any) {
  return (
    salao?.cor_primaria ||
    salao?.cor_principal ||
    salao?.cor ||
    '#D98FA5'
  )
}

function luminancia(hex: string) {
  const valor = String(hex || '')
    .replace('#', '')
    .trim()

  if (valor.length !== 6) return 0.7

  const r = parseInt(valor.substring(0, 2), 16) / 255
  const g = parseInt(valor.substring(2, 4), 16) / 255
  const b = parseInt(valor.substring(4, 6), 16) / 255

  return (
    0.2126 * r +
    0.7152 * g +
    0.0722 * b
  )
}

function dataParaInput(valor: string) {
  if (!valor) return ''

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) return ''

  const ano = data.getFullYear()
  const mes = String(
    data.getMonth() + 1
  ).padStart(2, '0')
  const dia = String(
    data.getDate()
  ).padStart(2, '0')

  return `${ano}-${mes}-${dia}`
}

function horaLocal(valor: string) {
  if (!valor) return ''

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) return ''

  return data.toLocaleTimeString(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  )
}

function dataLocalBonita(valor: string) {
  if (!valor) return ''

  const data = new Date(
    `${valor}T12:00:00`
  )

  if (Number.isNaN(data.getTime())) return ''

  return data.toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: 'long',
    }
  )
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function OrganizaPostagensPage() {
  const {
    profile,
    loading: authLoading,
  } = useAuth()

  const router = useRouter()

  const previewRef =
    useRef<HTMLDivElement>(null)

  const arquivoImagemRef =
    useRef<HTMLInputElement>(null)

  const [carregando, setCarregando] =
    useState(true)

  const [salao, setSalao] =
    useState<any>(null)

  const [servicos, setServicos] =
    useState<any[]>([])

  const [horarios, setHorarios] =
    useState<any[]>([])

  const [profissionais, setProfissionais] =
    useState<any[]>([])

  const [etapa, setEtapa] =
    useState(1)

  const [objetivo, setObjetivo] =
    useState<ObjetivoId>('horario')

  const [formato, setFormato] =
    useState<FormatoId>('story')

  const [modelo, setModelo] =
    useState('floral')

  const [
    servicoSelecionado,
    setServicoSelecionado,
  ] = useState('')

  const [
    horarioSelecionado,
    setHorarioSelecionado,
  ] = useState('')

  const [imagemExtra, setImagemExtra] =
    useState('')

  const [titulo, setTitulo] =
    useState('Horário disponível')

  const [subtitulo, setSubtitulo] =
    useState(
      'Ainda temos um horário esperando por você'
    )

  const [cta, setCta] =
    useState('Agende pelo WhatsApp')

  const [textoExtra, setTextoExtra] =
    useState('')

  const [mostrarLogo, setMostrarLogo] =
    useState(true)

  const [mostrarData, setMostrarData] =
    useState(true)

  const [mostrarHorario, setMostrarHorario] =
    useState(true)

  const [mostrarServico, setMostrarServico] =
    useState(true)

  const [
    mostrarProfissional,
    setMostrarProfissional,
  ] = useState(false)

  const [mostrarPreco, setMostrarPreco] =
    useState(false)

  const [mostrarEmoji, setMostrarEmoji] =
    useState(true)

  const [emoji, setEmoji] =
    useState('✨')

  const [
    mostrarDecoracao,
    setMostrarDecoracao,
  ] = useState(true)

  const [decoracao, setDecoracao] =
    useState<ElementoDecorativo>('flores')

  const [fonte, setFonte] =
    useState('serif')

  const [alinhamento, setAlinhamento] =
    useState<
      'left' | 'center' | 'right'
    >('center')

  const [corFundo, setCorFundo] =
    useState('#F9EFF2')

  const [corTexto, setCorTexto] =
    useState('#573B44')

  const [corDestaque, setCorDestaque] =
    useState('#D98FA5')

  const [
    arredondamento,
    setArredondamento,
  ] = useState(28)

  const [
    intensidadeDecoracao,
    setIntensidadeDecoracao,
  ] = useState(60)

  const [
    tamanhoTitulo,
    setTamanhoTitulo,
  ] = useState(46)

  const [
    tamanhoSubtitulo,
    setTamanhoSubtitulo,
  ] = useState(19)

  const [
    tamanhoCta,
    setTamanhoCta,
  ] = useState(15)

  const [
    posicaoTituloX,
    setPosicaoTituloX,
  ] = useState(50)

  const [
    posicaoTituloY,
    setPosicaoTituloY,
  ] = useState(36)

  const [
    posicaoSubtituloY,
    setPosicaoSubtituloY,
  ] = useState(48)

  const [
    posicaoCtaY,
    setPosicaoCtaY,
  ] = useState(82)

  const [
    imagemOpacidade,
    setImagemOpacidade,
  ] = useState(100)

  const [
    imagemEscala,
    setImagemEscala,
  ] = useState(100)

  const [baixando, setBaixando] =
    useState(false)

  const [erro, setErro] =
    useState('')

  /* =========================================================
     CARREGAMENTO
  ========================================================= */

  useEffect(() => {
    if (authLoading) return

    if (!profile) {
      router.push('/login')
      return
    }

    carregarDados()
  }, [profile, authLoading])

  useEffect(() => {
    if (
      typeof window === 'undefined'
    ) {
      return
    }

    const params =
      new URLSearchParams(
        window.location.search
      )

    const horarioId =
      params.get('horarioId')

    if (horarioId) {
      setHorarioSelecionado(
        horarioId
      )

      setObjetivo('horario')
      setEtapa(2)
    }
  }, [])

  const carregarDados = async () => {
    if (!profile?.salao_id) return

    try {
      setCarregando(true)
      setErro('')

      const [
        salaoResponse,
        servicosResponse,
        horariosResponse,
        profissionaisResponse,
      ] = await Promise.all([
        supabase
          .from('saloes')
          .select('*')
          .eq(
            'id',
            profile.salao_id
          )
          .maybeSingle(),

        supabase
          .from('servicos')
          .select('*')
          .eq(
            'salao_id',
            profile.salao_id
          )
          .order('nome'),

        supabase
          .from('horarios_vagos')
          .select(`
            *,
            servicos:servico_id(id, nome),
            profiles:profissional_id(id, nome)
          `)
          .eq(
            'salao_id',
            profile.salao_id
          )
          .eq(
            'reservado',
            false
          )
          .order(
            'data_hora',
            {
              ascending: true,
            }
          ),

        supabase
          .from('profiles')
          .select(
            'id, nome'
          )
          .eq(
            'salao_id',
            profile.salao_id
          )
          .order('nome'),
      ])

      if (salaoResponse.error) {
        console.error(
          'Erro ao carregar salão:',
          salaoResponse.error
        )
      }

      if (servicosResponse.error) {
        console.error(
          'Erro ao carregar serviços:',
          servicosResponse.error
        )
      }

      if (horariosResponse.error) {
        console.error(
          'Erro ao carregar horários:',
          horariosResponse.error
        )
      }

      if (
        profissionaisResponse.error
      ) {
        console.error(
          'Erro ao carregar profissionais:',
          profissionaisResponse.error
        )
      }

      setSalao(
        salaoResponse.data || null
      )

      setServicos(
        servicosResponse.data || []
      )

      setHorarios(
        horariosResponse.data || []
      )

      setProfissionais(
        profissionaisResponse.data || []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar Organiza Postagens:',
        error
      )

      setErro(
        'Não foi possível carregar os dados do salão.'
      )
    } finally {
      setCarregando(false)
    }
  }

  /* =========================================================
     DADOS DERIVADOS
  ========================================================= */

  const corSalao =
    obterCorSalao(salao)

  const nomeSalao =
    obterNomeSalao(salao)

  const logoSalao =
    salao?.logo_url ||
    salao?.logo ||
    '/icon.png'

  const modeloAtual =
    MODELOS.find(
      (item) =>
        item.id === modelo
    ) || MODELOS[0]

  const formatoAtual =
    FORMATOS.find(
      (item) =>
        item.id === formato
    ) || FORMATOS[0]

  const fonteAtual =
    FONTES.find(
      (item) =>
        item.id === fonte
    ) || FONTES[0]

  const horarioAtual =
    horarios.find(
      (item) =>
        item.id ===
        horarioSelecionado
    )

  const servicoDoHorario =
    horarioAtual?.servicos

  const servicoAtual =
    servicos.find(
      (item) =>
        item.id ===
        servicoSelecionado
    ) || servicoDoHorario

  const profissionalAtual =
    horarioAtual?.profiles ||
    profissionais.find(
      (item) =>
        item.id ===
        horarioAtual?.profissional_id
    )

  const valorServico =
    obterValorServico(
      servicoAtual
    )

  const imagemServico =
    obterImagemServico(
      servicoAtual
    )

  const imagemPreview =
    imagemExtra || imagemServico

  const horariosValidos =
    horarios.filter(
      (horario) => {
        const data =
          new Date(
            horario.data_hora
          )

        return (
          !horario.reservado &&
          data.getTime() >=
            Date.now()
        )
      }
    )

  const modeloRecomendado =
    useMemo(() => {
      const lum =
        luminancia(corSalao)

      if (lum < 0.35) {
        return (
          MODELOS.find(
            (item) =>
              item.id ===
              'luxo'
          ) || MODELOS[0]
        )
      }

      if (lum > 0.82) {
        return (
          MODELOS.find(
            (item) =>
              item.id ===
              'clean'
          ) || MODELOS[0]
        )
      }

      return (
        MODELOS.find(
          (item) =>
            item.id ===
            'floral'
        ) || MODELOS[0]
      )
    }, [corSalao])

  /* =========================================================
     OBJETIVO
  ========================================================= */

  const selecionarObjetivo = (
    id: ObjetivoId
  ) => {
    setObjetivo(id)

    if (id === 'horario') {
      setTitulo(
        'Horário disponível'
      )

      setSubtitulo(
        'Ainda temos um horário esperando por você'
      )

      setCta(
        'Agende pelo WhatsApp'
      )

      setMostrarHorario(true)
      setMostrarServico(true)
      setMostrarData(true)
    }

    if (id === 'ultimas') {
      setTitulo(
        'Últimas vagas'
      )

      setSubtitulo(
        'Poucos horários disponíveis'
      )

      setCta(
        'Garanta seu horário'
      )

      setMostrarHorario(true)
      setMostrarServico(true)
      setMostrarData(true)
    }

    if (id === 'servico') {
      setTitulo(
        servicoAtual?.nome ||
          'Conheça nosso serviço'
      )

      setSubtitulo(
        servicoAtual?.descricao ||
          'Um cuidado especial pensado para você'
      )

      setCta(
        'Agende seu horário'
      )

      setMostrarHorario(false)
      setMostrarData(false)
      setMostrarServico(true)
      setMostrarPreco(true)
    }

    if (id === 'promocao') {
      setTitulo(
        'Uma condição especial para você'
      )

      setSubtitulo(
        'Aproveite enquanto estiver disponível'
      )

      setCta(
        'Quero aproveitar'
      )

      setMostrarPreco(true)
    }

    if (id === 'novidade') {
      setTitulo(
        'Tem novidade por aqui ✨'
      )

      setSubtitulo(
        'Descubra o que preparamos para você'
      )

      setCta(
        'Saiba mais'
      )
    }

    if (id === 'comunicado') {
      setTitulo(
        'Um aviso importante'
      )

      setSubtitulo(
        'Confira as informações do nosso salão'
      )

      setCta('Entendi')
    }

    if (id === 'data') {
      setTitulo(
        'Uma data para celebrar'
      )

      setSubtitulo(
        'Prepare algo especial com quem você ama'
      )

      setCta(
        'Agende seu horário'
      )
    }

    if (id === 'resultado') {
      setTitulo(
        'Resultado que amamos'
      )

      setSubtitulo(
        'Mais um trabalho realizado com carinho'
      )

      setCta(
        'Agende o seu'
      )
    }

    if (id === 'depoimento') {
      setTitulo(
        'Palavras que aquecem o coração'
      )

      setSubtitulo(
        '“Seu atendimento foi maravilhoso!”'
      )

      setCta(
        'Venha viver essa experiência'
      )
    }

    if (
      id === 'personalizado'
    ) {
      setTitulo(
        'Seu título aqui'
      )

      setSubtitulo(
        'Escreva a mensagem que quiser'
      )

      setCta(
        'Seu botão'
      )
    }
  }

  /* =========================================================
     MODELO
  ========================================================= */

  const aplicarModelo = (
    item: any
  ) => {
    setModelo(item.id)
    setCorFundo(item.fundo)
    setCorTexto(item.texto)
    setCorDestaque(
      item.destaque
    )
    setDecoracao(
      item.decoracao
    )
    setFonte(item.fonte)
    setAlinhamento(
      item.alinhamento
    )
  }

  const usarModeloRecomendado =
    () => {
      aplicarModelo(
        modeloRecomendado
      )
    }

  /* =========================================================
     SELEÇÃO DE HORÁRIO
  ========================================================= */

  const selecionarHorario = (
    id: string
  ) => {
    setHorarioSelecionado(id)

    const horario =
      horarios.find(
        (item) =>
          item.id === id
      )

    if (horario?.servico_id) {
      setServicoSelecionado(
        horario.servico_id
      )
    }
  }

  /* =========================================================
     UPLOAD DE IMAGEM
  ========================================================= */

  const selecionarImagem = (
    evento: any
  ) => {
    const arquivo =
      evento.target.files?.[0]

    if (!arquivo) return

    if (
      !arquivo.type.startsWith(
        'image/'
      )
    ) {
      alert(
        'Selecione uma imagem válida.'
      )

      return
    }

    const leitor =
      new FileReader()

    leitor.onload = () => {
      setImagemExtra(
        String(
          leitor.result || ''
        )
      )
    }

    leitor.readAsDataURL(
      arquivo
    )
  }

  /* =========================================================
     DECORAÇÃO
  ========================================================= */

  const renderizarDecoracao =
    () => {
      if (
        !mostrarDecoracao ||
        decoracao === 'nenhum'
      ) {
        return null
      }

      const opacidade =
        intensidadeDecoracao /
        100

      if (
        decoracao ===
        'flores'
      ) {
        return (
          <>
            <Flower2
              className="absolute -left-5 top-8"
              size={92}
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade,
                transform:
                  'rotate(-20deg)',
              }}
            />

            <Flower2
              className="absolute -right-5 bottom-10"
              size={78}
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade *
                  0.75,
                transform:
                  'rotate(25deg)',
              }}
            />
          </>
        )
      }

      if (
        decoracao ===
        'estrelas'
      ) {
        return (
          <>
            <Star
              className="absolute left-8 top-14"
              size={34}
              fill={
                corDestaque
              }
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade,
              }}
            />

            <Star
              className="absolute right-8 top-28"
              size={22}
              fill={
                corDestaque
              }
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade *
                  0.7,
              }}
            />

            <Star
              className="absolute right-12 bottom-20"
              size={32}
              fill={
                corDestaque
              }
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade *
                  0.85,
              }}
            />
          </>
        )
      }

      if (
        decoracao ===
        'coracoes'
      ) {
        return (
          <>
            <Heart
              className="absolute left-6 top-16"
              size={48}
              fill={
                corDestaque
              }
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade,
                transform:
                  'rotate(-15deg)',
              }}
            />

            <Heart
              className="absolute right-8 bottom-24"
              size={54}
              fill={
                corDestaque
              }
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade *
                  0.75,
                transform:
                  'rotate(12deg)',
              }}
            />
          </>
        )
      }

      if (
        decoracao ===
        'bolinhas'
      ) {
        return (
          <>
            <Circle
              className="absolute left-7 top-16"
              size={25}
              fill={
                corDestaque
              }
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade,
              }}
            />

            <Circle
              className="absolute right-8 top-28"
              size={15}
              fill={
                corDestaque
              }
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade *
                  0.7,
              }}
            />

            <Circle
              className="absolute right-12 bottom-16"
              size={30}
              fill={
                corDestaque
              }
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade *
                  0.65,
              }}
            />
          </>
        )
      }

      if (
        decoracao ===
        'brilhos'
      ) {
        return (
          <>
            <Sparkles
              className="absolute left-7 top-16"
              size={50}
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade,
              }}
            />

            <Sparkles
              className="absolute right-7 bottom-20"
              size={60}
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade *
                  0.7,
              }}
            />
          </>
        )
      }

      if (
        decoracao ===
        'folhas'
      ) {
        return (
          <>
            <Flower2
              className="absolute left-[-8px] top-12"
              size={100}
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade,
                transform:
                  'rotate(-35deg)',
              }}
            />

            <Flower2
              className="absolute right-[-8px] bottom-14"
              size={90}
              style={{
                color:
                  corDestaque,
                opacity:
                  opacidade *
                  0.75,
                transform:
                  'rotate(35deg)',
              }}
            />
          </>
        )
      }

      return null
    }

  /* =========================================================
     DOWNLOAD
  ========================================================= */

  const baixarImagem =
    async () => {
      if (
        !previewRef.current
      ) {
        return
      }

      setBaixando(true)

      try {
        const imagem =
          await toPng(
            previewRef.current,
            {
              cacheBust: true,
              pixelRatio: 3,
              quality: 1,
              backgroundColor:
                corFundo,
            }
          )

        const link =
          document.createElement(
            'a'
          )

        link.download =
          `organiza-postagem-${Date.now()}.png`

        link.href = imagem

        link.click()
      } catch (error) {
        console.error(
          'Erro ao gerar imagem:',
          error
        )

        alert(
          'Não foi possível gerar a imagem. Tente novamente.'
        )
      } finally {
        setBaixando(false)
      }
    }

  /* =========================================================
     RESET
  ========================================================= */

  const restaurarModelo =
    () => {
      aplicarModelo(
        modeloRecomendado
      )

      setTamanhoTitulo(46)
      setTamanhoSubtitulo(19)
      setTamanhoCta(15)

      setPosicaoTituloX(50)
      setPosicaoTituloY(36)
      setPosicaoSubtituloY(48)
      setPosicaoCtaY(82)

      setArredondamento(28)
      setIntensidadeDecoracao(60)
      setImagemOpacidade(100)
      setImagemEscala(100)
    }

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    authLoading ||
    carregando
  ) {
    return (
      <main className="min-h-screen bg-[#faf7f8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-11 h-11 rounded-full border-4 border-pink-100 border-t-pink-500 animate-spin mx-auto mb-4" />

          <p className="text-sm text-gray-500">
            Preparando o Organiza Postagens...
          </p>
        </div>
      </main>
    )
  }

  /* =========================================================
     PREVIEW
  ========================================================= */

  const previewEscala =
    formato === 'story' ||
    formato === 'status'
      ? 0.34
      : formato === 'post'
      ? 0.43
      : 0.48

  const previewLargura =
    formatoAtual.largura *
    previewEscala

  const previewAltura =
    formatoAtual.altura *
    previewEscala

  return (
    <main className="min-h-screen bg-[#faf7f8] pb-16">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-gray-800">
                  Organiza Postagens
                </h1>

                <span className="hidden sm:inline-flex text-[10px] uppercase tracking-wider font-semibold bg-pink-50 text-pink-600 px-2 py-1 rounded-full">
                  Postagens
                </span>
              </div>

              <p className="text-xs text-gray-500">
                Crie conteúdos para o seu salão
              </p>
            </div>

            <button
              type="button"
              onClick={
                baixarImagem
              }
              disabled={baixando}
              className="rounded-xl bg-[#d98fa5] text-white px-3 sm:px-4 py-2.5 text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />

              <span className="hidden sm:inline">
                {baixando
                  ? 'Gerando...'
                  : 'Baixar'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ===================================================
            ERRO
        =================================================== */}

        {erro && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {erro}
          </div>
        )}

        {/* ===================================================
            PROGRESSO
        =================================================== */}

        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>
              Etapa {etapa} de 4
            </span>

            <span>
              {etapa === 1 &&
                'Escolha o conteúdo'}

              {etapa === 2 &&
                'Escolha os dados'}

              {etapa === 3 &&
                'Escolha o modelo'}

              {etapa === 4 &&
                'Personalize sua arte'}
            </span>
          </div>

          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#d98fa5] transition-all duration-300"
              style={{
                width: `${etapa * 25}%`,
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] gap-6 items-start">
          {/* =================================================
              EDITOR
          ================================================= */}

          <section className="space-y-5">
            {/* ===============================================
                ETAPA 1
            =============================================== */}

            {etapa === 1 && (
              <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6">
                <div className="mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center mb-4">
                    <Megaphone className="w-6 h-6 text-[#d98fa5]" />
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                    O que você quer divulgar?
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Escolha o objetivo e o Organiza prepara a estrutura da sua postagem.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {OBJETIVOS.map(
                    (item) => {
                      const Icon =
                        item.icon

                      const ativo =
                        objetivo ===
                        item.id

                      return (
                        <button
                          key={
                            item.id
                          }
                          type="button"
                          onClick={() =>
                            selecionarObjetivo(
                              item.id as ObjetivoId
                            )
                          }
                          className={`text-left rounded-2xl border-2 p-4 transition ${
                            ativo
                              ? 'border-[#d98fa5] bg-[#fff7f9]'
                              : 'border-gray-100 bg-white hover:border-pink-100'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                              ativo
                                ? 'bg-[#d98fa5] text-white'
                                : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>

                          <p className="font-semibold text-sm text-gray-800">
                            {
                              item.titulo
                            }
                          </p>

                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            {
                              item.descricao
                            }
                          </p>
                        </button>
                      )
                    }
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEtapa(2)
                  }
                  className="w-full mt-6 rounded-2xl bg-[#d98fa5] text-white py-3.5 font-semibold flex items-center justify-center gap-2"
                >
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </section>
            )}

            {/* ===============================================
                ETAPA 2
            =============================================== */}

            {etapa === 2 && (
              <>
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-[#d98fa5]" />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-800">
                        Vamos aproveitar os dados do Organiza
                      </h2>

                      <p className="text-sm text-gray-500 mt-1">
                        Você não precisa digitar novamente o que já está cadastrado.
                      </p>
                    </div>
                  </div>

                  {(objetivo ===
                    'horario' ||
                    objetivo ===
                      'ultimas') && (
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Escolha o horário
                      </label>

                      {horariosValidos.length ===
                      0 ? (
                        <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
                          Nenhum horário disponível encontrado.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {horariosValidos.map(
                            (horario) => {
                              const ativo =
                                horarioSelecionado ===
                                horario.id

                              return (
                                <button
                                  key={
                                    horario.id
                                  }
                                  type="button"
                                  onClick={() =>
                                    selecionarHorario(
                                      horario.id
                                    )
                                  }
                                  className={`w-full text-left rounded-2xl border-2 p-4 transition ${
                                    ativo
                                      ? 'border-[#d98fa5] bg-[#fff7f9]'
                                      : 'border-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-pink-50 flex flex-col items-center justify-center">
                                      <Clock className="w-4 h-4 text-[#d98fa5]" />

                                      <span className="text-xs font-bold text-[#c87891] mt-1">
                                        {horaLocal(
                                          horario.data_hora
                                        )}
                                      </span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-sm text-gray-800">
                                        {horario
                                          ?.servicos
                                          ?.nome ||
                                          'Procedimento'}
                                      </p>

                                      <p className="text-xs text-gray-500 mt-1">
                                        {dataLocalBonita(
                                          dataParaInput(
                                            horario.data_hora
                                          )
                                        )}
                                      </p>

                                      {horario
                                        ?.profiles
                                        ?.nome && (
                                        <p className="text-xs text-gray-400 mt-0.5">
                                          {
                                            horario.profiles.nome
                                          }
                                        </p>
                                      )}
                                    </div>

                                    {ativo && (
                                      <div className="w-7 h-7 rounded-full bg-[#d98fa5] text-white flex items-center justify-center">
                                        <Check className="w-4 h-4" />
                                      </div>
                                    )}
                                  </div>
                                </button>
                              )
                            }
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {objetivo ===
                    'servico' && (
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Escolha o procedimento
                      </label>

                      <select
                        value={
                          servicoSelecionado
                        }
                        onChange={(e) =>
                          setServicoSelecionado(
                            e.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-pink-300"
                      >
                        <option value="">
                          Selecione um procedimento
                        </option>

                        {servicos.map(
                          (servico) => (
                            <option
                              key={
                                servico.id
                              }
                              value={
                                servico.id
                              }
                            >
                              {
                                servico.nome
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  )}

                  {(objetivo ===
                    'resultado' ||
                    objetivo ===
                      'depoimento' ||
                    objetivo ===
                      'novidade' ||
                    objetivo ===
                      'data') && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">
                          Imagem da postagem
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              arquivoImagemRef.current?.click()
                            }
                            className="rounded-2xl border-2 border-dashed border-gray-200 p-5 flex flex-col items-center justify-center text-center hover:border-pink-200"
                          >
                            <ImageIcon className="w-7 h-7 text-gray-400 mb-2" />

                            <span className="text-sm font-medium text-gray-700">
                              Adicionar imagem
                            </span>

                            <span className="text-xs text-gray-400 mt-1">
                              Do seu celular
                            </span>
                          </button>

                          <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-xs text-gray-500 mb-2">
                              Ou cole o endereço da imagem
                            </p>

                            <input
                              type="url"
                              value={
                                imagemExtra.startsWith(
                                  'data:'
                                )
                                  ? ''
                                  : imagemExtra
                              }
                              onChange={(e) =>
                                setImagemExtra(
                                  e.target.value
                                )
                              }
                              placeholder="https://..."
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(objetivo ===
                    'promocao' ||
                    objetivo ===
                      'comunicado' ||
                    objetivo ===
                      'personalizado') && (
                    <div>
                      <p className="text-sm text-gray-600">
                        Você poderá escrever e personalizar todo o conteúdo na próxima etapa.
                      </p>
                    </div>
                  )}

                  <input
                    ref={
                      arquivoImagemRef
                    }
                    type="file"
                    accept="image/*"
                    onChange={
                      selecionarImagem
                    }
                    className="hidden"
                  />
                </section>

                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <label className="text-sm font-semibold text-gray-700 block mb-3">
                    Formato
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {FORMATOS.map(
                      (item) => {
                        const Icon =
                          item.icon

                        const ativo =
                          formato ===
                          item.id

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() =>
                              setFormato(
                                item.id as FormatoId
                              )
                            }
                            className={`rounded-2xl border-2 p-3 text-left ${
                              ativo
                                ? 'border-[#d98fa5] bg-[#fff7f9]'
                                : 'border-gray-100'
                            }`}
                          >
                            <Icon
                              className={`w-5 h-5 mb-2 ${
                                ativo
                                  ? 'text-[#d98fa5]'
                                  : 'text-gray-400'
                              }`}
                            />

                            <p className="text-xs font-semibold text-gray-700">
                              {
                                item.nome
                              }
                            </p>

                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {
                                item.proporcao
                              }
                            </p>
                          </button>
                        )
                      }
                    )}
                  </div>
                </section>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setEtapa(1)
                    }
                    className="flex-1 rounded-2xl border border-gray-200 bg-white py-3.5 font-semibold text-gray-700"
                  >
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEtapa(3)
                    }
                    className="flex-[2] rounded-2xl bg-[#d98fa5] text-white py-3.5 font-semibold flex items-center justify-center gap-2"
                  >
                    Escolher modelo
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}

            {/* ===============================================
                ETAPA 3
            =============================================== */}

            {etapa === 3 && (
              <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="font-bold text-xl text-gray-800">
                      Escolha um modelo
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                      O Organiza sugere um estilo baseado na identidade do salão, mas você pode trocar tudo.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      usarModeloRecomendado
                    }
                    className="text-xs font-semibold text-[#c87891] bg-pink-50 px-3 py-2 rounded-xl whitespace-nowrap"
                  >
                    ✨ Recomendado
                  </button>
                </div>

                <div className="rounded-2xl bg-[#fff8fa] border border-pink-100 p-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background:
                          modeloRecomendado.fundo,
                        color:
                          modeloRecomendado.destaque,
                      }}
                    >
                      <Sparkles className="w-5 h-5" />
                    </div>

                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-wide font-semibold text-pink-500">
                        Sugestão para seu salão
                      </p>

                      <p className="font-semibold text-gray-800 mt-0.5">
                        {
                          modeloRecomendado.nome
                        }
                      </p>

                      <p className="text-xs text-gray-500 mt-0.5">
                        {
                          modeloRecomendado.descricao
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        usarModeloRecomendado
                      }
                      className="rounded-xl bg-[#d98fa5] text-white px-3 py-2 text-xs font-semibold"
                    >
                      Usar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {MODELOS.map(
                    (item) => {
                      const ativo =
                        modelo ===
                        item.id

                      return (
                        <button
                          key={
                            item.id
                          }
                          type="button"
                          onClick={() =>
                            aplicarModelo(
                              item
                            )
                          }
                          className={`text-left rounded-2xl border-2 overflow-hidden transition ${
                            ativo
                              ? 'border-[#d98fa5]'
                              : 'border-gray-100'
                          }`}
                        >
                          <div
                            className="h-40 relative overflow-hidden"
                            style={{
                              background:
                                item.fundo,
                            }}
                          >
                            {item.decoracao !==
                              'nenhum' && (
                              <div
                                className="absolute inset-0 flex items-center justify-center opacity-50"
                                style={{
                                  color:
                                    item.destaque,
                                }}
                              >
                                {item.decoracao ===
                                  'flores' && (
                                  <Flower2 size={70} />
                                )}

                                {item.decoracao ===
                                  'estrelas' && (
                                  <Star
                                    size={60}
                                    fill={
                                      item.destaque
                                    }
                                  />
                                )}

                                {item.decoracao ===
                                  'coracoes' && (
                                  <Heart
                                    size={60}
                                    fill={
                                      item.destaque
                                    }
                                  />
                                )}

                                {item.decoracao ===
                                  'brilhos' && (
                                  <Sparkles size={60} />
                                )}

                                {item.decoracao ===
                                  'folhas' && (
                                  <Flower2 size={65} />
                                )}

                                {item.decoracao ===
                                  'bolinhas' && (
                                  <Circle
                                    size={45}
                                    fill={
                                      item.destaque
                                    }
                                  />
                                )}
                              </div>
                            )}

                            <div className="absolute inset-0 flex flex-col items-center justify-center px-3">
                              <span
                                className="text-[9px] uppercase tracking-[0.25em] font-semibold"
                                style={{
                                  color:
                                    item.secundario,
                                }}
                              >
                                {
                                  nomeSalao
                                }
                              </span>

                              <span
                                className="text-lg font-bold mt-2 text-center"
                                style={{
                                  color:
                                    item.texto,
                                  fontFamily:
                                    FONTES.find(
                                      (f) =>
                                        f.id ===
                                        item.fonte
                                    )?.css,
                                }}
                              >
                                Horário
                              </span>

                              <span
                                className="text-[9px] mt-1 text-center"
                                style={{
                                  color:
                                    item.secundario,
                                }}
                              >
                                disponível
                              </span>
                            </div>
                          </div>

                          <div className="p-3 bg-white">
                            <p className="text-sm font-semibold text-gray-800">
                              {
                                item.nome
                              }
                            </p>

                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {
                                item.descricao
                              }
                            </p>
                          </div>
                        </button>
                      )
                    }
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() =>
                      setEtapa(2)
                    }
                    className="flex-1 rounded-2xl border border-gray-200 bg-white py-3.5 font-semibold text-gray-700"
                  >
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEtapa(4)
                    }
                    className="flex-[2] rounded-2xl bg-[#d98fa5] text-white py-3.5 font-semibold flex items-center justify-center gap-2"
                  >
                    Personalizar
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </section>
            )}

            {/* ===============================================
                ETAPA 4
            =============================================== */}

            {etapa === 4 && (
              <>
                {/* TEXTO */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                      <Type className="w-5 h-5 text-[#d98fa5]" />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-800">
                        Textos
                      </h2>

                      <p className="text-xs text-gray-500">
                        Escreva exatamente o que deseja comunicar.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-700">
                          Título
                        </label>

                        <span className="text-[11px] text-gray-400">
                          {
                            titulo.length
                          }
                          /80
                        </span>
                      </div>

                      <input
                        maxLength={80}
                        value={
                          titulo
                        }
                        onChange={(e) =>
                          setTitulo(
                            e.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-pink-300"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-700">
                          Subtítulo
                        </label>

                        <span className="text-[11px] text-gray-400">
                          {
                            subtitulo.length
                          }
                          /150
                        </span>
                      </div>

                      <textarea
                        maxLength={150}
                        rows={3}
                        value={
                          subtitulo
                        }
                        onChange={(e) =>
                          setSubtitulo(
                            e.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none resize-none focus:border-pink-300"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Texto adicional
                      </label>

                      <input
                        value={
                          textoExtra
                        }
                        onChange={(e) =>
                          setTextoExtra(
                            e.target.value
                          )
                        }
                        placeholder="Ex.: Última vaga do dia ✨"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-pink-300"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Botão / chamada para ação
                      </label>

                      <input
                        value={cta}
                        onChange={(e) =>
                          setCta(
                            e.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-pink-300"
                      />
                    </div>
                  </div>
                </section>

                {/* DADOS */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-[#d98fa5]" />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-800">
                        Informações
                      </h2>

                      <p className="text-xs text-gray-500">
                        Escolha o que aparece automaticamente na arte.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      [
                        'Logo',
                        mostrarLogo,
                        setMostrarLogo,
                      ],
                      [
                        'Data',
                        mostrarData,
                        setMostrarData,
                      ],
                      [
                        'Horário',
                        mostrarHorario,
                        setMostrarHorario,
                      ],
                      [
                        'Procedimento',
                        mostrarServico,
                        setMostrarServico,
                      ],
                      [
                        'Profissional',
                        mostrarProfissional,
                        setMostrarProfissional,
                      ],
                      [
                        'Preço',
                        mostrarPreco,
                        setMostrarPreco,
                      ],
                    ].map(
                      (item) => (
                        <button
                          key={
                            item[0] as string
                          }
                          type="button"
                          onClick={() =>
                            (
                              item[2] as any
                            )(
                              !(
                                item[1] as boolean
                              )
                            )
                          }
                          className={`rounded-xl border p-3 flex items-center justify-between ${
                            item[1]
                              ? 'border-pink-200 bg-pink-50'
                              : 'border-gray-100'
                          }`}
                        >
                          <span className="text-sm text-gray-700">
                            {
                              item[0]
                            }
                          </span>

                          <div
                            className={`w-9 h-5 rounded-full p-0.5 transition ${
                              item[1]
                                ? 'bg-[#d98fa5]'
                                : 'bg-gray-200'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white shadow-sm transition ${
                                item[1]
                                  ? 'translate-x-4'
                                  : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </section>

                {/* FONTE E ALINHAMENTO */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                      <Type className="w-5 h-5 text-[#d98fa5]" />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-800">
                        Tipografia
                      </h2>

                      <p className="text-xs text-gray-500">
                        Escolha a personalidade da sua arte.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FONTES.map(
                      (item) => {
                        const ativo =
                          fonte ===
                          item.id

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() =>
                              setFonte(
                                item.id
                              )
                            }
                            className={`rounded-xl border-2 p-3 text-left ${
                              ativo
                                ? 'border-[#d98fa5] bg-pink-50'
                                : 'border-gray-100'
                            }`}
                          >
                            <span
                              className="text-lg text-gray-800 block"
                              style={{
                                fontFamily:
                                  item.css,
                              }}
                            >
                              Aa
                            </span>

                            <span className="text-xs text-gray-500 mt-1 block">
                              {
                                item.nome
                              }
                            </span>
                          </button>
                        )
                      }
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="text-sm font-semibold text-gray-700 block mb-2">
                      Alinhamento
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        [
                          'left',
                          'Esquerda',
                        ],
                        [
                          'center',
                          'Centro',
                        ],
                        [
                          'right',
                          'Direita',
                        ],
                      ].map(
                        ([
                          id,
                          nome,
                        ]) => (
                          <button
                            key={
                              id
                            }
                            type="button"
                            onClick={() =>
                              setAlinhamento(
                                id as any
                              )
                            }
                            className={`rounded-xl border py-2.5 text-xs font-semibold ${
                              alinhamento ===
                              id
                                ? 'border-[#d98fa5] bg-pink-50 text-[#c87891]'
                                : 'border-gray-100 text-gray-500'
                            }`}
                          >
                            {
                              nome
                            }
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </section>

                {/* CORES */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                      <Palette className="w-5 h-5 text-[#d98fa5]" />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-800">
                        Cores
                      </h2>

                      <p className="text-xs text-gray-500">
                        Personalize completamente a identidade da arte.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      [
                        'Fundo',
                        corFundo,
                        setCorFundo,
                      ],
                      [
                        'Texto',
                        corTexto,
                        setCorTexto,
                      ],
                      [
                        'Destaque',
                        corDestaque,
                        setCorDestaque,
                      ],
                    ].map(
                      ([
                        nome,
                        valor,
                        setter,
                      ]) => (
                        <label
                          key={
                            nome as string
                          }
                          className="cursor-pointer"
                        >
                          <span className="text-xs text-gray-500 block mb-2">
                            {
                              nome
                            }
                          </span>

                          <div className="rounded-xl border border-gray-200 p-2">
                            <input
                              type="color"
                              value={
                                valor as string
                              }
                              onChange={(e) =>
                                (
                                  setter as any
                                )(
                                  e.target.value
                                )
                              }
                              className="w-full h-10 rounded-lg cursor-pointer"
                            />
                          </div>
                        </label>
                      )
                    )}
                  </div>
                </section>

                {/* TAMANHOS E POSIÇÃO */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                      <MoveIcon />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-800">
                        Tamanho e posição
                      </h2>

                      <p className="text-xs text-gray-500">
                        Ajuste os elementos da forma que preferir.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <ControleSlider
                      label="Título — tamanho"
                      value={
                        tamanhoTitulo
                      }
                      min={24}
                      max={90}
                      onChange={
                        setTamanhoTitulo
                      }
                    />

                    <ControleSlider
                      label="Título — posição vertical"
                      value={
                        posicaoTituloY
                      }
                      min={15}
                      max={60}
                      onChange={
                        setPosicaoTituloY
                      }
                    />

                    <ControleSlider
                      label="Título — posição horizontal"
                      value={
                        posicaoTituloX
                      }
                      min={15}
                      max={85}
                      onChange={
                        setPosicaoTituloX
                      }
                    />

                    <ControleSlider
                      label="Subtítulo — tamanho"
                      value={
                        tamanhoSubtitulo
                      }
                      min={12}
                      max={35}
                      onChange={
                        setTamanhoSubtitulo
                      }
                    />

                    <ControleSlider
                      label="Subtítulo — posição"
                      value={
                        posicaoSubtituloY
                      }
                      min={30}
                      max={70}
                      onChange={
                        setPosicaoSubtituloY
                      }
                    />

                    <ControleSlider
                      label="CTA — tamanho"
                      value={
                        tamanhoCta
                      }
                      min={10}
                      max={28}
                      onChange={
                        setTamanhoCta
                      }
                    />

                    <ControleSlider
                      label="CTA — posição"
                      value={
                        posicaoCtaY
                      }
                      min={65}
                      max={92}
                      onChange={
                        setPosicaoCtaY
                      }
                    />
                  </div>
                </section>

                {/* EMOJIS */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                        <Smile className="w-5 h-5 text-[#d98fa5]" />
                      </div>

                      <div>
                        <h2 className="font-bold text-gray-800">
                          Emojis
                        </h2>

                        <p className="text-xs text-gray-500">
                          Escolha um ou remova da arte.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setMostrarEmoji(
                          !mostrarEmoji
                        )
                      }
                      className={`w-10 h-6 rounded-full p-0.5 ${
                        mostrarEmoji
                          ? 'bg-[#d98fa5]'
                          : 'bg-gray-200'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition ${
                          mostrarEmoji
                            ? 'translate-x-4'
                            : ''
                        }`}
                      />
                    </button>
                  </div>

                  {mostrarEmoji && (
                    <div className="flex flex-wrap gap-2">
                      {EMOJIS.map(
                        (item) => (
                          <button
                            key={
                              item
                            }
                            type="button"
                            onClick={() =>
                              setEmoji(
                                item
                              )
                            }
                            className={`w-10 h-10 rounded-xl border text-xl ${
                              emoji ===
                              item
                                ? 'border-[#d98fa5] bg-pink-50'
                                : 'border-gray-100'
                            }`}
                          >
                            {
                              item
                            }
                          </button>
                        )
                      )}
                    </div>
                  )}
                </section>

                {/* DECORAÇÃO */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                        <Flower2 className="w-5 h-5 text-[#d98fa5]" />
                      </div>

                      <div>
                        <h2 className="font-bold text-gray-800">
                          Elementos decorativos
                        </h2>

                        <p className="text-xs text-gray-500">
                          Flores, folhas, brilhos e outros detalhes.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setMostrarDecoracao(
                          !mostrarDecoracao
                        )
                      }
                      className={`w-10 h-6 rounded-full p-0.5 ${
                        mostrarDecoracao
                          ? 'bg-[#d98fa5]'
                          : 'bg-gray-200'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition ${
                          mostrarDecoracao
                            ? 'translate-x-4'
                            : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      [
                        'nenhum',
                        'Nenhum',
                      ],
                      [
                        'flores',
                        'Flores',
                      ],
                      [
                        'folhas',
                        'Folhas',
                      ],
                      [
                        'estrelas',
                        'Estrelas',
                      ],
                      [
                        'coracoes',
                        'Corações',
                      ],
                      [
                        'brilhos',
                        'Brilhos',
                      ],
                      [
                        'bolinhas',
                        'Bolinhas',
                      ],
                    ].map(
                      ([
                        id,
                        nome,
                      ]) => (
                        <button
                          key={
                            id
                          }
                          type="button"
                          onClick={() =>
                            setDecoracao(
                              id as ElementoDecorativo
                            )
                          }
                          className={`rounded-xl border p-2.5 text-xs font-medium ${
                            decoracao ===
                            id
                              ? 'border-[#d98fa5] bg-pink-50 text-[#c87891]'
                              : 'border-gray-100 text-gray-500'
                          }`}
                        >
                          {
                            nome
                          }
                        </button>
                      )
                    )}
                  </div>

                  <div className="mt-4">
                    <ControleSlider
                      label="Intensidade dos elementos"
                      value={
                        intensidadeDecoracao
                      }
                      min={0}
                      max={100}
                      onChange={
                        setIntensidadeDecoracao
                      }
                    />
                  </div>
                </section>

                {/* IMAGEM */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-[#d98fa5]" />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-800">
                        Imagens
                      </h2>

                      <p className="text-xs text-gray-500">
                        Use uma foto do serviço ou adicione outra.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      arquivoImagemRef.current?.click()
                    }
                    className="w-full rounded-2xl border-2 border-dashed border-gray-200 py-5 flex flex-col items-center justify-center hover:border-pink-200"
                  >
                    <Plus className="w-6 h-6 text-gray-400 mb-1" />

                    <span className="text-sm font-semibold text-gray-700">
                      Adicionar imagem
                    </span>

                    <span className="text-xs text-gray-400 mt-1">
                      JPG ou PNG
                    </span>
                  </button>

                  <div className="mt-4">
                    <label className="text-xs text-gray-500 block mb-2">
                      URL da imagem
                    </label>

                    <input
                      type="url"
                      value={
                        imagemExtra.startsWith(
                          'data:'
                        )
                          ? ''
                          : imagemExtra
                      }
                      onChange={(e) =>
                        setImagemExtra(
                          e.target.value
                        )
                      }
                      placeholder="https://..."
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>

                  {imagemPreview && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl overflow-hidden bg-gray-100 h-36">
                        <img
                          src={
                            imagemPreview
                          }
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <ControleSlider
                        label="Opacidade da imagem"
                        value={
                          imagemOpacidade
                        }
                        min={20}
                        max={100}
                        onChange={
                          setImagemOpacidade
                        }
                      />

                      <ControleSlider
                        label="Tamanho da imagem"
                        value={
                          imagemEscala
                        }
                        min={60}
                        max={150}
                        onChange={
                          setImagemEscala
                        }
                      />
                    </div>
                  )}
                </section>

                {/* ACABAMENTO */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-[#d98fa5]" />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-800">
                        Acabamento
                      </h2>

                      <p className="text-xs text-gray-500">
                        Ajuste os últimos detalhes.
                      </p>
                    </div>
                  </div>

                  <ControleSlider
                    label="Arredondamento"
                    value={
                      arredondamento
                    }
                    min={0}
                    max={60}
                    onChange={
                      setArredondamento
                    }
                  />

                  <button
                    type="button"
                    onClick={
                      restaurarModelo
                    }
                    className="w-full mt-5 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restaurar modelo
                  </button>
                </section>

                {/* AÇÕES */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setEtapa(3)
                    }
                    className="flex-1 rounded-2xl border border-gray-200 bg-white py-3.5 font-semibold text-gray-700"
                  >
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={
                      baixarImagem
                    }
                    disabled={
                      baixando
                    }
                    className="flex-[2] rounded-2xl bg-[#d98fa5] text-white py-3.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Download className="w-5 h-5" />

                    {baixando
                      ? 'Gerando imagem...'
                      : 'Baixar postagem'}
                  </button>
                </div>
              </>
            )}
          </section>

          {/* =================================================
              PREVIEW
          ================================================= */}

          <aside className="lg:sticky lg:top-24">
            <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-pink-500">
                    Pré-visualização
                  </p>

                  <h2 className="font-bold text-gray-800 mt-1">
                    {
                      formatoAtual.nome
                    }
                  </h2>
                </div>

                <span className="text-xs text-gray-400">
                  {
                    formatoAtual.proporcao
                  }
                </span>
              </div>

              <div className="flex justify-center bg-[#f4f1f2] rounded-2xl p-4 overflow-hidden">
                <div
                  style={{
                    width:
                      previewLargura,
                    height:
                      previewAltura,
                  }}
                >
                  <div
                    ref={
                      previewRef
                    }
                    className="relative overflow-hidden w-full h-full"
                    style={{
                      background:
                        corFundo,
                      color:
                        corTexto,
                      borderRadius:
                        `${arredondamento}px`,
                    }}
                  >
                    {/* FUNDO */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          `radial-gradient(circle at 50% 0%, ${corDestaque}18 0%, transparent 40%)`,
                      }}
                    />

                    {renderizarDecoracao()}

                    {/* IMAGEM */}
                    {imagemPreview && (
                      <div
                        className="absolute left-1/2 top-[8%] -translate-x-1/2 overflow-hidden rounded-[28px]"
                        style={{
                          width:
                            `${imagemEscala}%`,
                          maxWidth:
                            '86%',
                          height:
                            '30%',
                          opacity:
                            imagemOpacidade /
                            100,
                        }}
                      >
                        <img
                          src={
                            imagemPreview
                          }
                          alt=""
                          className="w-full h-full object-cover"
                          crossOrigin="anonymous"
                        />
                      </div>
                    )}

                    {/* LOGO */}
                    {mostrarLogo && (
                      <div className="absolute top-[5%] left-1/2 -translate-x-1/2 flex flex-col items-center">
                        <img
                          src={
                            logoSalao
                          }
                          alt=""
                          crossOrigin="anonymous"
                          className="w-16 h-16 object-contain rounded-full bg-white/80 p-2"
                        />

                        <span
                          className="text-[9px] uppercase tracking-[0.22em] mt-2 font-semibold"
                          style={{
                            color:
                              corTexto,
                            fontFamily:
                              fonteAtual.css,
                          }}
                        >
                          {
                            nomeSalao
                          }
                        </span>
                      </div>
                    )}

                    {/* CONTEÚDO PRINCIPAL */}
                    <div
                      className="absolute left-0 right-0"
                      style={{
                        top:
                          `${posicaoTituloY}%`,
                      }}
                    >
                      <div
                        style={{
                          marginLeft:
                            `${posicaoTituloX}%`,
                          transform:
                            'translateX(-50%)',
                          width:
                            '82%',
                          textAlign:
                            alinhamento,
                        }}
                      >
                        {mostrarEmoji && (
                          <div
                            className="text-2xl mb-3"
                            style={{
                              fontFamily:
                                fonteAtual.css,
                            }}
                          >
                            {
                              emoji
                            }
                          </div>
                        )}

                        <div
                          style={{
                            fontFamily:
                              fonteAtual.css,
                            fontSize:
                              `${tamanhoTitulo}px`,
                            lineHeight:
                              1.05,
                            fontWeight:
                              700,
                            color:
                              corTexto,
                            wordBreak:
                              'break-word',
                          }}
                        >
                          {
                            titulo
                          }
                        </div>
                      </div>
                    </div>

                    {/* SUBTÍTULO */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-[78%]"
                      style={{
                        top:
                          `${posicaoSubtituloY}%`,
                        textAlign:
                          alinhamento,
                      }}
                    >
                      <p
                        style={{
                          fontFamily:
                            fonteAtual.css,
                          fontSize:
                            `${tamanhoSubtitulo}px`,
                          lineHeight:
                            1.35,
                          color:
                            corTexto,
                          opacity:
                            0.78,
                        }}
                      >
                        {
                          subtitulo
                        }
                      </p>

                      {textoExtra && (
                        <p
                          className="mt-3 font-semibold"
                          style={{
                            fontFamily:
                              fonteAtual.css,
                            fontSize:
                              `${Math.max(
                                12,
                                tamanhoSubtitulo -
                                  2
                              )}px`,
                            color:
                              corDestaque,
                          }}
                        >
                          {
                            textoExtra
                          }
                        </p>
                      )}

                      {/* DADOS DO ORGANIZA */}
                      {(mostrarData ||
                        mostrarHorario ||
                        mostrarServico ||
                        mostrarProfissional ||
                        mostrarPreco) &&
                        horarioAtual && (
                          <div
                            className="mt-5 rounded-2xl px-4 py-3"
                            style={{
                              background:
                                `${corDestaque}18`,
                              border:
                                `1px solid ${corDestaque}35`,
                            }}
                          >
                            {mostrarServico && (
                              <p
                                className="font-bold"
                                style={{
                                  color:
                                    corTexto,
                                  fontFamily:
                                    fonteAtual.css,
                                }}
                              >
                                {
                                  servicoDoHorario?.nome
                                }
                              </p>
                            )}

                            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                              {mostrarData && (
                                <span
                                  className="text-[11px]"
                                  style={{
                                    color:
                                      corTexto,
                                  }}
                                >
                                  {dataLocalBonita(
                                    dataParaInput(
                                      horarioAtual.data_hora
                                    )
                                  )}
                                </span>
                              )}

                              {mostrarHorario && (
                                <span
                                  className="text-[11px] font-bold"
                                  style={{
                                    color:
                                      corDestaque,
                                  }}
                                >
                                  {horaLocal(
                                    horarioAtual.data_hora
                                  )}
                                </span>
                              )}
                            </div>

                            {mostrarProfissional &&
                              profissionalAtual?.nome && (
                                <p
                                  className="text-[10px] mt-2"
                                  style={{
                                    color:
                                      corTexto,
                                    opacity:
                                      0.7,
                                  }}
                                >
                                  com{' '}
                                  {
                                    profissionalAtual.nome
                                  }
                                </p>
                              )}

                            {mostrarPreco &&
                              valorServico && (
                                <p
                                  className="font-bold text-sm mt-2"
                                  style={{
                                    color:
                                      corDestaque,
                                  }}
                                >
                                  {formatarMoeda(
                                    valorServico
                                  )}
                                </p>
                              )}
                          </div>
                        )}

                      {/* SERVIÇO SEM HORÁRIO */}
                      {mostrarServico &&
                        !horarioAtual &&
                        servicoAtual && (
                          <div
                            className="mt-5 rounded-2xl px-4 py-3"
                            style={{
                              background:
                                `${corDestaque}18`,
                            }}
                          >
                            <p
                              className="font-bold"
                              style={{
                                color:
                                  corTexto,
                                fontFamily:
                                  fonteAtual.css,
                              }}
                            >
                              {
                                servicoAtual.nome
                              }
                            </p>

                            {mostrarPreco &&
                              valorServico && (
                                <p
                                  className="font-bold text-sm mt-2"
                                  style={{
                                    color:
                                      corDestaque,
                                  }}
                                >
                                  {formatarMoeda(
                                    valorServico
                                  )}
                                </p>
                              )}
                          </div>
                        )}
                    </div>

                    {/* CTA */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2"
                      style={{
                        top:
                          `${posicaoCtaY}%`,
                        width:
                          '76%',
                      }}
                    >
                      <div
                        className="mx-auto px-5 py-3 rounded-full text-center font-semibold"
                        style={{
                          background:
                            corDestaque,
                          color:
                            luminancia(
                              corDestaque
                            ) >
                            0.65
                              ? '#3A3033'
                              : '#FFFFFF',
                          fontFamily:
                            fonteAtual.css,
                          fontSize:
                            `${tamanhoCta}px`,
                        }}
                      >
                        {
                          cta
                        }
                      </div>
                    </div>

                    {/* RODAPÉ */}
                    <div className="absolute bottom-[3%] left-0 right-0 text-center">
                      <span
                        className="text-[8px] uppercase tracking-[0.2em]"
                        style={{
                          color:
                            corTexto,
                          opacity:
                            0.55,
                          fontFamily:
                            fonteAtual.css,
                        }}
                      >
                        {
                          nomeSalao
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RESUMO */}
              <div className="mt-4 rounded-2xl bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Modelo
                  </span>

                  <span className="text-xs font-semibold text-gray-700">
                    {
                      modeloAtual.nome
                    }
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">
                    Formato
                  </span>

                  <span className="text-xs font-semibold text-gray-700">
                    {
                      formatoAtual.proporcao
                    }
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  baixarImagem
                }
                disabled={
                  baixando
                }
                className="w-full mt-3 rounded-2xl bg-[#d98fa5] text-white py-3.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Download className="w-5 h-5" />

                {baixando
                  ? 'Gerando imagem em alta...'
                  : 'Baixar imagem em alta qualidade'}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

/* =========================================================
   CONTROLE SLIDER
========================================================= */

function ControleSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (
    value: number
  ) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-600">
          {label}
        </label>

        <span className="text-[11px] font-semibold text-[#c87891]">
          {Math.round(value)}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) =>
          onChange(
            Number(
              e.target.value
            )
          )
        }
        className="w-full accent-[#d98fa5]"
      />
    </div>
  )
}

/* =========================================================
   ÍCONE SIMPLES PARA MOVIMENTO
========================================================= */

function MoveIcon() {
  return (
    <div className="relative w-5 h-5 text-[#d98fa5]">
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold">
        ↔
      </span>
    </div>
  )
}