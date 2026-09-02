// @ts-nocheck
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  X,
  RotateCcw,
} from 'lucide-react'
import { toPng } from 'html-to-image'

const DIAS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

const PADRAO = {
  Domingo: false,
  'Segunda-feira': true,
  'Terça-feira': true,
  'Quarta-feira': true,
  'Quinta-feira': true,
  'Sexta-feira': true,
  'Sábado': true,
}

const estilosStory = [
  {
    id: 'elegante',
    nome: 'Elegante',
    descricao: 'Delicado e sofisticado',
  },
  {
    id: 'clean',
    nome: 'Clean',
    descricao: 'Leve e minimalista',
  },
  {
    id: 'destaque',
    nome: 'Destaque',
    descricao: 'Forte e chamativo',
  },
  {
    id: 'romantico',
    nome: 'Romântico',
    descricao: 'Feminino e delicado',
  },
  {
    id: 'moderno',
    nome: 'Moderno',
    descricao: 'Atual e marcante',
  },
  {
    id: 'minimal',
    nome: 'Minimal',
    descricao: 'Poucos elementos',
  },
]

export default function SalaoHorariosPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)

  const [salao, setSalao] = useState<any>(null)
  const [funcionamento, setFuncionamento] = useState<any>(PADRAO)
  const [horarios, setHorarios] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])

  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const [formVago, setFormVago] = useState({
    data: '',
    hora: '',
    duracao_minutos: 60,
    profissional_id: '',
    servico_id: '',
    observacao: '',
  })

  const [salvandoHorario, setSalvandoHorario] = useState(false)

  /*
   * STORY
   */
  const [mostrarStory, setMostrarStory] = useState(false)

  const [dataStory, setDataStory] = useState('')
  const [horariosSelecionadosStory, setHorariosSelecionadosStory] =
    useState<string[]>([])

  const [estiloStory, setEstiloStory] = useState('elegante')

  const [tituloStory, setTituloStory] = useState('Horários Vagos')
  const [subtituloStory, setSubtituloStory] = useState(
    'Ainda temos alguns horários disponíveis'
  )
  const [ctaStory, setCtaStory] = useState(
    'Garanta o seu horário!'
  )

  const [mostrarDataStory, setMostrarDataStory] = useState(true)
  const [mostrarProfissionalStory, setMostrarProfissionalStory] =
    useState(true)
  const [mostrarLogoStory, setMostrarLogoStory] = useState(true)

  const [gerandoStory, setGerandoStory] = useState(false)

  const storyRef = useRef<HTMLDivElement>(null)

  /*
   * COR PRINCIPAL
   *
   * IMPORTANTE:
   * esta variável precisa existir ANTES de obterConfigLayout().
   * Isso corrige o ReferenceError do build da Vercel.
   */
  const cor =
    salao?.cor_primaria ||
    salao?.cor_principal ||
    salao?.cor ||
    '#D98FA5'

  const nomeSalao =
    salao?.nome ||
    salao?.nome_fantasia ||
    'Organiza Salão'

  const logoSalao =
    salao?.logo_url ||
    salao?.logo ||
    '/icon.png'

  const dataStorySelecionada = useMemo(() => {
    if (!dataStory) return null

    const [ano, mes, dia] = dataStory.split('-').map(Number)

    if (!ano || !mes || !dia) return null

    return new Date(ano, mes - 1, dia)
  }, [dataStory])

  const horariosDoStory = useMemo(() => {
    if (!dataStory) return []

    return horarios
      .filter((h) => {
        if (!h?.data_hora) return false

        const data = new Date(h.data_hora)

        const ano = data.getFullYear()
        const mes = String(data.getMonth() + 1).padStart(2, '0')
        const dia = String(data.getDate()).padStart(2, '0')

        return `${ano}-${mes}-${dia}` === dataStory
      })
      .sort(
        (a, b) =>
          new Date(a.data_hora).getTime() -
          new Date(b.data_hora).getTime()
      )
  }, [horarios, dataStory])

  /*
   * CONFIGURAÇÃO DOS LAYOUTS
   *
   * 'cor' já foi declarada acima.
   */
  const obterConfigLayout = () => {
    switch (estiloStory) {
      case 'clean':
        return {
          fundo: '#FFFDFC',
          texto: '#343434',
          textoSecundario: '#777777',
          destaque: cor,
          borda: cor,
        }

      case 'destaque':
        return {
          fundo: cor,
          texto: '#FFFFFF',
          textoSecundario: '#FFFFFF',
          destaque: '#FFFFFF',
          borda: '#FFFFFF',
        }

      case 'romantico':
        return {
          fundo: '#FCECEF',
          texto: '#7D4D5B',
          textoSecundario: '#A66F7F',
          destaque: cor,
          borda: '#E9B8C5',
        }

      case 'moderno':
        return {
          fundo: '#222222',
          texto: '#FFFFFF',
          textoSecundario: '#D6D6D6',
          destaque: cor,
          borda: cor,
        }

      case 'minimal':
        return {
          fundo: '#FFFFFF',
          texto: '#222222',
          textoSecundario: '#666666',
          destaque: cor,
          borda: '#EEEEEE',
        }

      case 'elegante':
      default:
        return {
          fundo: '#F8F2F4',
          texto: '#51363F',
          textoSecundario: '#8A6972',
          destaque: cor,
          borda: '#E4C5CE',
        }
    }
  }

  const configLayout = obterConfigLayout()

  useEffect(() => {
    if (authLoading) return

    if (!profile) {
      router.push('/login')
      return
    }

    carregarDados()
  }, [profile, authLoading])

  useEffect(() => {
    if (!dataStory && horarios.length > 0) {
      const primeiro = horarios
        .filter((h) => h?.data_hora)
        .sort(
          (a, b) =>
            new Date(a.data_hora).getTime() -
            new Date(b.data_hora).getTime()
        )[0]

      if (primeiro?.data_hora) {
        const data = new Date(primeiro.data_hora)

        const ano = data.getFullYear()
        const mes = String(data.getMonth() + 1).padStart(2, '0')
        const dia = String(data.getDate()).padStart(2, '0')

        setDataStory(`${ano}-${mes}-${dia}`)
      }
    }
  }, [horarios, dataStory])

  useEffect(() => {
    if (!dataStory) return

    const disponiveis = horariosDoStory.map((h) => h.id)

    setHorariosSelecionadosStory((anteriores) =>
      anteriores.filter((id) => disponiveis.includes(id))
    )
  }, [dataStory, horariosDoStory])

  const carregarDados = async () => {
    if (!profile?.salao_id) return

    try {
      setCarregando(true)

      const [
        salaoResponse,
        funcionamentoResponse,
        horariosResponse,
        profissionaisResponse,
        servicosResponse,
      ] = await Promise.all([
        supabase
          .from('saloes')
          .select('*')
          .eq('id', profile.salao_id)
          .maybeSingle(),

        supabase
          .from('saloes')
          .select('horarios_funcionamento')
          .eq('id', profile.salao_id)
          .maybeSingle(),

        supabase
          .from('horarios_vagos')
          .select(`
            *,
            profiles:profissional_id(nome),
            clientes:cliente_id(nome)
          `)
          .eq('salao_id', profile.salao_id)
          .order('data_hora', { ascending: true }),

        supabase
          .from('profiles')
          .select('id, nome')
          .eq('salao_id', profile.salao_id)
          .order('nome'),

        supabase
          .from('servicos')
          .select('*')
          .eq('salao_id', profile.salao_id)
          .order('nome'),
      ])

      if (salaoResponse.error) {
        console.error(
          'Erro ao carregar salão:',
          salaoResponse.error
        )
      }

      if (horariosResponse.error) {
        console.error(
          'Erro ao carregar horários:',
          horariosResponse.error
        )
      }

      if (profissionaisResponse.error) {
        console.error(
          'Erro ao carregar profissionais:',
          profissionaisResponse.error
        )
      }

      if (servicosResponse.error) {
        console.error(
          'Erro ao carregar serviços:',
          servicosResponse.error
        )
      }

      setSalao(salaoResponse.data || null)

      const funcionamentoSalvo =
        funcionamentoResponse.data?.horarios_funcionamento

      if (funcionamentoSalvo) {
        try {
          const valor =
            typeof funcionamentoSalvo === 'string'
              ? JSON.parse(funcionamentoSalvo)
              : funcionamentoSalvo

          setFuncionamento({
            ...PADRAO,
            ...valor,
          })
        } catch {
          setFuncionamento(PADRAO)
        }
      }

      setHorarios(horariosResponse.data || [])
      setProfissionais(profissionaisResponse.data || [])
      setServicos(servicosResponse.data || [])
    } catch (error) {
      console.error('Erro ao carregar página:', error)
    } finally {
      setCarregando(false)
    }
  }

  const obterDuracaoServico = (servico: any) => {
    if (!servico) return 60

    const campos = [
      'duracao_minutos',
      'duracao',
      'tempo_minutos',
      'tempo',
      'duracao_estimada',
      'tempo_estimado',
    ]

    for (const campo of campos) {
      const valor = Number(servico?.[campo])

      if (Number.isFinite(valor) && valor > 0) {
        return valor
      }
    }

    return 60
  }

  const selecionarServico = (servicoId: string) => {
    const servico = servicos.find((s) => s.id === servicoId)

    setFormVago((anterior) => ({
      ...anterior,
      servico_id: servicoId,
      duracao_minutos: obterDuracaoServico(servico),
    }))
  }

  const liberarHorario = async () => {
    if (!profile?.salao_id) return

    if (!formVago.data) {
      alert('Selecione a data do horário.')
      return
    }

    if (!formVago.hora) {
      alert('Selecione o horário.')
      return
    }

    setSalvandoHorario(true)

    try {
      /*
       * IMPORTANTE:
       * A data/hora digitada é horário LOCAL.
       *
       * Não colocamos Z manualmente.
       * O toISOString() faz a conversão para UTC corretamente.
       */
      const dataHoraBanco = new Date(
        `${formVago.data}T${formVago.hora}:00`
      ).toISOString()

      const duracao =
        Number(formVago.duracao_minutos) > 0
          ? Number(formVago.duracao_minutos)
          : 60

      const { data, error } = await supabase
        .from('horarios_vagos')
        .insert({
          salao_id: profile.salao_id,
          data_hora: dataHoraBanco,
          duracao_minutos: duracao,
          profissional_id:
            formVago.profissional_id || null,
          observacao:
            formVago.observacao || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao liberar horário:', error)
        alert(error.message)
        return
      }

      setHorarios((anteriores) =>
        [...anteriores, data].sort(
          (a, b) =>
            new Date(a.data_hora).getTime() -
            new Date(b.data_hora).getTime()
        )
      )

      setFormVago({
        data: '',
        hora: '',
        duracao_minutos: 60,
        profissional_id: '',
        servico_id: '',
        observacao: '',
      })

      setMostrarFormulario(false)
    } catch (error: any) {
      console.error('Erro ao liberar horário:', error)

      alert(
        error?.message ||
          'Não foi possível liberar o horário.'
      )
    } finally {
      setSalvandoHorario(false)
    }
  }

  const excluirHorario = async (id: string) => {
    const confirmar = window.confirm(
      'Deseja realmente excluir este horário?'
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('horarios_vagos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao excluir horário:', error)
      alert(error.message)
      return
    }

    setHorarios((anteriores) =>
      anteriores.filter((h) => h.id !== id)
    )

    setHorariosSelecionadosStory((anteriores) =>
      anteriores.filter((item) => item !== id)
    )
  }

  const enviarPedidoHorario = async () => {
    if (!profile?.salao_id) return

    const data = formVago.data
      ? new Date(`${formVago.data}T12:00:00`)
      : null

    const dataFormatada = data
      ? data.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : ''

    const mensagem = `Novo horário disponível para agendamento${dataFormatada ? ` em ${dataFormatada}` : ''}${formVago.hora ? ` às ${formVago.hora}` : ''}.`

    const { error } = await supabase
      .from('notificacoes')
      .insert({
        salao_id: profile.salao_id,
        titulo: 'Novo Pedido de Agendamento',
        mensagem,
        tipo: 'agendamento',
      })

    if (error) {
      console.error(
        'Erro ao criar notificação:',
        error
      )

      return
    }
  }

  const salvarFuncionamento = async (
    novoFuncionamento: any
  ) => {
    if (!profile?.salao_id) return

    setFuncionamento(novoFuncionamento)

    const { error } = await supabase
      .from('saloes')
      .update({
        horarios_funcionamento: novoFuncionamento,
      })
      .eq('id', profile.salao_id)

    if (error) {
      console.error(
        'Erro ao salvar funcionamento:',
        error
      )
    }
  }

  const formatarData = (valor: string) => {
    if (!valor) return ''

    const [ano, mes, dia] = valor.split('-').map(Number)

    if (!ano || !mes || !dia) return valor

    return new Date(
      ano,
      mes - 1,
      dia
    ).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatarHora = (valor: string | Date) => {
    const data =
      valor instanceof Date
        ? valor
        : new Date(valor)

    return data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const dataDoHorario = (valor: string) => {
    const data = new Date(valor)

    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')

    return `${ano}-${mes}-${dia}`
  }

  const toggleHorarioStory = (id: string) => {
    setHorariosSelecionadosStory((anteriores) => {
      if (anteriores.includes(id)) {
        return anteriores.filter((item) => item !== id)
      }

      return [...anteriores, id]
    })
  }

  const selecionarTodosStory = () => {
    setHorariosSelecionadosStory(
      horariosDoStory.map((h) => h.id)
    )
  }

  const desmarcarTodosStory = () => {
    setHorariosSelecionadosStory([])
  }

  const horariosEscolhidosStory = horariosDoStory.filter(
    (h) => horariosSelecionadosStory.includes(h.id)
  )

  const resetarStory = () => {
    setTituloStory('Horários Vagos')

    setSubtituloStory(
      'Ainda temos alguns horários disponíveis'
    )

    setCtaStory('Garanta o seu horário!')

    setEstiloStory('elegante')

    setMostrarDataStory(true)
    setMostrarProfissionalStory(true)
    setMostrarLogoStory(true)

    setHorariosSelecionadosStory([])
  }

  const baixarStory = async () => {
    if (!storyRef.current) return

    if (horariosEscolhidosStory.length === 0) {
      alert('Selecione pelo menos um horário para criar a arte.')
      return
    }

    setGerandoStory(true)

    try {
      const imagem = await toPng(storyRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        quality: 1,
      })

      const link = document.createElement('a')

      link.download = `story-horarios-${dataStory || 'disponiveis'}.png`

      link.href = imagem

      link.click()
    } catch (error) {
      console.error(
        'Erro ao gerar Story:',
        error
      )

      alert(
        'Não foi possível gerar a imagem. Tente novamente.'
      )
    } finally {
      setGerandoStory(false)
    }
  }

  const renderHorarioStory = (horario: any) => {
    const profissional =
      horario?.profiles?.nome ||
      ''

    return (
      <div
        key={horario.id}
        className="flex items-center justify-center gap-2"
      >
        <span className="font-semibold">
          {formatarHora(horario.data_hora)}
        </span>

        {mostrarProfissionalStory &&
          profissional && (
            <span className="opacity-80">
              • {profissional}
            </span>
          )}
      </div>
    )
  }

  const renderStory = () => {
    const estilo = configLayout

    const fonteTitulo =
      estiloStory === 'romantico'
        ? 'Georgia, serif'
        : 'Arial, sans-serif'

    const dataFormatadaStory =
      dataStorySelecionada
        ? dataStorySelecionada.toLocaleDateString(
            'pt-BR',
            {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            }
          )
        : ''

    return (
      <div
        ref={storyRef}
        style={{
          width: '270px',
          height: '480px',
          background: estilo.fundo,
          color: estilo.texto,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Arial, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '30px 22px',
          boxSizing: 'border-box',
        }}
      >
        {estiloStory === 'romantico' && (
          <>
            <div
              style={{
                position: 'absolute',
                width: '150px',
                height: '150px',
                borderRadius: '999px',
                background: estilo.destaque,
                opacity: 0.08,
                top: '-60px',
                right: '-50px',
              }}
            />

            <div
              style={{
                position: 'absolute',
                width: '100px',
                height: '100px',
                borderRadius: '999px',
                background: estilo.destaque,
                opacity: 0.06,
                bottom: '40px',
                left: '-50px',
              }}
            />
          </>
        )}

        {estiloStory === 'moderno' && (
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '8px',
              background: estilo.destaque,
              top: 0,
              left: 0,
            }}
          />
        )}

        {estiloStory === 'minimal' && (
          <div
            style={{
              position: 'absolute',
              inset: '12px',
              border: `1px solid ${estilo.borda}`,
              pointerEvents: 'none',
            }}
          />
        )}

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center',
          }}
        >
          {mostrarLogoStory && (
            <div
              style={{
                width: '58px',
                height: '58px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${estilo.borda}`,
              }}
            >
              <img
                src={logoSalao}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}

          <div
            style={{
              fontFamily: fonteTitulo,
              fontSize: '27px',
              lineHeight: 1.1,
              fontWeight: 700,
              marginBottom: '10px',
            }}
          >
            {tituloStory}
          </div>

          <div
            style={{
              fontSize: '13px',
              lineHeight: 1.4,
              color: estilo.textoSecundario,
            }}
          >
            {subtituloStory}
          </div>

          {mostrarDataStory && dataFormatadaStory && (
            <div
              style={{
                marginTop: '14px',
                fontSize: '12px',
                fontWeight: 600,
                color: estilo.destaque,
              }}
            >
              {dataFormatadaStory}
            </div>
          )}
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: '9px',
            textAlign: 'center',
          }}
        >
          {horariosEscolhidosStory.length === 0 ? (
            <div
              style={{
                border: `1px solid ${estilo.borda}`,
                borderRadius: '14px',
                padding: '16px 10px',
                fontSize: '12px',
                color: estilo.textoSecundario,
              }}
            >
              Selecione os horários disponíveis
            </div>
          ) : (
            horariosEscolhidosStory.map(
              renderHorarioStory
            )
          )}
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              background: estilo.destaque,
              color:
                estiloStory === 'destaque'
                  ? cor
                  : '#FFFFFF',
              borderRadius: '999px',
              padding: '10px 18px',
              fontSize: '12px',
              fontWeight: 700,
              maxWidth: '100%',
            }}
          >
            {ctaStory}
          </div>

          <div
            style={{
              marginTop: '12px',
              fontSize: '10px',
              opacity: 0.65,
            }}
          >
            {nomeSalao}
          </div>
        </div>
      </div>
    )
  }

  if (authLoading || carregando) {
    return (
      <main className="min-h-screen bg-[#faf7f8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-pink-100 border-t-pink-500 animate-spin mx-auto mb-4" />

          <p className="text-sm text-gray-500">
            Carregando horários...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#faf7f8] pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        <header className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-600 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
              Horários vagos
            </h1>

            <p className="text-sm text-gray-500">
              Libere horários e divulgue sua disponibilidade.
            </p>
          </div>
        </header>

        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-800">
                Horários disponíveis
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Cadastre horários que ainda podem ser agendados.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setMostrarFormulario(
                  (valor) => !valor
                )
              }
              className="rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] text-white px-4 py-3 font-medium flex items-center justify-center gap-2"
            >
              {mostrarFormulario ? (
                <>
                  <ChevronUp className="w-5 h-5" />
                  Fechar
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Liberar horário
                </>
              )}
            </button>
          </div>

          {mostrarFormulario && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>

                  <input
                    type="date"
                    value={formVago.data}
                    onChange={(e) =>
                      setFormVago((anterior) => ({
                        ...anterior,
                        data: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Horário
                  </label>

                  <input
                    type="time"
                    value={formVago.hora}
                    onChange={(e) =>
                      setFormVago((anterior) => ({
                        ...anterior,
                        hora: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Serviço
                  </label>

                  <select
                    value={formVago.servico_id}
                    onChange={(e) =>
                      selecionarServico(
                        e.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  >
                    <option value="">
                      Selecionar serviço
                    </option>

                    {servicos.map((servico) => (
                      <option
                        key={servico.id}
                        value={servico.id}
                      >
                        {servico.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profissional
                  </label>

                  <select
                    value={formVago.profissional_id}
                    onChange={(e) =>
                      setFormVago((anterior) => ({
                        ...anterior,
                        profissional_id:
                          e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  >
                    <option value="">
                      Qualquer profissional
                    </option>

                    {profissionais.map(
                      (profissional) => (
                        <option
                          key={profissional.id}
                          value={profissional.id}
                        >
                          {profissional.nome}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duração
                  </label>

                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={formVago.duracao_minutos}
                    onChange={(e) =>
                      setFormVago((anterior) => ({
                        ...anterior,
                        duracao_minutos:
                          Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observação
                  </label>

                  <input
                    type="text"
                    value={formVago.observacao}
                    onChange={(e) =>
                      setFormVago((anterior) => ({
                        ...anterior,
                        observacao:
                          e.target.value,
                      }))
                    }
                    placeholder="Ex.: encaixe, última vaga..."
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <button
                  type="button"
                  onClick={liberarHorario}
                  disabled={salvandoHorario}
                  className="flex-1 rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] disabled:opacity-60 text-white py-3.5 font-medium flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />

                  {salvandoHorario
                    ? 'Salvando...'
                    : 'Liberar horário'}
                </button>

                <button
                  type="button"
                  onClick={enviarPedidoHorario}
                  className="rounded-2xl border border-pink-200 text-pink-600 px-5 py-3.5 font-medium"
                >
                  Notificar
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-pink-500" />
            </div>

            <div>
              <h2 className="font-semibold text-gray-800">
                Horários cadastrados
              </h2>

              <p className="text-sm text-gray-500">
                {horarios.length}{' '}
                {horarios.length === 1
                  ? 'horário disponível'
                  : 'horários disponíveis'}
              </p>
            </div>
          </div>

          {horarios.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />

              <p className="text-gray-500">
                Nenhum horário vago cadastrado.
              </p>

              <p className="text-sm text-gray-400 mt-1">
                Libere seu primeiro horário acima.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {horarios.map((horario) => {
                const data = new Date(
                  horario.data_hora
                )

                const profissional =
                  horario?.profiles?.nome

                return (
                  <div
                    key={horario.id}
                    className="rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-pink-50 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-pink-500" />
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">
                          {data.toLocaleDateString(
                            'pt-BR'
                          )}{' '}
                          às{' '}
                          {formatarHora(
                            horario.data_hora
                          )}
                        </p>

                        <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                          {profissional && (
                            <p>
                              Profissional:{' '}
                              {profissional}
                            </p>
                          )}

                          {horario.duracao_minutos && (
                            <p>
                              Duração:{' '}
                              {
                                horario.duracao_minutos
                              }{' '}
                              minutos
                            </p>
                          )}

                          {horario.observacao && (
                            <p>
                              {horario.observacao}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        excluirHorario(
                          horario.id
                        )
                      }
                      className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* GERADOR DE STORY */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mt-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-pink-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-pink-500" />
              </div>

              <div>
                <h2 className="font-semibold text-gray-800">
                  Divulgar horários
                </h2>

                <p className="text-sm text-gray-500">
                  Crie uma arte pronta para o Story.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMostrarStory(true)

                if (!dataStory && horarios.length) {
                  const primeiro = horarios
                    .filter((h) => h?.data_hora)
                    .sort(
                      (a, b) =>
                        new Date(
                          a.data_hora
                        ).getTime() -
                        new Date(
                          b.data_hora
                        ).getTime()
                    )[0]

                  if (primeiro?.data_hora) {
                    const data = new Date(
                      primeiro.data_hora
                    )

                    const ano =
                      data.getFullYear()

                    const mes = String(
                      data.getMonth() + 1
                    ).padStart(2, '0')

                    const dia = String(
                      data.getDate()
                    ).padStart(2, '0')

                    setDataStory(
                      `${ano}-${mes}-${dia}`
                    )
                  }
                }
              }}
              className="rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] text-white px-5 py-3 font-medium flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-5 h-5" />
              Criar arte para Story
            </button>
          </div>
        </section>
      </div>

      {/* MODAL STORY */}
      {mostrarStory && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
          <div className="bg-[#faf7f8] w-full sm:max-w-6xl sm:max-h-[95vh] rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-800">
                  Criar Arte para Story
                </h2>

                <p className="text-xs text-gray-500 mt-0.5">
                  Personalize a arte e baixe a imagem.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarStory(false)
                }
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(95vh-72px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5">
                {/* CONFIGURAÇÃO */}
                <div className="space-y-5">
                  <div className="bg-white rounded-3xl border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">
                      1. Escolha a data
                    </h3>

                    <input
                      type="date"
                      value={dataStory}
                      onChange={(e) =>
                        setDataStory(
                          e.target.value
                        )
                      }
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                    />

                    {dataStory && (
                      <p className="text-sm text-gray-500 mt-3">
                        {formatarData(dataStory)}
                      </p>
                    )}
                  </div>

                  <div className="bg-white rounded-3xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          2. Escolha os horários
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                          Selecione exatamente os horários que deseja divulgar.
                        </p>
                      </div>

                      {horariosDoStory.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              horariosSelecionadosStory.length ===
                              horariosDoStory.length
                            ) {
                              desmarcarTodosStory()
                            } else {
                              selecionarTodosStory()
                            }
                          }}
                          className="text-xs font-medium text-pink-600"
                        >
                          {horariosSelecionadosStory.length ===
                          horariosDoStory.length
                            ? 'Desmarcar todos'
                            : 'Selecionar todos'}
                        </button>
                      )}
                    </div>

                    {horariosDoStory.length === 0 ? (
                      <div className="rounded-2xl bg-gray-50 p-5 text-center">
                        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />

                        <p className="text-sm text-gray-500">
                          Nenhum horário encontrado para esta data.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {horariosDoStory.map(
                          (horario) => {
                            const selecionado =
                              horariosSelecionadosStory.includes(
                                horario.id
                              )

                            return (
                              <button
                                type="button"
                                key={horario.id}
                                onClick={() =>
                                  toggleHorarioStory(
                                    horario.id
                                  )
                                }
                                className={`w-full rounded-2xl border p-3 flex items-center justify-between transition ${
                                  selecionado
                                    ? 'border-pink-300 bg-pink-50'
                                    : 'border-gray-100 bg-white'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                      selecionado
                                        ? 'bg-[#d98fa5] text-white'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}
                                  >
                                    {selecionado && (
                                      <Check className="w-4 h-4" />
                                    )}
                                  </div>

                                  <div className="text-left">
                                    <p className="font-semibold text-gray-800">
                                      {formatarHora(
                                        horario.data_hora
                                      )}
                                    </p>

                                    {horario
                                      ?.profiles
                                      ?.nome && (
                                      <p className="text-xs text-gray-500">
                                        {
                                          horario
                                            .profiles
                                            .nome
                                        }
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <span className="text-xs text-gray-400">
                                  {horario.duracao_minutos
                                    ? `${horario.duracao_minutos} min`
                                    : ''}
                                </span>
                              </button>
                            )
                          }
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-3xl border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">
                      3. Textos
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Título
                        </label>

                        <input
                          type="text"
                          value={tituloStory}
                          onChange={(e) =>
                            setTituloStory(
                              e.target.value
                            )
                          }
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Subtítulo
                        </label>

                        <textarea
                          value={subtituloStory}
                          onChange={(e) =>
                            setSubtituloStory(
                              e.target.value
                            )
                          }
                          rows={2}
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Chamada
                        </label>

                        <input
                          type="text"
                          value={ctaStory}
                          onChange={(e) =>
                            setCtaStory(
                              e.target.value
                            )
                          }
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-pink-300"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">
                      4. Estilo
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                      {estilosStory.map(
                        (estilo) => {
                          const ativo =
                            estiloStory ===
                            estilo.id

                          return (
                            <button
                              type="button"
                              key={estilo.id}
                              onClick={() =>
                                setEstiloStory(
                                  estilo.id
                                )
                              }
                              className={`rounded-2xl border p-3 text-left transition ${
                                ativo
                                  ? 'border-pink-300 bg-pink-50'
                                  : 'border-gray-100 bg-white'
                              }`}
                            >
                              <p className="text-sm font-semibold text-gray-800">
                                {estilo.nome}
                              </p>

                              <p className="text-xs text-gray-500 mt-1">
                                {estilo.descricao}
                              </p>
                            </button>
                          )
                        }
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">
                      5. Elementos
                    </h3>

                    <div className="space-y-3">
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">
                          Mostrar data
                        </span>

                        <input
                          type="checkbox"
                          checked={mostrarDataStory}
                          onChange={(e) =>
                            setMostrarDataStory(
                              e.target.checked
                            )
                          }
                          className="w-5 h-5 accent-pink-500"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">
                          Mostrar profissional
                        </span>

                        <input
                          type="checkbox"
                          checked={
                            mostrarProfissionalStory
                          }
                          onChange={(e) =>
                            setMostrarProfissionalStory(
                              e.target.checked
                            )
                          }
                          className="w-5 h-5 accent-pink-500"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">
                          Mostrar logo
                        </span>

                        <input
                          type="checkbox"
                          checked={mostrarLogoStory}
                          onChange={(e) =>
                            setMostrarLogoStory(
                              e.target.checked
                            )
                          }
                          className="w-5 h-5 accent-pink-500"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={resetarStory}
                      className="flex-1 rounded-2xl border border-gray-200 bg-white py-3.5 text-gray-600 font-medium flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restaurar
                    </button>

                    <button
                      type="button"
                      onClick={baixarStory}
                      disabled={
                        gerandoStory ||
                        horariosEscolhidosStory.length ===
                          0
                      }
                      className="flex-[2] rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] disabled:opacity-50 text-white py-3.5 font-medium flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />

                      {gerandoStory
                        ? 'Gerando...'
                        : 'Baixar imagem'}
                    </button>
                  </div>
                </div>

                {/* PREVIEW */}
                <div className="bg-white rounded-3xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        Pré-visualização
                      </h3>

                      <p className="text-xs text-gray-500 mt-1">
                        Formato vertical 9:16
                      </p>
                    </div>

                    <div className="text-xs text-gray-400">
                      {horariosEscolhidosStory.length}{' '}
                      selecionado(s)
                    </div>
                  </div>

                  <div className="min-h-[520px] bg-gray-100 rounded-3xl flex items-center justify-center p-5 overflow-auto">
                    {renderStory()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}