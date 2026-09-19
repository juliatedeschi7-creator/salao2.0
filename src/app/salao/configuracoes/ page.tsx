'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Bell, Link, Copy, Check, LogOut, Palette,
  Smartphone, ChevronRight, UserCheck, Edit3, Save,
  X, FileText, MessageSquare, Clock, Plus, Trash2, Eye
} from 'lucide-react'

import {
  registrarPush,
  verificarPushAtivo,
  obterUltimoErroPush
} from '@/lib/push-client'

const MODULOS = [
  { key: 'agendamentos', label: 'Agendamentos', desc: 'Cliente pode ver e criar agendamentos' },
  { key: 'pacotes', label: 'Pacotes', desc: 'Cliente pode ver seus pacotes contratados' },
  { key: 'anamnese', label: 'Questionários', desc: 'Cliente pode preencher questionários de saúde' },
  { key: 'avaliacoes', label: 'Avaliações', desc: 'Cliente pode deixar avaliações' },
  { key: 'combos', label: 'Combos', desc: 'Cliente pode ver combos promocionais' },
]

export default function ConfiguracoesPage() {

  const { profile, loading, signOut } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  // Informações
  const [editandoInfo, setEditandoInfo] = useState(false)
  const [formInfo, setFormInfo] = useState({
    nome: '',
    telefone: '',
    instagram: '',
    cidade: '',
    descricao: ''
  })
  const [salvandoInfo, setSalvandoInfo] = useState(false)
  const [infoSalva, setInfoSalva] = useState(false)
  const [erroInfo, setErroInfo] = useState('')

  // Cores
  const [salvandoCor, setSalvandoCor] = useState(false)
  const [corSelecionada, setCorSelecionada] = useState('#E91E8C')

  // Aprovação Automática
  const [aprovacaoAutomatica, setAprovacaoAutomatica] = useState(false)
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false)

  // Módulos do Cliente
  const [modulos, setModulos] = useState<Record<string, boolean>>({
    agendamentos: true,
    pacotes: true,
    anamnese: true,
    avaliacoes: true,
    combos: true,
  })
  const [salvandoModulos, setSalvandoModulos] = useState(false)
  const [modulosSalvos, setModulosSalvos] = useState(false)

  // Aviso de Serviços
  const [avisoServicos, setAvisoServicos] = useState('')
  const [salvandoAviso, setSalvandoAviso] = useState(false)

  // Mensagens do WhatsApp
  const [mensagemConfirmacao, setMensagemConfirmacao] = useState('')
  const [mensagemSugestao, setMensagemSugestao] = useState('')
  const [mensagemIndisponivel, setMensagemIndisponivel] = useState('')
  const [salvandoMensagens, setSalvandoMensagens] = useState(false)
  const [mensagensSalvas, setMensagensSalvas] = useState(false)

  // Push Notifications
  const [pushAtivo, setPushAtivo] = useState(false)
  const [ativandoPush, setAtivandoPush] = useState(false)
  const [testandoPush, setTestandoPush] = useState(false)
  const [resultadoPush, setResultadoPush] = useState<{
    ok: boolean
    msg: string
  } | null>(null)

  // Lembretes automáticos de agendamento
  type LembreteAgendamentoConfig = {
    id?: string
    salao_id?: string
    antecedencia_minutos: number
    ativo: boolean
    titulo: string
    mensagem: string
    ordem: number
  }

  const [lembretesAgendamento, setLembretesAgendamento] = useState<LembreteAgendamentoConfig[]>([])
  const [carregandoLembretes, setCarregandoLembretes] = useState(false)
  const [salvandoLembretes, setSalvandoLembretes] = useState(false)
  const [lembretesSalvos, setLembretesSalvos] = useState(false)
  const [erroLembretes, setErroLembretes] = useState('')
  const [previewLembrete, setPreviewLembrete] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {

    const { data: sal } = await supabase
      .from('saloes')
      .select('*')
      .eq('id', profile!.salao_id!)
      .single()

    setSalao(sal)

    setAvisoServicos(sal?.aviso_servicos || '')

    const corAtual = sal?.cor_primaria || '#E91E8C'

    setCorSelecionada(corAtual)

    setAprovacaoAutomatica(
      sal?.aprovacao_automatica_clientes === true
    )

    setMensagemConfirmacao(
      sal?.mensagem_confirmacao || ''
    )

    setMensagemSugestao(
      sal?.mensagem_sugestao || ''
    )

    setMensagemIndisponivel(
      sal?.mensagem_indisponivel || ''
    )

    if (sal?.modulos_cliente) {
      setModulos(prev => ({
        ...prev,
        ...sal.modulos_cliente
      }))
    }

    setFormInfo({
      nome: sal?.nome || '',
      telefone: sal?.telefone || '',
      instagram: sal?.instagram || '',
      cidade: sal?.cidade || '',
      descricao: sal?.descricao || '',
    })

    if (profile?.id) {

      const ativo = await verificarPushAtivo(
        profile.id
      )

      setPushAtivo(ativo)
    }
    if (profile?.salao_id) {
      await carregarLembretesAgendamento()
    }
  }

  async function carregarLembretesAgendamento() {
    if (!profile?.salao_id) return

    setCarregandoLembretes(true)
    setErroLembretes('')

    const { data, error } = await supabase
      .from('lembretes_agendamento_config')
      .select('*')
      .eq('salao_id', profile.salao_id)
      .order('ordem', { ascending: true })

    if (error) {
      setErroLembretes('Não foi possível carregar os lembretes.')
      console.error('Erro ao carregar lembretes de agendamento:', error)
      setCarregandoLembretes(false)
      return
    }

    setLembretesAgendamento(
      (data || []).map((item: any) => ({
        id: item.id,
        salao_id: item.salao_id,
        antecedencia_minutos: Number(item.antecedencia_minutos),
        ativo: item.ativo !== false,
        titulo: item.titulo || 'Lembrete de agendamento',
        mensagem: item.mensagem || '',
        ordem: Number(item.ordem || 0),
      }))
    )

    setCarregandoLembretes(false)
  }

  function adicionarLembreteAgendamento() {
    const novo: LembreteAgendamentoConfig = {
      antecedencia_minutos: 120,
      ativo: true,
      titulo: 'Lembrete de agendamento',
      mensagem:
        'Olá, {cliente}! Este é um lembrete do seu agendamento no {salao}, {data} às {hora}.',
      ordem: lembretesAgendamento.length,
    }

    setLembretesAgendamento(prev => [...prev, novo])
  }

  function atualizarLembreteAgendamento(
    index: number,
    campo: keyof LembreteAgendamentoConfig,
    valor: string | number | boolean
  ) {
    setLembretesAgendamento(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [campo]: valor }
          : item
      )
    )
  }

  function removerLembreteAgendamento(index: number) {
    setLembretesAgendamento(prev =>
      prev
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, ordem: i }))
    )
  }

  function formatarAntecedencia(minutos: number) {
    if (minutos < 60) return `${minutos} min antes`
    if (minutos % 1440 === 0) {
      const dias = minutos / 1440
      return `${dias} ${dias === 1 ? 'dia' : 'dias'} antes`
    }
    if (minutos % 60 === 0) {
      const horas = minutos / 60
      return `${horas} ${horas === 1 ? 'hora' : 'horas'} antes`
    }

    const horas = Math.floor(minutos / 60)
    const resto = minutos % 60
    return `${horas}h${resto.toString().padStart(2, '0')} antes`
  }

  function obterUnidadeAntecedencia(minutos: number) {
    if (minutos > 0 && minutos % 1440 === 0) return 'dias'
    if (minutos > 0 && minutos % 60 === 0) return 'horas'
    return 'minutos'
  }

  function obterValorAntecedencia(minutos: number, unidade: string) {
    if (unidade === 'dias') return Math.max(1, Math.round(minutos / 1440))
    if (unidade === 'horas') return Math.max(1, Math.round(minutos / 60))
    return Math.max(1, Math.round(minutos))
  }

  function converterParaMinutos(valor: number, unidade: string) {
    if (unidade === 'dias') return valor * 1440
    if (unidade === 'horas') return valor * 60
    return valor
  }

  function renderizarPreviewLembrete(mensagem: string) {
    return mensagem
      .replace(/\{cliente\}/gi, 'Maria')
      .replace(/\{salao\}/gi, salao?.nome || 'Seu salão')
      .replace(/\{data\}/gi, '18/09/2026')
      .replace(/\{hora\}/gi, '14:30')
      .replace(/\{servico\}/gi, 'Manicure')
  }

  async function salvarLembretesAgendamento() {
    if (!profile?.salao_id) return

    setSalvandoLembretes(true)
    setErroLembretes('')

    const invalidos = lembretesAgendamento.some(item =>
      !Number.isFinite(Number(item.antecedencia_minutos)) ||
      Number(item.antecedencia_minutos) <= 0 ||
      !item.titulo.trim() ||
      !item.mensagem.trim()
    )

    if (invalidos) {
      setErroLembretes(
        'Preencha a antecedência, o título e a mensagem de todos os lembretes.'
      )
      setSalvandoLembretes(false)
      return
    }

    try {
      const { data: atuais, error: erroAtuais } = await supabase
        .from('lembretes_agendamento_config')
        .select('id')
        .eq('salao_id', profile.salao_id)

      if (erroAtuais) throw erroAtuais

      const idsAtuais = (atuais || []).map((item: any) => item.id)
      const idsMantidos = lembretesAgendamento
        .map(item => item.id)
        .filter(Boolean) as string[]

      const idsRemover = idsAtuais.filter(id => !idsMantidos.includes(id))

      if (idsRemover.length > 0) {
        const { error } = await supabase
          .from('lembretes_agendamento_config')
          .delete()
          .in('id', idsRemover)

        if (error) throw error
      }

      for (let i = 0; i < lembretesAgendamento.length; i++) {
        const item = lembretesAgendamento[i]

        const dados = {
          salao_id: profile.salao_id,
          antecedencia_minutos: Number(item.antecedencia_minutos),
          ativo: item.ativo,
          titulo: item.titulo.trim(),
          mensagem: item.mensagem.trim(),
          ordem: i,
          updated_at: new Date().toISOString(),
        }

        if (item.id) {
          const { error } = await supabase
            .from('lembretes_agendamento_config')
            .update(dados)
            .eq('id', item.id)
            .eq('salao_id', profile.salao_id)

          if (error) throw error
        } else {
          const { error } = await supabase
            .from('lembretes_agendamento_config')
            .insert(dados)

          if (error) throw error
        }
      }

      await carregarLembretesAgendamento()
      setLembretesSalvos(true)

      setTimeout(() => setLembretesSalvos(false), 2500)
    } catch (error: any) {
      console.error('Erro ao salvar lembretes de agendamento:', error)
      setErroLembretes(
        error?.message || 'Não foi possível salvar os lembretes.'
      )
    } finally {
      setSalvandoLembretes(false)
    }
  }

  async function salvarInfo() {

    if (!formInfo.nome.trim()) {
      setErroInfo('O nome do salão é obrigatório.')
      return
    }

    setSalvandoInfo(true)
    setErroInfo('')

    const { error } = await supabase
      .from('saloes')
      .update({
        nome: formInfo.nome.trim(),
        telefone: formInfo.telefone.trim(),
        instagram: formInfo.instagram.trim(),
        cidade: formInfo.cidade.trim(),
        descricao: formInfo.descricao.trim(),
      })
      .eq('id', profile!.salao_id!)

    if (error) {

      setErroInfo(
        'Erro: ' + error.message
      )

    } else {

      setEditandoInfo(false)
      setInfoSalva(true)

      carregarDados()

      setTimeout(
        () => setInfoSalva(false),
        3000
      )
    }

    setSalvandoInfo(false)
  }

  async function salvarAviso() {

    setSalvandoAviso(true)

    await supabase
      .from('saloes')
      .update({
        aviso_servicos: avisoServicos
      })
      .eq('id', profile!.salao_id!)

    setSalvandoAviso(false)
  }

  async function salvarMensagens() {

    setSalvandoMensagens(true)

    await supabase
      .from('saloes')
      .update({
        mensagem_confirmacao: mensagemConfirmacao,
        mensagem_sugestao: mensagemSugestao,
        mensagem_indisponivel: mensagemIndisponivel
      })
      .eq('id', profile!.salao_id!)

    setSalvandoMensagens(false)

    setMensagensSalvas(true)

    setTimeout(
      () => setMensagensSalvas(false),
      2500
    )
  }

  async function salvarModulos() {

    setSalvandoModulos(true)

    await supabase
      .from('saloes')
      .update({
        modulos_cliente: modulos
      })
      .eq('id', profile!.salao_id!)

    setSalvandoModulos(false)

    setModulosSalvos(true)

    setTimeout(
      () => setModulosSalvos(false),
      2500
    )
  }

  async function toggleAprovacaoAutomatica() {

    const novoValor = !aprovacaoAutomatica

    setSalvandoAprovacao(true)

    const { error } = await supabase
      .from('saloes')
      .update({
        aprovacao_automatica_clientes: novoValor
      })
      .eq('id', profile!.salao_id!)

    if (!error) {
      setAprovacaoAutomatica(novoValor)
    }

    setSalvandoAprovacao(false)
  }

  async function salvarCor() {

    setSalvandoCor(true)

    await supabase
      .from('saloes')
      .update({
        cor_primaria: corSelecionada,
        cor_secundaria: corSelecionada + '18'
      })
      .eq('id', profile!.salao_id!)

    setSalvandoCor(false)

    carregarDados()
  }

  // =========================================================
  // ATIVAR PUSH
  // =========================================================

  async function ativarPush() {

    setAtivandoPush(true)

    setResultadoPush(null)

    const ok = await registrarPush(
      profile!.id
    )

    setPushAtivo(ok)

    setAtivandoPush(false)

    if (ok) {

      setResultadoPush({
        ok: true,
        msg: 'Push ativado! Agora clique em testar.'
      })

    } else {

      const erro =
        obterUltimoErroPush()

      setResultadoPush({
        ok: false,
        msg: erro ||
          'Não foi possível ativar. Verifique as permissões do seu navegador.'
      })
    }

    setTimeout(
      () => setResultadoPush(null),
      10000
    )
  }

  // =========================================================
  // TESTAR PUSH
  // =========================================================

  async function testarPush() {

    setTestandoPush(true)

    setResultadoPush(null)

    try {

      const controller =
        new AbortController()

      const timeout =
        setTimeout(
          () => controller.abort(),
          15000
        )

      const res =
        await fetch(
          '/api/push/test/',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              profileId:
                profile!.id
            }),
            signal: controller.signal
          }
        )

      clearTimeout(timeout)

      const json =
        await res.json()

      setResultadoPush({
        ok: json.ok,
        msg: json.ok
          ? '✓ Push enviado! Aguarde a notificação.'
          : '✗ Erro: ' +
            (
              json.erro ||
              JSON.stringify(json)
            )
      })

    } catch (err: any) {

      if (err.name === 'AbortError') {

        setResultadoPush({
          ok: false,
          msg:
            'Timeout — servidor demorou a responder.'
        })

      } else {

        setResultadoPush({
          ok: false,
          msg:
            'Erro de conexão: ' +
            err.message
        })
      }
    }

    setTestandoPush(false)
  }

  function copiarTexto(
    texto: string,
    id: string
  ) {

    navigator.clipboard.writeText(texto)

    setCopiado(id)

    setTimeout(
      () => setCopiado(null),
      2000
    )
  }

  const cor =
    salao?.cor_primaria ||
    '#E91E8C'

  const origem =
    typeof window !== 'undefined'
      ? window.location.origin
      : ''

  return (

    <div className="min-h-screen bg-[#f8f9fa] pb-12">

      {/* Header */}

      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">

        <button
          onClick={() => router.back()}
        >
          <ArrowLeft
            size={22}
            className="text-gray-700"
          />
        </button>

        <h1 className="font-bold text-gray-900 text-lg">
          Configurações Gerais
        </h1>

      </div>

      <div className="px-4 py-4 flex flex-col gap-4 max-w-2xl mx-auto">

        {/* 1. Informações do Salão */}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">

          <div className="flex items-center justify-between">

            <p className="font-bold text-gray-900">
              Informações do Salão
            </p>

            {!editandoInfo ? (

              <button
                onClick={() =>
                  setEditandoInfo(true)
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium transition-transform active:scale-95"
                style={{
                  backgroundColor: cor
                }}
              >
                <Edit3 size={13} />
                Editar
              </button>

            ) : (

              <button
                onClick={() => {
                  setEditandoInfo(false)

                  setFormInfo({
                    nome:
                      salao?.nome || '',
                    telefone:
                      salao?.telefone || '',
                    instagram:
                      salao?.instagram || '',
                    cidade:
                      salao?.cidade || '',
                    descricao:
                      salao?.descricao || ''
                  })
                }}
                className="flex items-center gap-1 text-gray-400 text-sm"
              >
                <X size={16} />
                Cancelar
              </button>

            )}

          </div>

          {infoSalva && (

            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2">

              <p className="text-green-600 text-xs font-semibold text-center">
                ✓ Informações atualizadas com sucesso!
              </p>

            </div>

          )}

          {!editandoInfo ? (

            <div className="flex flex-col gap-2">

              {[
                {
                  label: 'Nome',
                  value: salao?.nome
                },
                {
                  label: 'Cidade',
                  value: salao?.cidade
                },
                {
                  label: 'Telefone',
                  value: salao?.telefone
                },
                {
                  label: 'Instagram',
                  value: salao?.instagram
                },
                {
                  label: 'Descrição',
                  value: salao?.descricao
                },
              ].map(
                ({
                  label,
                  value
                }) => value ? (

                  <div
                    key={label}
                    className="flex justify-between text-sm gap-2"
                  >

                    <span className="text-gray-400 shrink-0">
                      {label}
                    </span>

                    <span className="font-medium text-gray-900 text-right truncate">
                      {value}
                    </span>

                  </div>

                ) : null
              )}

            </div>

          ) : (

            <div className="flex flex-col gap-3">

              <div>

                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  Nome do salão
                </label>

                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  value={formInfo.nome}
                  onChange={e =>
                    setFormInfo(p => ({
                      ...p,
                      nome: e.target.value
                    }))
                  }
                  placeholder="Ex: Espaço de Beleza"
                />

              </div>

              <div>

                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  Telefone / WhatsApp
                </label>

                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  value={formInfo.telefone}
                  onChange={e =>
                    setFormInfo(p => ({
                      ...p,
                      telefone: e.target.value
                    }))
                  }
                  placeholder="Ex: 11999999999"
                />

              </div>

              <div>

                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  Instagram
                </label>

                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  value={formInfo.instagram}
                  onChange={e =>
                    setFormInfo(p => ({
                      ...p,
                      instagram: e.target.value
                    }))
                  }
                  placeholder="Ex: @salao"
                />

              </div>

              <div>

                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  Cidade
                </label>

                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  value={formInfo.cidade}
                  onChange={e =>
                    setFormInfo(p => ({
                      ...p,
                      cidade: e.target.value
                    }))
                  }
                  placeholder="Ex: São Paulo - SP"
                />

              </div>

              <div>

                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  Descrição curta
                </label>

                <textarea
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none"
                  rows={2}
                  value={formInfo.descricao}
                  onChange={e =>
                    setFormInfo(p => ({
                      ...p,
                      descricao: e.target.value
                    }))
                  }
                />

              </div>

              {erroInfo && (
                <p className="text-red-600 text-xs">
                  {erroInfo}
                </p>
              )}

              <button
                onClick={salvarInfo}
                disabled={salvandoInfo}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
                style={{
                  backgroundColor: cor
                }}
              >
                <Save size={16} />
                {salvandoInfo
                  ? 'Salvando...'
                  : 'Salvar Informações'}
              </button>

            </div>

          )}

        </div>

        {/* 2. Cor do Tema do Salão */}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">

          <p className="font-bold text-gray-900 flex items-center gap-2">
            <Palette size={18} />
            Cor do Tema do Salão
          </p>

          <p className="text-xs text-gray-400">
            Escolha qualquer cor usando o seletor ou insira o código hexadecimal:
          </p>

          <div className="flex items-center gap-3">

            <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-inner border-2 border-gray-200 shrink-0">

              <input
                type="color"
                value={corSelecionada}
                onChange={e =>
                  setCorSelecionada(e.target.value)
                }
                className="absolute -top-2 -left-2 w-20 h-20 cursor-pointer border-0 p-0"
              />

            </div>

            <div className="flex-1 flex flex-col gap-1">

              <span className="text-xs font-semibold text-gray-700">
                Código da Cor (Hex)
              </span>

              <input
                type="text"
                value={corSelecionada}
                onChange={e =>
                  setCorSelecionada(e.target.value)
                }
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono uppercase"
                maxLength={7}
              />

            </div>

          </div>

          {corSelecionada !== salao?.cor_primaria && (

            <button
              onClick={salvarCor}
              disabled={salvandoCor}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-1 shadow-sm transition-transform active:scale-95"
              style={{
                backgroundColor:
                  corSelecionada
              }}
            >
              {salvandoCor
                ? 'Salvando...'
                : 'Aplicar Nova Cor'}
            </button>

          )}

        </div>

        {/* 3. Modelos de Mensagens para WhatsApp */}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">

          <p className="font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare size={18} />
            Modelos de Mensagens (WhatsApp)
          </p>

          <p className="text-xs text-gray-400">
            Personalize os textos que serão enviados para os clientes. Você pode usar tags como{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">
              &#123;cliente&#125;
            </code>
            ,{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">
              &#123;servico&#125;
            </code>
            ,{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">
              &#123;data&#125;
            </code>
            {' '}e{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">
              &#123;hora&#125;
            </code>
            .
          </p>

          <div className="flex flex-col gap-3 mt-1">

            <div>

              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Confirmação de Agendamento
              </label>

              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none"
                rows={3}
                placeholder="Olá &#123;cliente&#125;, passando para confirmar o seu agendamento..."
                value={mensagemConfirmacao}
                onChange={e =>
                  setMensagemConfirmacao(
                    e.target.value
                  )
                }
              />

            </div>

            <div>

              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Sugestão de Horários
              </label>

              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none"
                rows={3}
                placeholder="Olá &#123;cliente&#125;, esse horário não está disponível, mas temos..."
                value={mensagemSugestao}
                onChange={e =>
                  setMensagemSugestao(
                    e.target.value
                  )
                }
              />

            </div>

            <div>

              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Horário Indisponível / Aviso de Indisponibilidade
              </label>

              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none"
                rows={3}
                placeholder="Olá &#123;cliente&#125;, infelizmente esse horário não está mais disponível..."
                value={mensagemIndisponivel}
                onChange={e =>
                  setMensagemIndisponivel(
                    e.target.value
                  )
                }
              />

            </div>

          </div>

          <button
            onClick={salvarMensagens}
            disabled={salvandoMensagens}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-1"
            style={{
              backgroundColor: cor
            }}
          >
            {mensagensSalvas
              ? '✓ Mensagens Salvas!'
              : salvandoMensagens
                ? 'Salvando...'
                : 'Salvar Modelos de Mensagens'}
          </button>

        </div>

        {/* 4. Aparência do App do Cliente */}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">

          <div>

            <p className="font-bold text-gray-900 flex items-center gap-2">
              <Smartphone size={18} />
              Módulos Visíveis no App do Cliente
            </p>

            <p className="text-xs text-gray-400 mt-0.5">
              Escolha o que os clientes podem visualizar
            </p>

          </div>

          {MODULOS.map(m => (

            <div
              key={m.key}
              className="flex items-center justify-between"
            >

              <div className="flex-1 pr-4">

                <p className="text-sm font-medium text-gray-800">
                  {m.label}
                </p>

                <p className="text-xs text-gray-400">
                  {m.desc}
                </p>

              </div>

              <button
                onClick={() =>
                  setModulos(prev => ({
                    ...prev,
                    [m.key]:
                      !prev[m.key]
                  }))
                }
                className="relative w-12 h-6 rounded-full transition-colors shrink-0"
                style={{
                  backgroundColor:
                    modulos[m.key]
                      ? cor
                      : '#d1d5db'
                }}
              >

                <div
                  className={
                    'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' +
                    (
                      modulos[m.key]
                        ? 'left-6'
                        : 'left-0.5'
                    )
                  }
                />

              </button>

            </div>

          ))}

          <button
            onClick={salvarModulos}
            disabled={salvandoModulos}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm"
            style={{
              backgroundColor: cor
            }}
          >
            {modulosSalvos
              ? '✓ Salvo!'
              : salvandoModulos
                ? 'Salvando...'
                : 'Salvar Módulos'}
          </button>

        </div>

        {/* 5. Aprovação de Clientes */}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">

          <div className="flex items-center gap-2">

            <UserCheck
              size={18}
              className="text-gray-700"
            />

            <p className="font-bold text-gray-900">
              Aprovação de Novas Clientes
            </p>

          </div>

          <div className="flex items-center justify-between">

            <div className="flex-1 pr-4">

              <p className="text-sm font-medium text-gray-800">
                Aprovar automaticamente
              </p>

              <p className="text-xs text-gray-400 mt-0.5">
                {aprovacaoAutomatica
                  ? 'Clientes entram direto ao se cadastrar.'
                  : 'Você aprova manualmente cada nova cliente.'}
              </p>

            </div>

            <button
              onClick={toggleAprovacaoAutomatica}
              disabled={salvandoAprovacao}
              className={`relative w-12 h-6 rounded-full transition-all shrink-0 ${
                salvandoAprovacao
                  ? 'opacity-60'
                  : ''
              }`}
              style={{
                backgroundColor:
                  aprovacaoAutomatica
                    ? cor
                    : '#d1d5db'
              }}
            >

              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  aprovacaoAutomatica
                    ? 'left-6'
                    : 'left-0.5'
                }`}
              />

            </button>

          </div>

        </div>

        {/* 6. Aviso em Serviços */}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">

          <p className="font-bold text-gray-900 flex items-center gap-2">
            <FileText size={18} />
            Aviso na Página de Serviços
          </p>

          <textarea
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs resize-none"
            rows={4}
            placeholder="Ex: Os tempos exibidos são estimativas..."
            value={avisoServicos}
            onChange={e =>
              setAvisoServicos(
                e.target.value
              )
            }
          />

          <button
            onClick={salvarAviso}
            disabled={salvandoAviso}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm"
            style={{
              backgroundColor: cor
            }}
          >
            {salvandoAviso
              ? 'Salvando...'
              : 'Salvar Aviso'}
          </button>

        </div>

        {/* 7. Links de Clientes */}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">

          <p className="font-bold text-gray-900 flex items-center gap-2">
            <Link size={18} />
            Links de Acesso para Clientes
          </p>

          <div className="flex flex-col gap-3">

            <div>

              <p className="text-xs text-gray-500 font-semibold mb-1">
                Link de Cadastro
              </p>

              <button
                onClick={() =>
                  copiarTexto(
                    `${origem}/cadastro?salao=${salao?.slug}`,
                    'cadastro'
                  )
                }
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-semibold w-full"
                style={{
                  backgroundColor: cor
                }}
              >

                {copiado === 'cadastro'
                  ? (
                    <>
                      <Check size={16} />
                      Copiado!
                    </>
                  )
                  : (
                    <>
                      <Copy size={16} />
                      Copiar Link de Cadastro
                    </>
                  )}

              </button>

            </div>

            <div>

              <p className="text-xs text-gray-500 font-semibold mb-1">
                Link de Login
              </p>

              <button
                onClick={() =>
                  copiarTexto(
                    `${origem}/login?salao=${salao?.slug}`,
                    'login'
                  )
                }
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold w-full"
                style={{
                  borderColor: cor,
                  color: cor
                }}
              >

                {copiado === 'login'
                  ? (
                    <>
                      <Check size={16} />
                      Copiado!
                    </>
                  )
                  : (
                    <>
                      <Copy size={16} />
                      Copiar Link de Entrar
                    </>
                  )}

              </button>

            </div>

          </div>

        </div>


        {/* 8. Lembretes Automáticos de Agendamento */}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-gray-900 flex items-center gap-2">
                <Clock size={18} />
                Lembretes Automáticos de Agendamento
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Envie lembretes automaticamente antes do horário marcado.
                Você pode configurar mais de um lembrete para o mesmo agendamento.
              </p>
            </div>
            <button
              onClick={adicionarLembreteAgendamento}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold"
              style={{ backgroundColor: cor }}
            >
              <Plus size={15} />
              Adicionar
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-700 mb-1">
              Como funciona
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Cada regra ativa será aplicada aos agendamentos elegíveis.
              Você pode criar quantos lembretes quiser e definir uma antecedência
              diferente para cada um. Por exemplo: 24 horas antes, 2 horas antes
              e 30 minutos antes do atendimento.
            </p>
          </div>

          {erroLembretes && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <p className="text-xs font-semibold text-red-600">
                {erroLembretes}
              </p>
            </div>
          )}

          {carregandoLembretes ? (
            <div className="py-6 text-center text-xs text-gray-400">
              Carregando lembretes...
            </div>
          ) : lembretesAgendamento.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-xl p-5 text-center">
              <Bell size={22} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-600">
                Nenhum lembrete configurado
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Adicione o primeiro lembrete e escolha a antecedência que quiser.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {lembretesAgendamento.map((item, index) => (
                <div
                  key={item.id || `novo-${index}`}
                  className="border border-gray-200 rounded-2xl p-3 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: cor + '18',
                          color: cor
                        }}
                      >
                        <Bell size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          Lembrete {index + 1}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {formatarAntecedencia(
                            Number(item.antecedencia_minutos)
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewLembrete(
                            previewLembrete === (item.id || `novo-${index}`)
                              ? null
                              : (item.id || `novo-${index}`)
                          )
                        }
                        className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500"
                        title="Visualizar exemplo"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => removerLembreteAgendamento(index)}
                        className="w-9 h-9 rounded-xl border border-red-100 flex items-center justify-center text-red-400"
                        title="Excluir lembrete"
                      >
                        <Trash2 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          atualizarLembreteAgendamento(
                            index,
                            'ativo',
                            !item.ativo
                          )
                        }
                        className="relative w-12 h-6 rounded-full transition-colors shrink-0"
                        style={{
                          backgroundColor: item.ativo ? cor : '#d1d5db'
                        }}
                        aria-label={
                          item.ativo
                            ? 'Desativar lembrete'
                            : 'Ativar lembrete'
                        }
                      >
                        <div
                          className={
                            'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ' +
                            (item.ativo ? 'left-6' : 'left-0.5')
                          }
                        />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Antecedência do lembrete
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={obterValorAntecedencia(
                          Number(item.antecedencia_minutos) || 1,
                          obterUnidadeAntecedencia(
                            Number(item.antecedencia_minutos) || 1
                          )
                        )}
                        onChange={e => {
                          const unidade = obterUnidadeAntecedencia(
                            Number(item.antecedencia_minutos) || 1
                          )
                          const valor = Math.max(
                            1,
                            Number(e.target.value) || 1
                          )

                          atualizarLembreteAgendamento(
                            index,
                            'antecedencia_minutos',
                            converterParaMinutos(valor, unidade)
                          )
                        }}
                        className="flex-1 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      />

                      <select
                        value={obterUnidadeAntecedencia(
                          Number(item.antecedencia_minutos) || 1
                        )}
                        onChange={e => {
                          const novaUnidade = e.target.value
                          const minutosAtuais =
                            Number(item.antecedencia_minutos) || 1
                          const valorAtual = obterValorAntecedencia(
                            minutosAtuais,
                            novaUnidade
                          )

                          atualizarLembreteAgendamento(
                            index,
                            'antecedencia_minutos',
                            converterParaMinutos(
                              valorAtual,
                              novaUnidade
                            )
                          )
                        }}
                        className="flex-1 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      >
                        <option value="minutos">minutos antes</option>
                        <option value="horas">horas antes</option>
                        <option value="dias">dias antes</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Você pode escolher qualquer quantidade. Ex.: 30 minutos, 2 horas, 5 horas ou 3 dias.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Título da notificação
                    </label>
                    <input
                      type="text"
                      value={item.titulo}
                      onChange={e =>
                        atualizarLembreteAgendamento(
                          index,
                          'titulo',
                          e.target.value
                        )
                      }
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      placeholder="Lembrete de agendamento"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Mensagem
                    </label>
                    <textarea
                      rows={4}
                      value={item.mensagem}
                      onChange={e =>
                        atualizarLembreteAgendamento(
                          index,
                          'mensagem',
                          e.target.value
                        )
                      }
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none"
                      placeholder="Olá {cliente}! Este é um lembrete..."
                    />
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-gray-600 mb-2">
                      Variáveis disponíveis
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        '{cliente}',
                        '{salao}',
                        '{data}',
                        '{hora}',
                        '{servico}'
                      ].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const novoTexto =
                              item.mensagem + (item.mensagem ? ' ' : '') + tag
                            atualizarLembreteAgendamento(
                              index,
                              'mensagem',
                              novoTexto
                            )
                          }}
                          className="bg-white border border-gray-200 px-2 py-1 rounded-lg text-[11px] font-mono text-gray-600"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Toque em uma variável para adicioná-la ao final da mensagem.
                    </p>
                  </div>

                  {previewLembrete === (item.id || `novo-${index}`) && (
                    <div
                      className="rounded-2xl p-3 border"
                      style={{
                        backgroundColor: cor + '0D',
                        borderColor: cor + '30'
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Bell size={15} style={{ color: cor }} />
                        <p className="text-xs font-bold text-gray-700">
                          Prévia da notificação
                        </p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        {renderizarPreviewLembrete(item.titulo)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {renderizarPreviewLembrete(item.mensagem)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {lembretesAgendamento.length > 0 && (
            <button
              onClick={salvarLembretesAgendamento}
              disabled={salvandoLembretes}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm"
              style={{ backgroundColor: cor }}
            >
              {lembretesSalvos
                ? '✓ Lembretes Salvos!'
                : salvandoLembretes
                  ? 'Salvando...'
                  : 'Salvar Lembretes'}
            </button>
          )}

          <p className="text-[10px] text-gray-400 leading-relaxed">
            Desativar uma regra impede novos envios dessa regra. O histórico
            dos envios permanece separado para acompanhamento.
          </p>

        </div>

        {/* 8. Notificações Push */}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">

          <p className="font-bold text-gray-900 flex items-center gap-2">
            <Bell size={18} />
            Notificações Push
          </p>

          {resultadoPush && (

            <div
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                resultadoPush.ok
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {resultadoPush.msg}
            </div>

          )}

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold text-gray-800">
                Status neste dispositivo
              </p>

              <p
                className={`text-xs mt-0.5 font-bold ${
                  pushAtivo
                    ? 'text-emerald-600'
                    : 'text-gray-400'
                }`}
              >
                {pushAtivo
                  ? '● Ativo'
                  : '○ Não ativado'}
              </p>

            </div>

            {!pushAtivo ? (

              <button
                onClick={ativarPush}
                disabled={ativandoPush}
                className="px-4 py-2 rounded-xl text-white text-xs font-bold"
                style={{
                  backgroundColor: cor
                }}
              >
                {ativandoPush
                  ? 'Ativando...'
                  : 'Ativar Push'}
              </button>

            ) : (

              <button
                onClick={testarPush}
                disabled={testandoPush}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                style={{
                  borderColor: cor,
                  color: cor
                }}
              >
                {testandoPush
                  ? 'Enviando...'
                  : 'Testar'}
              </button>

            )}

          </div>

        </div>

        {/* Botão Sair */}

        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 text-gray-400 text-sm py-4 hover:text-red-500 transition-colors"
        >
          <LogOut size={16} />
          Sair da conta
        </button>

      </div>

    </div>
  )
}
