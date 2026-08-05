// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Bell, Calendar, Check, X, Clock, Trash2, RotateCcw, MessageCircle, Share2, Bookmark } from 'lucide-react'

// ─── Tipos ──────────────────────────────────────────────────────────────────
type PacoteOpcao = {
  clientePacoteId: string
  nome: string
  sessoesRestantes: number
}

type CoberturaServico = {
  servicoId: string
  servicoNome: string
  sessoesEquivalentes: number
  clientePacoteIdSelecionado: string | null
  pacotesDisponiveis: PacoteOpcao[]
}

type ServicoCatalogo = {
  id: string
  nome: string
  preco: number
  categoria_id?: string
  categoria?: { nome: string }
}

export default function NotificacoesDonoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [aba, setAba] = useState<'pedidos' | 'confirmacoes' | 'avisos' | 'excluidas' | 'catalogo'>('pedidos')
  
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [confirmacoes, setConfirmacoes] = useState<any[]>([])
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [notificacoesExcluidas, setNotificacoesExcluidas] = useState<any[]>([])
  
  const [modalSugestao, setModalSugestao] = useState<any>(null)
  const [modalConfirmar, setModalConfirmar] = useState<any>(null)
  const [horariosLivres, setHorariosLivres] = useState(['', '', ''])
  const [servicoRealizado, setServicoRealizado] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [coberturas, setCoberturas] = useState<CoberturaServico[]>([])
  const [carregandoCoberturas, setCarregandoCoberturas] = useState(false)

  // Estados para Disparo do Catálogo com Preview e Seleção Granular
  const [categoriasLista, setCategoriasLista] = useState<any[]>([])
  const [servicosLista, setServicosLista] = useState<ServicoCatalogo[]>([])
  const [servicosSelecionadosIds, setServicosSelecionadosIds] = useState<string[]>([])
  
  // Modal e Template de Preview do WhatsApp
  const [modalPreviewOpen, setModalPreviewOpen] = useState(false)
  const [templateMensagem, setTemplateMensagem] = useState(
    'Olá, tudo bem? 💖 Passando para lembrar dos nossos serviços e valores:\n\n{itens}\n\nAgende já o seu horário! ✨'
  )
  const [telefoneDestinoWp, setTelefoneDestinoWp] = useState('')

  useEffect(() => {
    if (loading) return
    if (!profile) {
      router.push('/login')
      return
    }
    if (profile.salao_id) {
      carregarDados()
      carregarCatalogoServicos()
      registrarPushNotification()
    }
  }, [loading, profile])

  async function registrarPushNotification() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })
        await supabase.from('push_subscriptions').upsert({
          user_id: profile?.id,
          salao_id: profile?.salao_id,
          subscription: subscription.toJSON()
        }, { onConflict: 'user_id' })
      } catch (err) {
        console.error('Erro ao registrar push:', err)
      }
    }
  }

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    if (sal?.template_whatsapp_catalogo) {
      setTemplateMensagem(sal.template_whatsapp_catalogo)
    }

    const { data: sols } = await supabase.from('solicitacoes_agendamento')
      .select('*, clientes(nome, email, telefone), servicos(nome, duracao_minutos)')
      .eq('salao_id', profile!.salao_id!)
      .in('status', ['pendente', 'horario_sugerido'])
      .order('created_at', { ascending: false })
    setSolicitacoes(sols || [])

    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1)
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(nome, telefone), servicos(nome), confirmacoes_atendimento(*)')
      .eq('salao_id', profile!.salao_id!)
      .eq('status', 'confirmado')
      .gte('data_hora', ontem.toISOString())
      .lte('data_hora', new Date().toISOString())
      .order('data_hora')
    setConfirmacoes((ags || []).filter((a: any) => !a.confirmacoes_atendimento?.length))

    const { data: notifs } = await supabase.from('notificacoes')
      .select('*')
      .eq('salao_id', profile!.salao_id!)
      .eq('destinatario_id', profile!.id)
      .eq('excluida', false)
      .order('created_at', { ascending: false })
    setNotificacoes(notifs || [])

    const { data: excluidas } = await supabase.from('notificacoes')
      .select('*')
      .eq('salao_id', profile!.salao_id!)
      .eq('destinatario_id', profile!.id)
      .eq('excluida', true)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotificacoesExcluidas(excluidas || [])
  }

  async function carregarCatalogoServicos() {
    const { data: cats } = await supabase.from('categorias').select('*').eq('salao_id', profile!.salao_id!)
    setCategoriasLista(cats || [])

    const { data: srvs } = await supabase.from('servicos').select('*, categoria:categorias(nome)').eq('salao_id', profile!.salao_id!)
    setServicosLista(srvs || [])
  }

  function toggleServicoSelecao(id: string) {
    if (servicosSelecionadosIds.includes(id)) {
      setServicosSelecionadosIds(servicosSelecionadosIds.filter(i => i !== id))
    } else {
      setServicosSelecionadosIds([...servicosSelecionadosIds, id])
    }
  }

  function selecionarTodosCategoria(catId: string | null) {
    const idsDaCat = servicosLista.filter(s => (s.categoria_id === catId || (!catId && !s.categoria_id))).map(s => s.id)
    const todosJaEstao = idsDaCat.every(id => servicosSelecionadosIds.includes(id))
    if (todosJaEstao) {
      setServicosSelecionadosIds(servicosSelecionadosIds.filter(id => !idsDaCat.includes(id)))
    } else {
      const combinados = Array.from(new Set([...servicosSelecionadosIds, ...idsDaCat]))
      setServicosSelecionadosIds(combinados)
    }
  }

  function gerarTextoPreview(): string {
    const itensSelecionados = servicosLista.filter(s => servicosSelecionadosIds.includes(s.id))
    
    const agrupado: Record<string, ServicoCatalogo[]> = {}
    itensSelecionados.forEach(item => {
      const nomeCat = item.categoria?.nome || 'Outros'
      if (!agrupado[nomeCat]) agrupado[nomeCat] = []
      agrupado[nomeCat].push(item)
    })

    let blocoItens = ''
    for (const [cat, itens] of Object.entries(agrupado)) {
      blocoItens += `📌 *${cat}*\n`
      itens.forEach(i => {
        const precoFormatado = Number(i.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        blocoItens += `• ${i.nome} - ${precoFormatado}\n`
      })
      blocoItens += `\n`
    }

    return templateMensagem.replace('{itens}', blocoItens.trim())
  }

  async function salvarTemplatePadrao() {
    await supabase.from('saloes').update({ template_whatsapp_catalogo: templateMensagem }).eq('id', profile!.salao_id!)
    alert('Pré-molde salvo como seu modelo padrão com sucesso! 🚀')
  }

  function abrirPreviewWp() {
    if (servicosSelecionadosIds.length === 0) {
      alert('Selecione ao menos um serviço ou item do catálogo para enviar.')
      return
    }
    setModalPreviewOpen(true)
  }

  function dispararWhatsAppFinal() {
    const textoFinal = encodeURIComponent(gerarTextoPreview())
    const telLimpo = telefoneDestinoWp ? telefoneDestinoWp.replace(/\D/g, '') : ''
    
    if (telLimpo) {
      window.open(`https://api.whatsapp.com/send?phone=55${telLimpo}&text=${textoFinal}`, '_blank')
    } else {
      window.open(`https://api.whatsapp.com/send?text=${textoFinal}`, '_blank')
    }
    setModalPreviewOpen(false)
  }

  async function handleClicarNotificacao(n: any) {
    if (!n.lida) {
      await supabase.from('notificacoes').update({ lida: true }).eq('id', n.id)
      setNotificacoes(prev => prev.map(item => item.id === n.id ? { ...item, lida: true } : item))
    }
    if (n.url) router.push(n.url)
  }

  async function montarCoberturas(agendamento: any): Promise<CoberturaServico[]> {
    const idsServicos: string[] = Array.isArray(agendamento.servicos_ids) && agendamento.servicos_ids.length > 0
      ? agendamento.servicos_ids
      : agendamento.servico_id ? [agendamento.servico_id] : []

    if (idsServicos.length === 0 && agendamento.servicos?.id) {
      idsServicos.push(agendamento.servicos.id)
    }

    const { data: servicosInfo } = await supabase.from('servicos')
      .select('id, nome, sessoes_equivalentes')
      .eq('salao_id', profile!.salao_id!)

    // Consulta direta à view 'pacotes_clientes_resumo' utilizando a coluna sessoes_restantes
    const { data: resumoPacotes } = await supabase.from('pacotes_clientes_resumo')
      .select('*')
      .eq('cliente_id', agendamento.cliente_id)
      .gt('sessoes_restantes', 0)

    const opcoesGerais: PacoteOpcao[] = (resumoPacotes || []).map((cp: any) => ({
      clientePacoteId: cp.id || cp.cliente_pacote_id,
      nome: cp.pacote_nome || cp.nome || 'Pacote Ativo',
      sessoesRestantes: cp.sessoes_restantes,
    }))

    if (idsServicos.length === 0) {
      return [{
        servicoId: agendamento.servico_id || 'geral',
        servicoNome: agendamento.servicos?.nome || 'Atendimento',
        sessoesEquivalentes: 1,
        clientePacoteIdSelecionado: opcoesGerais.length > 0 ? opcoesGerais[0].clientePacoteId : null,
        pacotesDisponiveis: opcoesGerais,
      }]
    }

    return idsServicos.map(id => {
      const srv = (servicosInfo || []).find((s: any) => s.id === id)
      return {
        servicoId: id,
        servicoNome: srv?.nome || 'Serviço',
        sessoesEquivalentes: srv?.sessoes_equivalentes || 1,
        clientePacoteIdSelecionado: opcoesGerais.length > 0 ? opcoesGerais[0].clientePacoteId : null,
        pacotesDisponiveis: opcoesGerais,
      }
    })
  }

  async function abrirModalConfirmar(ag: any) {
    setModalConfirmar(ag)
    setServicoRealizado(ag.servicos?.nome || '')
    setCarregandoCoberturas(true)
    const covs = await montarCoberturas(ag)
    setCoberturas(covs)
    setCarregandoCoberturas(false)
  }

  function alterarPacoteServico(servicoId: string, clientePacoteId: string | null) {
    setCoberturas(prev => prev.map(c =>
      c.servicoId === servicoId
        ? { ...c, clientePacoteIdSelecionado: clientePacoteId }
        : c
    ))
  }

  async function confirmarAtendimento() {
    if (!servicoRealizado || !modalConfirmar) return
    setSalvando(true)

    await supabase.from('confirmacoes_atendimento').insert({
      agendamento_id: modalConfirmar.id,
      salao_id: profile!.salao_id,
      confirmado_por: profile!.id,
      servico_realizado: servicoRealizado
    })

    await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', modalConfirmar.id)

    const hoje = new Date().toISOString().slice(0, 10)
    const descontos: Record<string, { nome: string; peso: number }[]> = {}
    
    for (const cob of coberturas) {
      if (!cob.clientePacoteIdSelecionado) continue
      if (!descontos[cob.clientePacoteIdSelecionado]) descontos[cob.clientePacoteIdSelecionado] = []
      descontos[cob.clientePacoteIdSelecionado].push({ nome: cob.servicoNome, peso: cob.sessoesEquivalentes })
    }

    for (const [cpId, itens] of Object.entries(descontos)) {
      const totalPeso = itens.reduce((acc, i) => acc + i.peso, 0)
      const { data: cp } = await supabase.from('cliente_pacotes')
        .select('sessoes_usadas, sessoes_total').eq('id', cpId).single()
      if (!cp) continue

      const novasUsadas = cp.sessoes_usadas + totalPeso
      await supabase.from('cliente_pacotes').update({
        sessoes_usadas: novasUsadas,
        status: novasUsadas >= cp.sessoes_total ? 'concluido' : 'ativo'
      }).eq('id', cpId)

      for (const item of itens) {
        for (let i = 0; i < item.peso; i++) {
          await supabase.from('sessoes_pacote').insert({
            cliente_pacote_id: cpId,
            data_sessao: hoje,
            servico_realizado: item.peso > 1 ? `${item.nome} (${i + 1}/${item.peso})` : item.nome,
            profissional_id: profile!.id
          })
        }
      }
    }

    const totalDescontados = Object.values(descontos)
      .reduce((acc, itens) => acc + itens.reduce((a, i) => a + i.peso, 0), 0)

    const semPacoteOuAcabou = coberturas.length === 0 || coberturas.every(cob => {
      const pacoteSelecionadoInfo = cob.pacotesDisponiveis.find(p => p.clientePacoteId === cob.clientePacoteIdSelecionado)
      return !cob.clientePacoteIdSelecionado || (pacoteSelecionadoInfo && pacoteSelecionadoInfo.sessoesRestantes - cob.sessoesEquivalentes <= 0)
    })

    if (semPacoteOuAcabou) {
      const iniciarNovo = confirm('Esta cliente não possui mais sessões disponíveis ou o pacote acabou. Deseja criar um novo pacote para ela agora?')
      if (iniciarNovo) {
        router.push(`/salao/pacotes/clientes?cliente_id=${modalConfirmar.cliente_id}&novo=true`)
        return
      }
    }

    const { data: clienteInfo } = await supabase.from('clientes')
      .select('profile_id').eq('id', modalConfirmar.cliente_id).single()
    if (clienteInfo?.profile_id) {
      await notificar({
        salaoId: profile!.salao_id,
        remetenteId: profile!.id,
        destinatarioId: clienteInfo.profile_id,
        titulo: '✅ Atendimento confirmado!',
        mensagem: totalDescontados > 0
          ? `Seu atendimento foi confirmado. ${totalDescontados} sessão(ões) descontada(s) do pacote.`
          : 'Seu atendimento foi registrado com sucesso!',
        tipo: 'confirmacao',
        url: '/cliente/pacotes'
      })
    }

    setModalConfirmar(null)
    setServicoRealizado('')
    setCoberturas([])
    setSalvando(false)
    carregarDados()
  }

  async function sugerirHorarios(solicitacao: any) {
    const horarios = horariosLivres.filter(h => h)
    if (!horarios.length) return
    setSalvando(true)
    await supabase.from('solicitacoes_agendamento').update({
      status: 'horario_sugerido', horarios_sugeridos: horarios, profissional_id: profile!.id
    }).eq('id', solicitacao.id)

    const { data: cp } = await supabase.from('clientes').select('profile_id').eq('id', solicitacao.cliente_id).single()
    if (cp?.profile_id) {
      await notificar({
        salaoId: profile!.salao_id, remetenteId: profile!.id, destinatarioId: cp.profile_id,
        titulo: '📅 Horários disponíveis para você!',
        mensagem: `${salao?.nome} sugeriu horários para ${solicitacao.servicos?.nome}. Escolha o melhor para você!`,
        tipo: 'horario_sugerido',
        url: '/cliente/agendamentos'
      })
    }
    setModalSugestao(null); setHorariosLivres(['', '', '']); setSalvando(false); carregarDados()
  }

  async function cancelarSugestao(solicitacao: any) {
    await supabase.from('solicitacoes_agendamento').update({
      status: 'pendente', horarios_sugeridos: null, profissional_id: null
    }).eq('id', solicitacao.id)
    carregarDados()
  }

  async function recusarSolicitacao(solicitacao: any) {
    await supabase.from('solicitacoes_agendamento').update({ status: 'recusado' }).eq('id', solicitacao.id)
    carregarDados()
  }

  function enviarWhatsAppHorarios(solicitacao: any) {
    const telefone = solicitacao.clientes?.telefone ? solicitacao.clientes.telefone.replace(/\D/g, '') : ''
    const listaHorarios = (solicitacao.horarios_sugeridos || []).map((h: string, index: number) => 
      `*Opção ${index + 1}:* ${new Date(h).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às ${new Date(h).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    ).join('\n')

    const texto = encodeURIComponent(
      `Olá, ${solicitacao.clientes?.nome}! Aqui do *${salao?.nome || 'Salão'}*. Separamos os seguintes horários disponíveis para o seu atendimento de *${solicitacao.servicos?.nome}*:\n\n${listaHorarios}\n\nQual destas opções fica melhor para você?`
    )
    
    if (telefone) {
      window.open(`https://api.whatsapp.com/send?phone=55${telefone}&text=${texto}`, '_blank')
    } else {
      window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank')
    }
  }

  function enviarWhatsAppCancelamento(solicitacao: any) {
    const telefone = solicitacao.clientes?.telefone ? solicitacao.clientes.telefone.replace(/\D/g, '') : ''
    const texto = encodeURIComponent(
      `Olá, ${solicitacao.clientes?.nome}! Aqui é do *${salao?.nome || 'Salão'}*. Infelizmente este horário já não temos mais disponível, mas estamos aguardando seu retorno para verificarmos outra data ideal para você!`
    )
    
    if (telefone) {
      window.open(`https://api.whatsapp.com/send?phone=55${telefone}&text=${texto}`, '_blank')
    } else {
      window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank')
    }
  }

  async function removerHorarioIndividual(solicitacao: any, horarioRemover: string) {
    const novos = solicitacao.horarios_sugeridos.filter((h: string) => h !== horarioRemover)
    if (novos.length === 0) { cancelarSugestao(solicitacao); return }
    await supabase.from('solicitacoes_agendamento').update({ horarios_sugeridos: novos }).eq('id', solicitacao.id)
    carregarDados()
  }

  async function excluirNotificacao(id: string) {
    await supabase.from('notificacoes').update({ excluida: true }).eq('id', id)
    carregarDados()
  }

  async function restaurarNotificacao(id: string) {
    await supabase.from('notificacoes').update({ excluida: false }).eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const badges = {
    pedidos: solicitacoes.length,
    confirmacoes: confirmacoes.length,
    avisos: notificacoes.filter(n => !n.lida).length,
    excluidas: 0,
    catalogo: 0
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Central de Atendimento & Disparos</h1>
      </div>

      <div className="flex bg-white border-b border-gray-100 overflow-x-auto">
        {([
          { key: 'pedidos', label: 'Pedidos' },
          { key: 'confirmacoes', label: 'Confirmar' },
          { key: 'avisos', label: 'Avisos' },
          { key: 'catalogo', label: '✨ Enviar Catálogo' },
          { key: 'excluidas', label: 'Excluídas' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setAba(t.key)}
            className={'relative flex-1 py-3 text-xs font-medium whitespace-nowrap transition-all px-3 ' +
              (aba === t.key ? 'border-b-2' : 'text-gray-400')}
            style={aba === t.key ? { color: cor, borderColor: cor } : {}}>
            {t.label}
            {badges[t.key] > 0 && (
              <span className="absolute top-1.5 right-1 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
                style={{ backgroundColor: cor }}>
                {badges[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* PEDIDOS */}
        {aba === 'pedidos' && (
          solicitacoes.length === 0 ? (
            <div className="card text-center py-10">
              <Calendar size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhuma solicitação pendente</p>
            </div>
          ) : solicitacoes.map(s => (
            <div key={s.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{s.clientes?.nome}</p>
                  <p className="text-sm text-gray-500">{s.servicos?.nome}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                  (s.status === 'horario_sugerido' ? 'bg-blue-50 text-blue-600' : 'bg-yellow-50 text-yellow-600')}>
                  {s.status === 'horario_sugerido' ? 'Horários enviados' : 'Aguardando'}
                </span>
              </div>

              {s.status === 'horario_sugerido' && s.horarios_sugeridos && (
                <div className="bg-blue-50 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-blue-700">Horários sugeridos:</p>
                    <button onClick={() => enviarWhatsAppHorarios(s)}
                      className="bg-green-600 text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                      <MessageCircle size={13} /> Enviar WhatsApp
                    </button>
                  </div>
                  {s.horarios_sugeridos.map((h: string, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2">
                      <p className="text-xs text-blue-600 font-medium">
                        {new Date(h).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <button onClick={() => removerHorarioIndividual(s, h)}
                        className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center ml-2 shrink-0">
                        <X size={12} className="text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {s.status === 'pendente' && (
                  <>
                    <button onClick={() => { setModalSugestao(s); setHorariosLivres(['', '', '']) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-sm font-medium"
                      style={{ backgroundColor: cor }}>
                      <Clock size={14} />Sugerir horários
                    </button>
                    <button onClick={() => { recusarSolicitacao(s); enviarWhatsAppCancelamento(s); }}
                      className="px-4 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium flex items-center gap-1">
                      <X size={14} /> Recusar / Avisar
                    </button>
                  </>
                )}
                {s.status === 'horario_sugerido' && (
                  <>
                    <button onClick={() => { setModalSugestao(s); setHorariosLivres(s.horarios_sugeridos || ['', '', '']) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-medium"
                      style={{ borderColor: cor, color: cor }}>
                      <Clock size={14} />Alterar horários
                    </button>
                    <button onClick={() => { cancelarSugestao(s); enviarWhatsAppCancelamento(s); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium">
                      <RotateCcw size={14} />Retirar oferta
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {/* CONFIRMAR */}
        {aba === 'confirmacoes' && (
          confirmacoes.length === 0 ? (
            <div className="card text-center py-10">
              <Check size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhum atendimento para confirmar</p>
            </div>
          ) : confirmacoes.map(ag => (
            <div key={ag.id} className="card flex flex-col gap-2">
              <p className="font-bold text-gray-900">{ag.clientes?.nome}</p>
              <p className="text-sm text-gray-500">{ag.servicos?.nome}</p>
              <p className="text-xs text-gray-400">
                {new Date(ag.data_hora).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
              <button onClick={() => abrirModalConfirmar(ag)}
                className="w-full py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-1.5"
                style={{ backgroundColor: cor }}>
                <Check size={14} />Confirmar atendimento
              </button>
            </div>
          ))
        )}

        {/* AVISOS */}
        {aba === 'avisos' && (
          notificacoes.length === 0 ? (
            <div className="card text-center py-10">
              <Bell size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhum aviso</p>
            </div>
          ) : notificacoes.map(n => (
            <div key={n.id}
              onClick={() => handleClicarNotificacao(n)}
              className={'card flex flex-col gap-1 cursor-pointer transition-colors hover:bg-gray-50 ' + (!n.lida ? 'border-l-4' : '')}
              style={!n.lida ? { borderLeftColor: cor } : {}}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{n.titulo}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{n.mensagem}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); excluirNotificacao(n.id) }}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Trash2 size={13} className="text-gray-400" />
                </button>
              </div>
            </div>
          ))
        )}

        {/* CATÁLOGO */}
        {aba === 'catalogo' && (
          <div className="flex flex-col gap-4">
            <div className="card bg-white p-4 flex flex-col gap-2">
              <h2 className="font-bold text-gray-900 text-base">Selecione o que deseja enviar</h2>
              <p className="text-xs text-gray-500">Escolha serviços específicos dentro de cada categoria para montar sua mensagem personalizada para o WhatsApp.</p>
            </div>

            {categoriasLista.length === 0 && servicosLista.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-sm text-gray-400">Nenhum serviço cadastrado no catálogo.</p>
              </div>
            ) : (
              <>
                {categoriasLista.map(cat => {
                  const srvsDestaCat = servicosLista.filter(s => s.categoria_id === cat.id)
                  if (srvsDestaCat.length === 0) return null
                  const todosDaCatSelecionados = srvsDestaCat.every(s => servicosSelecionadosIds.includes(s.id))

                  return (
                    <div key={cat.id} className="card bg-white p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <span className="font-bold text-sm text-gray-800" style={{ color: cor }}>📁 {cat.nome}</span>
                        <button onClick={() => selecionarTodosCategoria(cat.id)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
                          {todosDaCatSelecionados ? 'Desmarcar todos' : 'Selecionar categoria'}
                        </button>
                      </div>

                      <div className="flex flex-col gap-2">
                        {srvsDestaCat.map(srv => {
                          const selecionado = servicosSelecionadosIds.includes(srv.id)
                          return (
                            <label key={srv.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${selecionado ? 'border-pink-500 bg-pink-50/30' : 'border-gray-100 bg-gray-50'}`}>
                              <div className="flex items-center gap-2.5">
                                <input type="checkbox" checked={selecionado} onChange={() => toggleServicoSelecao(srv.id)}
                                  className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500" />
                                <span className="text-sm font-medium text-gray-900">{srv.nome}</span>
                              </div>
                              <span className="text-xs font-semibold text-gray-600">
                                {Number(srv.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {servicosLista.filter(s => !s.categoria_id).length > 0 && (
                  <div className="card bg-white p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="font-bold text-sm text-gray-800">📁 Outros Serviços</span>
                      <button onClick={() => selecionarTodosCategoria(null)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">
                        Selecionar todos
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {servicosLista.filter(s => !s.categoria_id).map(srv => {
                        const selecionado = servicosSelecionadosIds.includes(srv.id)
                        return (
                          <label key={srv.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${selecionado ? 'border-pink-500 bg-pink-50/30' : 'border-gray-100 bg-gray-50'}`}>
                            <div className="flex items-center gap-2.5">
                              <input type="checkbox" checked={selecionado} onChange={() => toggleServicoSelecao(srv.id)}
                                className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500" />
                              <span className="text-sm font-medium text-gray-900">{srv.nome}</span>
                            </div>
                            <span className="text-xs font-semibold text-gray-600">
                              {Number(srv.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {servicosSelecionadosIds.length > 0 && (
              <button onClick={abrirPreviewWp}
                className="sticky bottom-4 w-full py-3.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
                style={{ backgroundColor: '#25D366' }}>
                <Share2 size={18} /> Pré-visualizar e Enviar ({servicosSelecionadosIds.length} selecionados)
              </button>
            )}
          </div>
        )}

        {/* EXCLUÍDAS */}
        {aba === 'excluidas' && (
          notificacoesExcluidas.length === 0 ? (
            <div className="card text-center py-10">
              <Trash2 size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhuma notificação excluída</p>
            </div>
          ) : notificacoesExcluidas.map(n => (
            <div key={n.id} className="card flex flex-col gap-1 opacity-60">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{n.titulo}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{n.mensagem}</p>
                </div>
                <button onClick={() => restaurarNotificacao(n.id)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <RotateCcw size={13} className="text-gray-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE PREVIEW */}
      {modalPreviewOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle size={22} className="text-green-600" />
                <h3 className="font-bold text-gray-900 text-lg">Preview da Mensagem</h3>
              </div>
              <button onClick={() => setModalPreviewOpen(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <p className="text-xs text-gray-500">Você pode editar livremente o texto abaixo, adicionar emojis ou alterar a estrutura. Use <code className="bg-gray-100 px-1 py-0.5 rounded text-pink-600 font-bold">{`{itens}`}</code> onde deseja que os itens do catálogo apareçam.</p>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Telefone do Cliente (Opcional - com DDD)</label>
              <input type="text" placeholder="Ex: 11999999999" value={telefoneDestinoWp}
                onChange={e => setTelefoneDestinoWp(e.target.value)} className="input-field text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Se deixar vazio, o WhatsApp abrirá para você escolher o contato livremente.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Editor do Texto Base (Pré-molde)</label>
              <textarea rows={6} value={templateMensagem}
                onChange={e => setTemplateMensagem(e.target.value)}
                className="input-field text-xs font-mono leading-relaxed" />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Como será enviado no WhatsApp:</span>
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans bg-white p-3 rounded-xl border border-green-100 shadow-inner">
                {gerarTextoPreview()}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button onClick={salvarTemplatePadrao}
                className="py-3 px-4 rounded-2xl border border-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-gray-50">
                <Bookmark size={14} /> Salvar como meu Pré-molde
              </button>
              <button onClick={dispararWhatsAppFinal}
                className="flex-1 py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md"
                style={{ backgroundColor: '#25D366' }}>
                <MessageCircle size={16} /> Enviar no WhatsApp Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sugerir horários */}
      {modalSugestao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                {modalSugestao.status === 'horario_sugerido' ? 'Alterar horários' : 'Sugerir horários'}
              </h3>
              <button onClick={() => setModalSugestao(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            {horariosLivres.map((h, i) => (
              <div key={i}>
                <label className="text-xs font-medium text-gray-500 block mb-1">Opção {i + 1}</label>
                <input type="datetime-local" className="input-field"
                  value={h} onChange={e => { const n = [...horariosLivres]; n[i] = e.target.value; setHorariosLivres(n) }}
                  style={{ colorScheme: 'light' }} />
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setModalSugestao(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={() => sugerirHorarios(modalSugestao)} disabled={salvando || !horariosLivres[0]}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-40"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Enviando...' : 'Enviar para cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar atendimento */}
      {modalConfirmar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Confirmar atendimento</h3>
              <button onClick={() => { setModalConfirmar(null); setCoberturas([]) }}><X size={20} className="text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-600 font-medium">{modalConfirmar.clientes?.nome}</p>

            {carregandoCoberturas ? (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
                <p className="text-xs text-gray-400">Verificando pacotes ativos...</p>
              </div>
            ) : coberturas.length > 0 ? (
              <div className="flex flex-col gap-3">
                {coberturas.map(cob => (
                  <div key={cob.servicoId} className="bg-gray-50 rounded-2xl p-3 flex flex-col gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{cob.servicoNome}</p>
                    <select
                      className="input-field text-sm py-2"
                      value={cob.clientePacoteIdSelecionado || ''}
                      onChange={e => alterarPacoteServico(cob.servicoId, e.target.value || null)}>
                      <option value="">Não usar pacote / Sem pacote</option>
                      {cob.pacotesDisponiveis.map(op => (
                        <option key={op.clientePacoteId} value={op.clientePacoteId}>
                          {op.nome} ({op.sessoesRestantes} restantes)
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-red-500">Este cliente não possui pacotes ativos cadastrados.</p>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">O que foi realizado?</label>
              <input className="input-field" value={servicoRealizado} onChange={e => setServicoRealizado(e.target.value)} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setModalConfirmar(null); setCoberturas([]) }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={confirmarAtendimento} disabled={salvando || !servicoRealizado}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-40"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
