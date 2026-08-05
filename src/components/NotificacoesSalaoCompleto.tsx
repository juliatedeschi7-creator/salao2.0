// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Bell, Calendar, Check, X, Clock, Trash2, RotateCcw, MessageCircle } from 'lucide-react'

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

export default function NotificacoesDonoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [aba, setAba] = useState<'pedidos' | 'confirmacoes' | 'avisos' | 'excluidas'>('pedidos')
  
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

  useEffect(() => {
    if (loading) return
    if (!profile) {
      router.push('/login')
      return
    }
    if (profile.salao_id) {
      carregarDados()
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

    const { data: sols } = await supabase.from('solicitacoes_agendamento')
      .select('*, clientes(nome, email, telefone), servicos(nome, duracao_minutos)')
      .eq('salao_id', profile!.salao_id!)
      .in('status', ['pendente', 'horario_sugerido'])
      .order('created_at', { ascending: false })
    setSolicitacoes(sols || [])

    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1)
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(nome, telefone, id), servicos(nome, id), confirmacoes_atendimento(*)')
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

    // Consulta direta à view 'pacotes_clientes_resumo' garantindo filtro correto pelo cliente_id
    const { data: resumoPacotes, error: erroView } = await supabase.from('pacotes_clientes_resumo')
      .select('*')
      .eq('cliente_id', agendamento.cliente_id)
      .gt('sessoes_restantes', 0)

    if (erroView) {
      console.error("Erro ao consultar pacotes_clientes_resumo:", erroView)
    }

    const opcoesGerais: PacoteOpcao[] = (resumoPacotes || []).map((cp: any) => ({
      clientePacoteId: cp.id || cp.cliente_pacote_id,
      nome: cp.pacote_nome || cp.nome || 'Pacote Ativo',
      sessoesRestantes: Number(cp.sessoes_restantes ?? 0),
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
    excluidas: 0
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Central de Atendimento</h1>
      </div>

      <div className="flex bg-white border-b border-gray-100 overflow-x-auto">
        {([
          { key: 'pedidos', label: 'Pedidos' },
          { key: 'confirmacoes', label: 'Confirmar' },
          { key: 'avisos', label: 'Avisos' },
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

      {/* Modal confirmar atendimento com exibição correta das sessões restantes */}
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
                          {op.nome} — {op.sessoesRestantes} sessões restantes
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-red-500">Este cliente não possui pacotes ativos com sessões disponíveis.</p>
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
