// @ts-nocheck
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Clock,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Download,
  Sparkles,
  Calendar,
  CheckCircle2,
  Circle,
  X,
  Eye,
  EyeOff,
  RotateCcw
} from 'lucide-react'
import { toPng } from 'html-to-image'

const DIAS = [
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

type HorarioDia = {
  ativo: boolean
  manha_inicio: string | null
  manha_fim: string | null
  tarde_inicio: string | null
  tarde_fim: string | null
  tem_tarde: boolean
}

type LayoutStory =
  | 'elegante'
  | 'clean'
  | 'destaque'
  | 'romantico'
  | 'moderno'
  | 'minimal'

const PADRAO: HorarioDia = {
  ativo: false,
  manha_inicio: '08:00',
  manha_fim: '12:00',
  tarde_inicio: '13:00',
  tarde_fim: '18:00',
  tem_tarde: true,
}

export default function SalaoHorariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)

  // ============================================================
  // HORÁRIOS VAGOS
  // ============================================================

  const [vagos, setVagos] = useState<any[]>([])
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])

  const [modalVago, setModalVago] = useState(false)
  const [salvandoVago, setSalvandoVago] = useState(false)

  const [formVago, setFormVago] = useState({
    data: '',
    hora: '',
    servico_id: '',
    duracao_minutos: 60,
    profissional_id: '',
    observacao: ''
  })

  // ============================================================
  // MODAL PEDIDO DE ENCAIXE
  // ============================================================

  const [modalPedido, setModalPedido] = useState(false)
  const [enviandoPedido, setEnviandoPedido] = useState(false)

  const [formPedido, setFormPedido] = useState({
    data: '',
    periodo: 'manha',
    observacao: ''
  })

  // ============================================================
  // GERADOR DE STORY
  // ============================================================

  const [modalStory, setModalStory] = useState(false)

  const [layoutStory, setLayoutStory] =
    useState<LayoutStory>('elegante')

  const [dataSelecionadaStory, setDataSelecionadaStory] =
    useState(new Date().toISOString().slice(0, 10))

  const [horariosSelecionadosStory, setHorariosSelecionadosStory] =
    useState<string[]>([])

  const [tituloStory, setTituloStory] =
    useState('Horários Vagos')

  const [subtituloStory, setSubtituloStory] =
    useState('Ainda temos alguns horários disponíveis')

  const [ctaStory, setCtaStory] =
    useState('Garanta o seu horário!')

  const [mostrarDataStory, setMostrarDataStory] =
    useState(true)

  const [mostrarProfissionalStory, setMostrarProfissionalStory] =
    useState(true)

  const [mostrarLogoStory, setMostrarLogoStory] =
    useState(true)

  const [gerandoImagem, setGerandoImagem] =
    useState(false)

  const cardRef = useRef<HTMLDivElement>(null)

  // ============================================================
  // FUNCIONAMENTO
  // ============================================================

  const [horarios, setHorarios] =
    useState<Record<string, HorarioDia>>({})

  const [salvandoFunc, setSalvandoFunc] =
    useState(false)

  const [salvouFunc, setSalvouFunc] =
    useState(false)

  const [secaoAberta, setSecaoAberta] =
    useState<'vagos' | 'funcionamento'>('vagos')

  // ============================================================
  // CARREGAMENTO
  // ============================================================

  useEffect(() => {
    if (!loading && profile?.salao_id) {
      carregarDados()
    }
  }, [loading, profile])

  async function carregarDados() {
    if (!profile?.salao_id) return

    try {
      const salaoId = profile.salao_id

      // --------------------------------------------------------
      // SALÃO
      // --------------------------------------------------------

      const { data: sal } = await supabase
        .from('saloes')
        .select('*')
        .eq('id', salaoId)
        .single()

      setSalao(sal)

      // --------------------------------------------------------
      // FUNCIONAMENTO
      // --------------------------------------------------------

      const base: Record<string, HorarioDia> = {}

      DIAS.forEach(d => {
        const s = sal?.horarios_funcionamento?.[d.key]

        base[d.key] = s
          ? {
              ...PADRAO,
              ...s,
              tem_tarde: !!s.tarde_inicio
            }
          : {
              ...PADRAO
            }
      })

      setHorarios(base)

      // --------------------------------------------------------
      // HORÁRIOS VAGOS
      // --------------------------------------------------------

      const agora = new Date().toISOString()

      const { data: hrs, error: erroHorarios } =
        await supabase
          .from('horarios_vagos')
          .select('*, profiles(nome), clientes(nome)')
          .eq('salao_id', salaoId)
          .gte('data_hora', agora)
          .order('data_hora')

      if (erroHorarios) {
        console.error(
          'Erro ao carregar horários vagos:',
          erroHorarios.message
        )
      }

      setVagos(hrs || [])

      // --------------------------------------------------------
      // PROFISSIONAIS
      // --------------------------------------------------------

      const { data: funcs, error: erroFuncs } =
        await supabase
          .from('profiles')
          .select('id, nome')
          .eq('salao_id', salaoId)
          .in('role', ['funcionario', 'dono_salao'])

      if (erroFuncs) {
        console.error(
          'Erro ao carregar profissionais:',
          erroFuncs.message
        )
      }

      setFuncionarios(funcs || [])

      // --------------------------------------------------------
      // SERVIÇOS
      // --------------------------------------------------------

      const { data: listaServicos, error: erroServicos } =
        await supabase
          .from('servicos')
          .select('*')
          .eq('salao_id', salaoId)
          .order('nome', { ascending: true })

      if (erroServicos) {
        console.error(
          'Erro ao carregar serviços:',
          erroServicos.message
        )
      }

      setServicos(listaServicos || [])

    } catch (error) {
      console.error(
        'Erro ao carregar dados da página:',
        error
      )
    }
  }

  // ============================================================
  // DURAÇÃO DO SERVIÇO
  // ============================================================

  function obterDuracaoServico(servico: any) {
    if (!servico) return 60

    const valor =
      servico.duracao_minutos ??
      servico.duracao ??
      servico.tempo_minutos ??
      servico.tempo ??
      servico.duracao_estimada ??
      servico.tempo_estimado

    const numero = Number(valor)

    if (Number.isFinite(numero) && numero > 0) {
      return numero
    }

    return 60
  }

  function obterNomeServico(servico: any) {
    return servico?.nome || 'Serviço'
  }

  function selecionarServico(servicoId: string) {
    const servico = servicos.find(
      s => s.id === servicoId
    )

    const duracao = obterDuracaoServico(servico)

    setFormVago(prev => ({
      ...prev,
      servico_id: servicoId,
      duracao_minutos: duracao
    }))
  }

  // ============================================================
  // ABRIR MODAL HORÁRIO
  // ============================================================

  function abrirModalVago() {
    setFormVago({
      data: '',
      hora: '',
      servico_id: '',
      duracao_minutos: 60,
      profissional_id: '',
      observacao: ''
    })

    setModalVago(true)
  }

  // ============================================================
  // LIBERAR HORÁRIO
  // ============================================================

  async function liberarHorario() {
    if (!formVago.data || !formVago.hora) {
      alert('Selecione a data e o horário.')
      return
    }

    if (!formVago.servico_id) {
      alert('Selecione o serviço disponível neste horário.')
      return
    }

    const servicoSelecionado = servicos.find(
      s => s.id === formVago.servico_id
    )

    if (!servicoSelecionado) {
      alert('O serviço selecionado não foi encontrado.')
      return
    }

    const duracao =
      obterDuracaoServico(servicoSelecionado)

    setSalvandoVago(true)

    try {
      const dataHora = new Date(
        `${formVago.data}T${formVago.hora}:00`
      ).toISOString()

      const { error } = await supabase
        .from('horarios_vagos')
        .insert({
          salao_id: profile!.salao_id,
          data_hora: dataHora,
          duracao_minutos: duracao,
          profissional_id:
            formVago.profissional_id || null,
          observacao:
            formVago.observacao || null,
        })

      if (error) {
        throw error
      }

      setModalVago(false)

      setFormVago({
        data: '',
        hora: '',
        servico_id: '',
        duracao_minutos: 60,
        profissional_id: '',
        observacao: ''
      })

      await carregarDados()

    } catch (error: any) {
      console.error(
        'Erro ao liberar horário:',
        error
      )

      alert(
        'Erro ao liberar horário: ' +
        (error?.message || 'Tente novamente.')
      )
    } finally {
      setSalvandoVago(false)
    }
  }

  // ============================================================
  // PEDIDO DE HORÁRIO
  // ============================================================

  async function enviarPedidoHorario() {
    if (!formPedido.data) {
      alert('Selecione uma data preferida.')
      return
    }

    setEnviandoPedido(true)

    const periodoLabels: Record<string, string> = {
      manha: 'Manhã',
      tarde: 'Tarde',
      noite: 'Noite'
    }

    const mensagemNotif =
      `📅 Pedido de Horário: Cliente deseja agendar para o dia ` +
      `${new Date(
        formPedido.data + 'T00:00:00'
      ).toLocaleDateString('pt-BR')} ` +
      `no período da *${periodoLabels[formPedido.periodo]}*. ` +
      `${
        formPedido.observacao
          ? `Obs: ${formPedido.observacao}`
          : ''
      }`

    const { error } = await supabase
      .from('notificacoes')
      .insert({
        salao_id: profile!.salao_id,
        titulo: 'Novo Pedido de Agendamento',
        mensagem: mensagemNotif,
        lida: false
      })

    if (error) {
      console.warn(
        'Erro ao inserir notificação:',
        error.message
      )
    }

    setEnviandoPedido(false)
    setModalPedido(false)

    setFormPedido({
      data: '',
      periodo: 'manha',
      observacao: ''
    })

    alert(
      'Pedido enviado com sucesso para o salão! Entraremos em contato em breve.'
    )
  }

  // ============================================================
  // EXCLUIR HORÁRIO
  // ============================================================

  async function excluirVago(id: string) {
    if (
      !confirm(
        'Deseja realmente excluir este horário?'
      )
    ) {
      return
    }

    const { error } = await supabase
      .from('horarios_vagos')
      .delete()
      .eq('id', id)

    if (error) {
      alert(
        'Erro ao excluir horário: ' +
        error.message
      )
      return
    }

    await carregarDados()
  }

  // ============================================================
  // FUNCIONAMENTO
  // ============================================================

  function atualizarDia(
    dia: string,
    campo: keyof HorarioDia,
    valor: any
  ) {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [campo]: valor
      }
    }))
  }

  async function salvarFuncionamento() {
    setSalvandoFunc(true)

    try {
      const payload: Record<string, any> = {}

      DIAS.forEach(d => {
        const h = horarios[d.key]

        payload[d.key] = {
          ativo: h.ativo,
          manha_inicio:
            h.ativo ? h.manha_inicio : null,
          manha_fim:
            h.ativo ? h.manha_fim : null,
          tarde_inicio:
            h.ativo && h.tem_tarde
              ? h.tarde_inicio
              : null,
          tarde_fim:
            h.ativo && h.tem_tarde
              ? h.tarde_fim
              : null,
        }
      })

      const { error } = await supabase
        .from('saloes')
        .update({
          horarios_funcionamento: payload
        })
        .eq('id', profile!.salao_id!)

      if (error) {
        throw error
      }

      setSalvouFunc(true)

      setTimeout(() => {
        setSalvouFunc(false)
      }, 2500)

    } catch (error: any) {
      console.error(
        'Erro ao salvar funcionamento:',
        error
      )

      alert(
        'Erro ao salvar horários: ' +
        (error?.message || 'Tente novamente.')
      )
    } finally {
      setSalvandoFunc(false)
    }
  }

  // ============================================================
  // STORY — ABRIR
  // ============================================================

  function abrirModalStory() {
    const dataHoje = new Date()
      .toISOString()
      .slice(0, 10)

    setDataSelecionadaStory(dataHoje)

    setTituloStory('Horários Vagos')

    setSubtituloStory(
      'Ainda temos alguns horários disponíveis'
    )

    setCtaStory(
      'Garanta o seu horário!'
    )

    setLayoutStory('elegante')

    setMostrarDataStory(true)

    setMostrarProfissionalStory(true)

    setMostrarLogoStory(true)

    setHorariosSelecionadosStory([])

    setModalStory(true)
  }

  // ============================================================
  // HORÁRIOS DO STORY
  // ============================================================

  const vagosLivres =
    vagos.filter(h => !h.reservado)

  const vagosReservados =
    vagos.filter(h => h.reservado)

  const vagosDoDiaStory =
    vagosLivres
      .filter(h =>
        h.data_hora.slice(0, 10) ===
        dataSelecionadaStory
      )
      .sort(
        (a, b) =>
          new Date(a.data_hora).getTime() -
          new Date(b.data_hora).getTime()
      )

  function alternarHorarioStory(id: string) {
    setHorariosSelecionadosStory(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id)
      }

      return [...prev, id]
    })
  }

  function selecionarTodosStory() {
    if (
      horariosSelecionadosStory.length ===
      vagosDoDiaStory.length
    ) {
      setHorariosSelecionadosStory([])
      return
    }

    setHorariosSelecionadosStory(
      vagosDoDiaStory.map(h => h.id)
    )
  }

  function obterHorariosParaArte() {
    if (horariosSelecionadosStory.length === 0) {
      return vagosDoDiaStory
    }

    return vagosDoDiaStory.filter(h =>
      horariosSelecionadosStory.includes(h.id)
    )
  }

  // ============================================================
  // STORY — FORMATAÇÕES
  // ============================================================

  function formatarDuracao(min: number) {
    if (min < 60) {
      return `${min} min`
    }

    const horas = Math.floor(min / 60)
    const minutos = min % 60

    return minutos === 0
      ? `${horas}h`
      : `${horas}h${minutos}min`
  }

  function formatarDataHora(iso: string) {
    return (
      new Date(iso).toLocaleDateString(
        'pt-BR',
        {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        }
      ) +
      ' · ' +
      new Date(iso).toLocaleTimeString(
        'pt-BR',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      )
    )
  }

  function formatarDataStory(data: string) {
    return new Date(
      data + 'T00:00:00'
    ).toLocaleDateString(
      'pt-BR',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }
    )
  }

  // ============================================================
  // STORY — ESTILO
  // ============================================================

  function obterConfigLayout() {
    switch (layoutStory) {
      case 'clean':
        return {
          fundo: '#ffffff',
          texto: '#111827',
          textoSecundario: '#6b7280',
          card: '#f8fafc',
          borda: '#e5e7eb',
          destaque: cor,
          sombra: '0 15px 40px rgba(0,0,0,0.08)',
        }

      case 'destaque':
        return {
          fundo: '#111111',
          texto: '#ffffff',
          textoSecundario: 'rgba(255,255,255,0.65)',
          card: 'rgba(255,255,255,0.09)',
          borda: `${cor}80`,
          destaque: cor,
          sombra: `0 15px 50px ${cor}40`,
        }

      case 'romantico':
        return {
          fundo: `linear-gradient(145deg, ${cor}18, #fff7fb, #ffffff)`,
          texto: '#3f2937',
          textoSecundario: '#8b6575',
          card: 'rgba(255,255,255,0.82)',
          borda: `${cor}25`,
          destaque: cor,
          sombra: '0 15px 40px rgba(120,50,90,0.10)',
        }

      case 'moderno':
        return {
          fundo: '#f4f4f5',
          texto: '#18181b',
          textoSecundario: '#71717a',
          card: '#ffffff',
          borda: '#d4d4d8',
          destaque: '#18181b',
          sombra: '0 15px 40px rgba(0,0,0,0.12)',
        }

      case 'minimal':
        return {
          fundo: '#fafafa',
          texto: '#171717',
          textoSecundario: '#737373',
          card: '#ffffff',
          borda: '#e5e5e5',
          destaque: cor,
          sombra: '0 12px 30px rgba(0,0,0,0.06)',
        }

      case 'elegante':
      default:
        return {
          fundo:
            'linear-gradient(145deg, #18181b 0%, #09090b 55%, #000000 100%)',
          texto: '#ffffff',
          textoSecundario: 'rgba(255,255,255,0.68)',
          card: 'rgba(255,255,255,0.08)',
          borda: 'rgba(255,255,255,0.12)',
          destaque: cor,
          sombra: `0 20px 60px ${cor}25`,
        }
    }
  }

  // ============================================================
  // STORY — DOWNLOAD
  // ============================================================

  async function baixarImagemStory() {
    if (!cardRef.current) return

    try {
      setGerandoImagem(true)

      const dataUrl = await toPng(
        cardRef.current,
        {
          cacheBust: true,
          pixelRatio: 3,
          backgroundColor:
            layoutStory === 'clean'
              ? '#ffffff'
              : layoutStory === 'minimal'
                ? '#fafafa'
                : undefined
        }
      )

      const link =
        document.createElement('a')

      link.download =
        `story-horarios-${dataSelecionadaStory}.png`

      link.href = dataUrl

      link.click()

    } catch (error) {
      console.error(
        'Erro ao gerar imagem:',
        error
      )

      alert(
        'Não foi possível gerar a imagem.'
      )
    } finally {
      setGerandoImagem(false)
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{
            borderColor: cor
          }}
        />
      </div>
    )
  }

  // ============================================================
  // DADOS ATUAIS
  // ============================================================

  const servicoAtual =
    servicos.find(
      s => s.id === formVago.servico_id
    )

  const duracaoAtual =
    servicoAtual
      ? obterDuracaoServico(servicoAtual)
      : formVago.duracao_minutos

  const cor =
    salao?.cor_primaria || '#E91E8C'

  const configLayout =
    obterConfigLayout()

  const horariosParaArte =
    obterHorariosParaArte()

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-10">

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">

        <button
          onClick={() => router.back()}
        >
          <ArrowLeft
            size={22}
            className="text-gray-700"
          />
        </button>

        <h1 className="font-bold text-gray-900 text-lg flex-1">
          Horários
        </h1>

      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {/* ====================================================== */}
        {/* HORÁRIOS VAGOS */}
        {/* ====================================================== */}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

          <button
            onClick={() =>
              setSecaoAberta(
                secaoAberta === 'vagos'
                  ? 'funcionamento'
                  : 'vagos'
              )
            }
            className="w-full flex items-center justify-between px-4 py-4"
          >

            <div className="flex items-center gap-3">

              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: `${cor}15`
                }}
              >
                <Clock
                  size={18}
                  style={{ color: cor }}
                />
              </div>

              <div className="text-left">

                <p className="font-bold text-gray-900 text-sm">
                  Horários Vagos
                </p>

                <p className="text-xs text-gray-400">
                  {vagosLivres.length} disponível(is)
                  {' · '}
                  {vagosReservados.length} reservado(s)
                </p>

              </div>

            </div>

            {secaoAberta === 'vagos'
              ? (
                <ChevronUp
                  size={18}
                  className="text-gray-400"
                />
              )
              : (
                <ChevronDown
                  size={18}
                  className="text-gray-400"
                />
              )}

          </button>

          {secaoAberta === 'vagos' && (

            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-50 pt-3">

              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 leading-relaxed">
                Libere horários disponíveis ou solicite um horário de preferência caso não encontre vaga.
              </div>

              <div className="grid grid-cols-1 gap-2">

                <button
                  onClick={() =>
                    setModalPedido(true)
                  }
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-white text-xs font-semibold shadow-sm"
                  style={{
                    backgroundColor: cor
                  }}
                >
                  <Calendar size={14} />
                  Quero agendar um horário
                </button>

                <div className="grid grid-cols-2 gap-2">

                  <button
                    onClick={abrirModalVago}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold border-2"
                    style={{
                      borderColor: cor,
                      color: cor
                    }}
                  >
                    <Plus size={14} />
                    Liberar horário
                  </button>

                  <button
                    onClick={abrirModalStory}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 bg-gray-50"
                  >
                    <ImageIcon
                      size={14}
                      className="text-gray-500"
                    />
                    Criar Arte Story
                  </button>

                </div>

              </div>

              {/* DISPONÍVEIS */}

              {vagosLivres.length > 0 && (

                <div>

                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Disponíveis ({vagosLivres.length})
                  </p>

                  <div className="flex flex-col gap-2">

                    {vagosLivres.map(h => (

                      <div
                        key={h.id}
                        className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-3"
                      >

                        <div className="flex-1 min-w-0">

                          <p className="text-sm font-semibold text-gray-900">
                            {formatarDataHora(
                              h.data_hora
                            )}
                          </p>

                          <p className="text-xs text-gray-400">

                            {formatarDuracao(
                              Number(
                                h.duracao_minutos || 60
                              )
                            )}

                            {h.profiles?.nome
                              ? ` · ${h.profiles.nome}`
                              : ''}

                            {h.observacao
                              ? ` · ${h.observacao}`
                              : ''}

                          </p>

                        </div>

                        <button
                          onClick={() =>
                            excluirVago(h.id)
                          }
                          className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0"
                        >
                          <Trash2
                            size={13}
                            className="text-red-400"
                          />
                        </button>

                      </div>

                    ))}

                  </div>

                </div>

              )}

              {/* RESERVADOS */}

              {vagosReservados.length > 0 && (

                <div>

                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Reservados ({vagosReservados.length})
                  </p>

                  <div className="flex flex-col gap-2">

                    {vagosReservados.map(h => (

                      <div
                        key={h.id}
                        className="flex items-center gap-3 bg-green-50 rounded-xl px-3 py-3"
                      >

                        <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">

                          <Check
                            size={14}
                            className="text-green-600"
                          />

                        </div>

                        <div className="flex-1 min-w-0">

                          <p className="text-sm font-semibold text-gray-900">
                            {formatarDataHora(
                              h.data_hora
                            )}
                          </p>

                          <p className="text-xs text-green-600 font-medium">
                            Reservado por{' '}
                            {h.clientes?.nome ||
                              'cliente'}
                          </p>

                        </div>

                        <button
                          onClick={() =>
                            excluirVago(h.id)
                          }
                          className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0"
                        >
                          <Trash2
                            size={13}
                            className="text-red-400"
                          />
                        </button>

                      </div>

                    ))}

                  </div>

                </div>

              )}

              {vagos.length === 0 && (

                <div className="text-center py-6">

                  <p className="text-gray-400 text-sm">
                    Nenhum horário liberado ainda
                  </p>

                </div>

              )}

            </div>

          )}

        </div>

        {/* ====================================================== */}
        {/* FUNCIONAMENTO */}
        {/* ====================================================== */}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

          <button
            onClick={() =>
              setSecaoAberta(
                secaoAberta === 'funcionamento'
                  ? 'vagos'
                  : 'funcionamento'
              )
            }
            className="w-full flex items-center justify-between px-4 py-4"
          >

            <div className="flex items-center gap-3">

              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: `${cor}15`
                }}
              >
                <Clock
                  size={18}
                  style={{ color: cor }}
                />
              </div>

              <div className="text-left">

                <p className="font-bold text-gray-900 text-sm">
                  Horários de Funcionamento
                </p>

                <p className="text-xs text-gray-400">
                  Dias e horários que o salão atende
                </p>

              </div>

            </div>

            {secaoAberta === 'funcionamento'
              ? (
                <ChevronUp
                  size={18}
                  className="text-gray-400"
                />
              )
              : (
                <ChevronDown
                  size={18}
                  className="text-gray-400"
                />
              )}

          </button>

          {secaoAberta === 'funcionamento' && (

            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-50 pt-3">

              <p className="text-xs text-gray-400">
                Ative os dias e defina os períodos. Ative "Intervalo de almoço" para separar manhã e tarde.
              </p>

              {DIAS.map(({ key, label }) => {

                const h = horarios[key]

                if (!h) return null

                return (

                  <div
                    key={key}
                    className="bg-gray-50 rounded-xl overflow-hidden"
                  >

                    <div className="flex items-center justify-between px-4 py-3">

                      <div className="flex items-center gap-3">

                        <Clock
                          size={15}
                          style={{
                            color: h.ativo
                              ? cor
                              : '#d1d5db'
                          }}
                        />

                        <span
                          className={
                            'text-sm font-semibold ' +
                            (h.ativo
                              ? 'text-gray-900'
                              : 'text-gray-400')
                          }
                        >
                          {label}
                        </span>

                      </div>

                      <button
                        onClick={() =>
                          atualizarDia(
                            key,
                            'ativo',
                            !h.ativo
                          )
                        }
                        className={
                          'relative w-11 h-6 rounded-full transition-colors ' +
                          (h.ativo
                            ? ''
                            : 'bg-gray-200')
                        }
                        style={
                          h.ativo
                            ? {
                                backgroundColor:
                                  cor
                              }
                            : {}
                        }
                      >

                        <div
                          className={
                            'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' +
                            (h.ativo
                              ? 'left-5'
                              : 'left-0.5')
                          }
                        />

                      </button>

                    </div>

                    {h.ativo && (

                      <div className="px-4 pb-3 flex flex-col gap-3">

                        <div>

                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                            {h.tem_tarde
                              ? 'Período da manhã'
                              : 'Funcionamento'}
                          </p>

                          <div className="flex items-center gap-2">

                            <input
                              type="time"
                              className="input-field flex-1 text-sm py-2"
                              value={
                                h.manha_inicio || ''
                              }
                              onChange={e =>
                                atualizarDia(
                                  key,
                                  'manha_inicio',
                                  e.target.value
                                )
                              }
                            />

                            <span className="text-gray-300 text-xs">
                              até
                            </span>

                            <input
                              type="time"
                              className="input-field flex-1 text-sm py-2"
                              value={
                                h.manha_fim || ''
                              }
                              onChange={e =>
                                atualizarDia(
                                  key,
                                  'manha_fim',
                                  e.target.value
                                )
                              }
                            />

                          </div>

                        </div>

                        <div className="flex items-center justify-between">

                          <div>

                            <p className="text-sm font-medium text-gray-700">
                              Intervalo de almoço
                            </p>

                            <p className="text-xs text-gray-400">
                              Período da tarde separado
                            </p>

                          </div>

                          <button
                            onClick={() =>
                              atualizarDia(
                                key,
                                'tem_tarde',
                                !h.tem_tarde
                              )
                            }
                            className={
                              'relative w-11 h-6 rounded-full transition-colors ' +
                              (h.tem_tarde
                                ? ''
                                : 'bg-gray-200')
                            }
                            style={
                              h.tem_tarde
                                ? {
                                    backgroundColor:
                                      cor
                                  }
                                : {}
                            }
                          >

                            <div
                              className={
                                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' +
                                (h.tem_tarde
                                  ? 'left-5'
                                  : 'left-0.5')
                              }
                            />

                          </button>

                        </div>

                        {h.tem_tarde && (

                          <div>

                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                              Período da tarde
                            </p>

                            <div className="flex items-center gap-2">

                              <input
                                type="time"
                                className="input-field flex-1 text-sm py-2"
                                value={
                                  h.tarde_inicio || ''
                                }
                                onChange={e =>
                                  atualizarDia(
                                    key,
                                    'tarde_inicio',
                                    e.target.value
                                  )
                                }
                              />

                              <span className="text-gray-300 text-xs">
                                até
                              </span>

                              <input
                                type="time"
                                className="input-field flex-1 text-sm py-2"
                                value={
                                  h.tarde_fim || ''
                                }
                                onChange={e =>
                                  atualizarDia(
                                    key,
                                    'tarde_fim',
                                    e.target.value
                                  )
                                }
                              />

                            </div>

                          </div>

                        )}

                      </div>

                    )}

                    {!h.ativo && (

                      <div className="px-4 pb-2">

                        <p className="text-xs text-gray-300">
                          Fechado
                        </p>

                      </div>

                    )}

                  </div>

                )
              })}

              <button
                onClick={salvarFuncionamento}
                disabled={salvandoFunc}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{
                  backgroundColor: cor
                }}
              >
                {salvouFunc
                  ? '✓ Salvo!'
                  : salvandoFunc
                    ? 'Salvando...'
                    : 'Salvar horários'}
              </button>

            </div>

          )}

        </div>

      </div>

      {/* ======================================================== */}
      {/* MODAL PEDIDO DE HORÁRIO */}
      {/* ======================================================== */}

      {modalPedido && (

        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">

          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b pb-3">

              <h3 className="font-bold text-gray-900 text-lg">
                Quero agendar um horário
              </h3>

              <button
                onClick={() =>
                  setModalPedido(false)
                }
                className="text-gray-400 font-bold"
              >
                ✕
              </button>

            </div>

            <p className="text-xs text-gray-500">
              Não encontrou um horário vago? Escolha a data e o período de sua preferência para enviar o pedido de encaixe diretamente ao salão.
            </p>

            <div>

              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Data Desejada *
              </label>

              <input
                className="input-field"
                type="date"
                value={formPedido.data}
                onChange={e =>
                  setFormPedido(p => ({
                    ...p,
                    data: e.target.value
                  }))
                }
              />

            </div>

            <div>

              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Período preferido *
              </label>

              <div className="grid grid-cols-3 gap-2">

                {[
                  {
                    key: 'manha',
                    label: '☀️ Manhã'
                  },
                  {
                    key: 'tarde',
                    label: '🌤️ Tarde'
                  },
                  {
                    key: 'noite',
                    label: '🌙 Noite'
                  },
                ].map(p => (

                  <button
                    key={p.key}
                    type="button"
                    onClick={() =>
                      setFormPedido(prev => ({
                        ...prev,
                        periodo: p.key
                      }))
                    }
                    className={
                      'py-2.5 text-xs font-semibold rounded-xl border transition-all ' +
                      (formPedido.periodo === p.key
                        ? 'border-2 shadow-sm'
                        : 'border-gray-200 text-gray-500 bg-white')
                    }
                    style={
                      formPedido.periodo === p.key
                        ? {
                            borderColor: cor,
                            color: cor,
                            backgroundColor: `${cor}10`
                          }
                        : {}
                    }
                  >
                    {p.label}
                  </button>

                ))}

              </div>

            </div>

            <div>

              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Observação ou Serviço desejado (opcional)
              </label>

              <textarea
                className="input-field resize-none text-sm"
                rows={3}
                placeholder="Ex: Gostaria de fazer unha e cabelo..."
                value={formPedido.observacao}
                onChange={e =>
                  setFormPedido(p => ({
                    ...p,
                    observacao: e.target.value
                  }))
                }
              />

            </div>

            <div className="flex gap-3 mt-2">

              <button
                onClick={() =>
                  setModalPedido(false)
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm"
              >
                Cancelar
              </button>

              <button
                onClick={enviarPedidoHorario}
                disabled={
                  enviandoPedido ||
                  !formPedido.data
                }
                className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-40 shadow-md"
                style={{
                  backgroundColor: cor
                }}
              >
                {enviandoPedido
                  ? 'Enviando...'
                  : 'Enviar Pedido'}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================== */}
      {/* MODAL LIBERAR HORÁRIO */}
      {/* ======================================================== */}

      {modalVago && (

        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">

          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">

              <h3 className="font-bold text-gray-900 text-lg">
                Liberar horário vago
              </h3>

              <button
                onClick={() =>
                  setModalVago(false)
                }
                className="text-gray-400 font-bold text-xl"
              >
                ✕
              </button>

            </div>

            <div className="grid grid-cols-2 gap-3">

              <div>

                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  Data *
                </label>

                <input
                  className="input-field"
                  type="date"
                  value={formVago.data}
                  onChange={e =>
                    setFormVago(p => ({
                      ...p,
                      data: e.target.value
                    }))
                  }
                />

              </div>

              <div>

                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  Horário *
                </label>

                <input
                  className="input-field"
                  type="time"
                  value={formVago.hora}
                  onChange={e =>
                    setFormVago(p => ({
                      ...p,
                      hora: e.target.value
                    }))
                  }
                />

              </div>

            </div>

            <div>

              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Serviço disponível *
              </label>

              {servicos.length === 0 ? (

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">

                  <p className="text-xs text-amber-700 leading-relaxed">
                    Nenhum serviço cadastrado foi encontrado. Cadastre um serviço antes de liberar este horário.
                  </p>

                </div>

              ) : (

                <select
                  className="input-field"
                  value={formVago.servico_id}
                  onChange={e =>
                    selecionarServico(
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Selecione o serviço...
                  </option>

                  {servicos.map(servico => {

                    const duracao =
                      obterDuracaoServico(
                        servico
                      )

                    return (

                      <option
                        key={servico.id}
                        value={servico.id}
                      >
                        {obterNomeServico(
                          servico
                        )}{' '}
                        ({formatarDuracao(
                          duracao
                        )})
                      </option>

                    )

                  })}

                </select>

              )}

            </div>

            <div>

              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Duração
              </label>

              <div className="input-field bg-gray-50 flex items-center justify-between">

                <span
                  className={
                    formVago.servico_id
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-400'
                  }
                >
                  {formVago.servico_id
                    ? formatarDuracao(
                        duracaoAtual
                      )
                    : 'Selecione um serviço'}
                </span>

                {formVago.servico_id && (

                  <span className="text-[10px] text-gray-400">
                    definida pelo serviço
                  </span>

                )}

              </div>

              <p className="text-[10px] text-gray-400 mt-1">
                A duração é definida automaticamente de acordo com o serviço selecionado.
              </p>

            </div>

            <div>

              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Profissional (opcional)
              </label>

              <select
                className="input-field"
                value={
                  formVago.profissional_id
                }
                onChange={e =>
                  setFormVago(p => ({
                    ...p,
                    profissional_id:
                      e.target.value
                  }))
                }
              >

                <option value="">
                  Qualquer profissional
                </option>

                {funcionarios.map(f => (

                  <option
                    key={f.id}
                    value={f.id}
                  >
                    {f.nome}
                  </option>

                ))}

              </select>

              <p className="text-[10px] text-gray-400 mt-1">
                Deixe em "Qualquer profissional" para não vincular a uma profissional específica.
              </p>

            </div>

            <div>

              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Observação (opcional)
              </label>

              <input
                className="input-field"
                placeholder="Ex: Disponível para manicure"
                value={
                  formVago.observacao
                }
                onChange={e =>
                  setFormVago(p => ({
                    ...p,
                    observacao:
                      e.target.value
                  }))
                }
              />

            </div>

            <div className="flex gap-3 pt-1">

              <button
                onClick={() =>
                  setModalVago(false)
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={liberarHorario}
                disabled={
                  salvandoVago ||
                  !formVago.data ||
                  !formVago.hora ||
                  !formVago.servico_id ||
                  servicos.length === 0
                }
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-40"
                style={{
                  backgroundColor: cor
                }}
              >
                {salvandoVago
                  ? 'Salvando...'
                  : 'Liberar horário'}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================== */}
      {/* MODAL STORY — NOVA VERSÃO */}
      {/* ======================================================== */}

      {modalStory && (

        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4">

          <div className="bg-white w-full max-w-5xl rounded-3xl overflow-hidden max-h-[96vh] flex flex-col">

            {/* ------------------------------------------------ */}
            {/* CABEÇALHO */}
            {/* ------------------------------------------------ */}

            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">

              <div className="flex items-center gap-3">

                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${cor}12`
                  }}
                >
                  <Sparkles
                    size={19}
                    style={{
                      color: cor
                    }}
                  />
                </div>

                <div>

                  <h3 className="font-bold text-gray-900 text-base">
                    Criar Arte para Story
                  </h3>

                  <p className="text-xs text-gray-400">
                    Monte sua divulgação em poucos segundos
                  </p>

                </div>

              </div>

              <button
                onClick={() =>
                  setModalStory(false)
                }
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X
                  size={17}
                  className="text-gray-500"
                />
              </button>

            </div>

            {/* ------------------------------------------------ */}
            {/* CORPO */}
            {/* ------------------------------------------------ */}

            <div className="flex-1 overflow-y-auto">

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0">

                {/* ============================================ */}
                {/* ESQUERDA — CONFIGURAÇÕES */}
                {/* ============================================ */}

                <div className="p-5 flex flex-col gap-5">

                  {/* DATA */}

                  <div>

                    <div className="flex items-center justify-between mb-2">

                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        1. Data
                      </label>

                    </div>

                    <input
                      className="input-field text-sm"
                      type="date"
                      value={
                        dataSelecionadaStory
                      }
                      onChange={e => {

                        setDataSelecionadaStory(
                          e.target.value
                        )

                        setHorariosSelecionadosStory(
                          []
                        )

                      }}
                    />

                  </div>

                  {/* HORÁRIOS */}

                  <div>

                    <div className="flex items-center justify-between mb-2">

                      <div>

                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                          2. Horários
                        </label>

                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Escolha quais horários aparecerão na arte
                        </p>

                      </div>

                      {vagosDoDiaStory.length > 0 && (

                        <button
                          onClick={
                            selecionarTodosStory
                          }
                          className="text-xs font-semibold"
                          style={{
                            color: cor
                          }}
                        >
                          {horariosSelecionadosStory.length ===
                          vagosDoDiaStory.length
                            ? 'Desmarcar todos'
                            : 'Selecionar todos'}
                        </button>

                      )}

                    </div>

                    {vagosDoDiaStory.length === 0 ? (

                      <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center">

                        <Clock
                          size={25}
                          className="text-gray-300 mx-auto mb-2"
                        />

                        <p className="text-sm font-medium text-gray-500">
                          Nenhum horário disponível
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          Libere um horário para esta data primeiro.
                        </p>

                      </div>

                    ) : (

                      <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">

                        {vagosDoDiaStory.map(h => {

                          const selecionado =
                            horariosSelecionadosStory.includes(
                              h.id
                            )

                          const hora =
                            new Date(
                              h.data_hora
                            ).toLocaleTimeString(
                              'pt-BR',
                              {
                                hour: '2-digit',
                                minute: '2-digit'
                              }
                            )

                          return (

                            <button
                              key={h.id}
                              onClick={() =>
                                alternarHorarioStory(
                                  h.id
                                )
                              }
                              className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                              style={
                                selecionado
                                  ? {
                                      borderColor:
                                        cor,
                                      backgroundColor:
                                        `${cor}08`
                                    }
                                  : {
                                      borderColor:
                                        '#e5e7eb'
                                    }
                              }
                            >

                              {selecionado
                                ? (
                                  <CheckCircle2
                                    size={20}
                                    style={{
                                      color: cor
                                    }}
                                  />
                                )
                                : (
                                  <Circle
                                    size={20}
                                    className="text-gray-300"
                                  />
                                )}

                              <div className="flex-1">

                                <p className="font-bold text-gray-900 text-sm">
                                  {hora}
                                </p>

                                <p className="text-[11px] text-gray-400">

                                  {h.profiles?.nome
                                    ? h.profiles.nome
                                    : 'Horário disponível'}

                                  {h.duracao_minutos
                                    ? ` · ${formatarDuracao(Number(h.duracao_minutos))}`
                                    : ''}

                                </p>

                              </div>

                              {selecionado && (

                                <span
                                  className="text-[10px] font-bold"
                                  style={{
                                    color: cor
                                  }}
                                >
                                  Selecionado
                                </span>

                              )}

                            </button>

                          )

                        })}

                      </div>

                    )}

                    {vagosDoDiaStory.length > 0 && (

                      <p className="text-[10px] text-gray-400 mt-2">
                        Se nenhum horário for selecionado, todos serão exibidos.
                      </p>

                    )}

                  </div>

                  {/* TEXTO */}

                  <div>

                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-2">
                      3. Texto da arte
                    </label>

                    <div className="flex flex-col gap-2">

                      <div>

                        <label className="text-[11px] text-gray-500 block mb-1">
                          Título
                        </label>

                        <input
                          className="input-field text-sm"
                          maxLength={40}
                          value={tituloStory}
                          onChange={e =>
                            setTituloStory(
                              e.target.value
                            )
                          }
                          placeholder="Ex.: Horários Vagos"
                        />

                      </div>

                      <div>

                        <label className="text-[11px] text-gray-500 block mb-1">
                          Texto auxiliar
                        </label>

                        <input
                          className="input-field text-sm"
                          maxLength={70}
                          value={subtituloStory}
                          onChange={e =>
                            setSubtituloStory(
                              e.target.value
                            )
                          }
                          placeholder="Ex.: Ainda temos alguns horários disponíveis"
                        />

                      </div>

                      <div>

                        <label className="text-[11px] text-gray-500 block mb-1">
                          Botão / chamada
                        </label>

                        <input
                          className="input-field text-sm"
                          maxLength={35}
                          value={ctaStory}
                          onChange={e =>
                            setCtaStory(
                              e.target.value
                            )
                          }
                          placeholder="Ex.: Garanta o seu horário!"
                        />

                      </div>

                    </div>

                  </div>

                  {/* OPÇÕES */}

                  <div>

                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-2">
                      4. Informações
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

                      <button
                        onClick={() =>
                          setMostrarDataStory(
                            !mostrarDataStory
                          )
                        }
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-left"
                      >

                        <div>

                          <p className="text-xs font-semibold text-gray-800">
                            Data
                          </p>

                          <p className="text-[10px] text-gray-400">
                            Mostrar data
                          </p>

                        </div>

                        {mostrarDataStory
                          ? (
                            <Eye
                              size={16}
                              style={{
                                color: cor
                              }}
                            />
                          )
                          : (
                            <EyeOff
                              size={16}
                              className="text-gray-300"
                            />
                          )}

                      </button>

                      <button
                        onClick={() =>
                          setMostrarProfissionalStory(
                            !mostrarProfissionalStory
                          )
                        }
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-left"
                      >

                        <div>

                          <p className="text-xs font-semibold text-gray-800">
                            Profissional
                          </p>

                          <p className="text-[10px] text-gray-400">
                            Mostrar nome
                          </p>

                        </div>

                        {mostrarProfissionalStory
                          ? (
                            <Eye
                              size={16}
                              style={{
                                color: cor
                              }}
                            />
                          )
                          : (
                            <EyeOff
                              size={16}
                              className="text-gray-300"
                            />
                          )}

                      </button>

                      <button
                        onClick={() =>
                          setMostrarLogoStory(
                            !mostrarLogoStory
                          )
                        }
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-left"
                      >

                        <div>

                          <p className="text-xs font-semibold text-gray-800">
                            Marca
                          </p>

                          <p className="text-[10px] text-gray-400">
                            Nome do salão
                          </p>

                        </div>

                        {mostrarLogoStory
                          ? (
                            <Eye
                              size={16}
                              style={{
                                color: cor
                              }}
                            />
                          )
                          : (
                            <EyeOff
                              size={16}
                              className="text-gray-300"
                            />
                          )}

                      </button>

                    </div>

                  </div>

                  {/* LAYOUT */}

                  <div>

                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-2">
                      5. Estilo da arte
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

                      {[
                        {
                          key: 'elegante',
                          emoji: '✨',
                          label: 'Elegante',
                          desc: 'Escuro e sofisticado'
                        },
                        {
                          key: 'clean',
                          emoji: '🤍',
                          label: 'Clean',
                          desc: 'Claro e delicado'
                        },
                        {
                          key: 'destaque',
                          emoji: '🔥',
                          label: 'Destaque',
                          desc: 'Forte e chamativo'
                        },
                        {
                          key: 'romantico',
                          emoji: '🌸',
                          label: 'Romântico',
                          desc: 'Suave e feminino'
                        },
                        {
                          key: 'moderno',
                          emoji: '◼️',
                          label: 'Moderno',
                          desc: 'Contemporâneo'
                        },
                        {
                          key: 'minimal',
                          emoji: '○',
                          label: 'Minimal',
                          desc: 'Simples e refinado'
                        },
                      ].map(l => (

                        <button
                          key={l.key}
                          onClick={() =>
                            setLayoutStory(
                              l.key as LayoutStory
                            )
                          }
                          className="p-3 rounded-xl border text-left transition-all"
                          style={
                            layoutStory === l.key
                              ? {
                                  borderColor:
                                    cor,
                                  backgroundColor:
                                    `${cor}08`
                                }
                              : {
                                  borderColor:
                                    '#e5e7eb'
                                }
                          }
                        >

                          <div className="flex items-center gap-2">

                            <span className="text-sm">
                              {l.emoji}
                            </span>

                            <span
                              className="text-xs font-bold"
                              style={
                                layoutStory ===
                                l.key
                                  ? {
                                      color: cor
                                    }
                                  : {}
                              }
                            >
                              {l.label}
                            </span>

                          </div>

                          <p className="text-[9px] text-gray-400 mt-1">
                            {l.desc}
                          </p>

                        </button>

                      ))}

                    </div>

                  </div>

                </div>

                {/* ============================================ */}
                {/* DIREITA — PREVIEW */}
                {/* ============================================ */}

                <div className="bg-gray-100 p-5 flex flex-col items-center justify-center gap-4 border-t lg:border-t-0 lg:border-l border-gray-200">

                  <div className="w-full flex items-center justify-between">

                    <div>

                      <p className="text-xs font-bold text-gray-700">
                        Prévia
                      </p>

                      <p className="text-[10px] text-gray-400">
                        Formato Story · 9:16
                      </p>

                    </div>

                    <button
                      onClick={() => {
                        setTituloStory('Horários Vagos')
                        setSubtituloStory(
                          'Ainda temos alguns horários disponíveis'
                        )
                        setCtaStory(
                          'Garanta o seu horário!'
                        )
                        setMostrarDataStory(true)
                        setMostrarProfissionalStory(true)
                        setMostrarLogoStory(true)
                        setLayoutStory('elegante')
                        setHorariosSelecionadosStory([])
                      }}
                      className="flex items-center gap-1 text-[10px] font-semibold text-gray-500"
                    >
                      <RotateCcw size={12} />
                      Restaurar
                    </button>

                  </div>

                  {/* STORY */}

                  <div className="bg-gray-900 rounded-3xl p-3 shadow-inner">

                    <div
                      ref={cardRef}
                      className="relative overflow-hidden select-none flex flex-col"
                      style={{
                        width: '270px',
                        height: '480px',
                        background:
                          configLayout.fundo,
                        color:
                          configLayout.texto,
                        boxShadow:
                          configLayout.sombra,
                      }}
                    >

                      {/* DECORAÇÕES */}

                      {layoutStory === 'elegante' && (

                        <>
                          <div
                            className="absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-25"
                            style={{
                              backgroundColor:
                                cor
                            }}
                          />

                          <div
                            className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full blur-3xl opacity-15"
                            style={{
                              backgroundColor:
                                cor
                            }}
                          />
                        </>

                      )}

                      {layoutStory === 'romantico' && (

                        <>
                          <div
                            className="absolute -top-20 -left-20 w-44 h-44 rounded-full blur-3xl opacity-25"
                            style={{
                              backgroundColor:
                                cor
                            }}
                          />

                          <div
                            className="absolute bottom-0 right-0 text-7xl opacity-10"
                          >
                            ✿
                          </div>
                        </>

                      )}

                      {layoutStory === 'destaque' && (

                        <div
                          className="absolute inset-3 rounded-3xl border opacity-40"
                          style={{
                            borderColor: cor
                          }}
                        />

                      )}

                      {/* CABEÇALHO DA ARTE */}

                      <div className="relative z-10 px-6 pt-7 text-center">

                        {mostrarLogoStory && (

                          <p
                            className="text-[9px] uppercase tracking-[0.28em] font-bold mb-2"
                            style={{
                              color:
                                configLayout.destaque
                            }}
                          >
                            {salao?.nome ||
                              'Seu salão'}
                          </p>

                        )}

                        <h2
                          className="font-black tracking-tight leading-tight"
                          style={{
                            fontSize:
                              tituloStory.length >
                              25
                                ? '19px'
                                : '23px'
                          }}
                        >
                          {tituloStory ||
                            'Horários Vagos'}
                        </h2>

                        {mostrarDataStory && (

                          <p
                            className="text-[10px] mt-2 capitalize"
                            style={{
                              color:
                                configLayout.textoSecundario
                            }}
                          >
                            {formatarDataStory(
                              dataSelecionadaStory
                            )}
                          </p>

                        )}

                        {subtituloStory && (

                          <p
                            className="text-[10px] mt-2 leading-relaxed px-3"
                            style={{
                              color:
                                configLayout.textoSecundario
                            }}
                          >
                            {subtituloStory}
                          </p>

                        )}

                      </div>

                      {/* HORÁRIOS */}

                      <div className="relative z-10 flex-1 px-5 py-4 flex flex-col justify-center">

                        {horariosParaArte.length > 0 ? (

                          <div
                            className="grid gap-2"
                            style={{
                              gridTemplateColumns:
                                horariosParaArte.length >= 7
                                  ? 'repeat(2, 1fr)'
                                  : '1fr'
                            }}
                          >

                            {horariosParaArte
                              .slice(0, 8)
                              .map((h, index) => {

                                const hora =
                                  new Date(
                                    h.data_hora
                                  ).toLocaleTimeString(
                                    'pt-BR',
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    }
                                  )

                                const muitos =
                                  horariosParaArte.length >=
                                  7

                                return (

                                  <div
                                    key={h.id || index}
                                    className="rounded-2xl px-3 py-3 flex items-center justify-between border backdrop-blur-sm"
                                    style={{
                                      background:
                                        configLayout.card,
                                      borderColor:
                                        configLayout.borda
                                    }}
                                  >

                                    <div className="flex items-center gap-2">

                                      <Clock
                                        size={
                                          muitos
                                            ? 11
                                            : 14
                                        }
                                        style={{
                                          color:
                                            configLayout.destaque
                                        }}
                                      />

                                      <span
                                        className="font-black tracking-wide"
                                        style={{
                                          fontSize:
                                            muitos
                                              ? '14px'
                                              : '18px'
                                        }}
                                      >
                                        {hora}
                                      </span>

                                    </div>

                                    {mostrarProfissionalStory &&
                                      h.profiles?.nome && (

                                        <span
                                          className="text-[8px] truncate max-w-[90px]"
                                          style={{
                                            color:
                                              configLayout.textoSecundario
                                          }}
                                        >
                                          {h.profiles.nome}
                                        </span>

                                      )}

                                  </div>

                                )

                              })}

                          </div>

                        ) : (

                          <div className="text-center">

                            <Clock
                              size={25}
                              className="mx-auto mb-2 opacity-30"
                            />

                            <p
                              className="text-[10px]"
                              style={{
                                color:
                                  configLayout.textoSecundario
                              }}
                            >
                              Nenhum horário selecionado
                            </p>

                          </div>

                        )}

                        {horariosParaArte.length > 8 && (

                          <p
                            className="text-[8px] text-center mt-2"
                            style={{
                              color:
                                configLayout.textoSecundario
                            }}
                          >
                            + {horariosParaArte.length - 8}{' '}
                            outros horários disponíveis
                          </p>

                        )}

                      </div>

                      {/* RODAPÉ */}

                      <div className="relative z-10 px-5 pb-6 text-center">

                        {ctaStory && (

                          <div
                            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full font-bold text-[10px] shadow-lg"
                            style={{
                              backgroundColor:
                                configLayout.destaque,
                              color:
                                '#ffffff'
                            }}
                          >
                            {ctaStory} 📲
                          </div>

                        )}

                        <p
                          className="text-[7px] mt-2 tracking-wide"
                          style={{
                            color:
                              configLayout.textoSecundario
                          }}
                        >
                          Agende pelo link na bio
                        </p>

                      </div>

                    </div>

                  </div>

                  {/* INFO */}

                  <div className="w-full bg-white rounded-xl p-3">

                    <div className="flex items-center gap-2">

                      <Check
                        size={15}
                        style={{
                          color: cor
                        }}
                      />

                      <p className="text-[10px] text-gray-500">
                        {horariosParaArte.length === 0
                          ? 'Nenhum horário para exibir'
                          : `${horariosParaArte.length} horário(s) na arte`}
                      </p>

                    </div>

                  </div>

                </div>

              </div>

            </div>

            {/* ------------------------------------------------ */}
            {/* RODAPÉ */}
            {/* ------------------------------------------------ */}

            <div className="border-t border-gray-100 px-5 py-4 flex gap-3 shrink-0 bg-white">

              <button
                onClick={() =>
                  setModalStory(false)
                }
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm"
              >
                Fechar
              </button>

              <button
                onClick={baixarImagemStory}
                disabled={
                  gerandoImagem ||
                  horariosParaArte.length === 0
                }
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-semibold text-sm shadow-md disabled:opacity-40"
                style={{
                  backgroundColor: cor
                }}
              >

                <Download size={16} />

                {gerandoImagem
                  ? 'Gerando imagem...'
                  : 'Baixar imagem'}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}