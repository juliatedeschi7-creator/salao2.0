'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Bell, Calendar, Check, X, Clock, Trash2, RotateCcw, Package } from 'lucide-react'

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

const PERIODO_LABEL: Record<string, string> = {
  manha: 'manhã',
  tarde: 'tarde',
  noite: 'noite',
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
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: sols } = await supabase.from('solicitacoes_agendamento')
      .select('*, clientes(nome, email), servicos(nome, duracao_minutos)')
      .eq('salao_id', profile!.salao_id!)
      .in('status', ['pendente', 'horario_sugerido'])
      .order('created_at', { ascending: false })
    setSolicitacoes(sols || [])

    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1)
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(nome), servicos(nome), confirmacoes_atendimento(*)')
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

  // ─── Ação ao clicar na notificação ───────────────────────────────────────
  async function handleClicarNotificacao(n: any) {
    if (!n.lida) {
      await supabase.from('notificacoes').update({ lida: true }).eq('id', n.id)
      setNotificacoes(prev => prev.map(item => item.id === n.id ? { ...item, lida: true } : item))
    }

    if (n.url) {
      router.push(n.url)
    } else if (n.tipo === 'duplicado' || n.titulo?.toLowerCase().includes('duplicado')) {
      router.push('/clientes')
    }
  }

  // ─── Monta lista de serviços com pacotes disponíveis ────────────────────
  async function montarCoberturas(agendamento: any): Promise<CoberturaServico[]> {
    const idsServicos: string[] = Array.isArray(agendamento.servicos_ids) && agendamento.servicos_ids.length > 0
      ? agendamento.servicos_ids
      : agendamento.servico_id ? [agendamento.servico_id] : []

    if (idsServicos.length === 0) return []

    const { data: servicosInfo } = await supabase.from('servicos')
      .select('id, nome, sessoes_equivalentes').in('id', idsServicos)

    const { data: clientePacotes } = await supabase.from('cliente_pacotes')
      .select('*, pacotes(nome, pacote_itens(servico_id))')
      .eq('cliente_id', agendamento.cliente_id)
      .eq('status', 'ativo')

    const pacotesAtivos = (clientePacotes || []).filter(
      (cp: any) => cp.sessoes_usadas < cp.sessoes_total
    )

    return idsServicos.map(id => {
      const srv = (servicosInfo || []).find((s: any) => s.id === id)

      const pacotesCobrem = pacotesAtivos.filter((cp: any) => {
        const itens: any[] = cp.pacotes?.pacote_itens || []
        if (itens.length > 0) return itens.some((i: any) => i.servico_id === id)
        return true
      })

      const opcoes: PacoteOpcao[] = pacotesCobrem.map((cp: any) => ({
        clientePacoteId: cp.id,
        nome: cp.pacotes?.nome || 'Pacote',
        sessoesRestantes: cp.sessoes_total - cp.sessoes_usadas,
      }))

      return {
        servicoId: id,
        servicoNome: srv?.nome || 'Serviço',
        sessoesEquivalentes: srv?.sessoes_equivalentes || 1,
        clientePacoteIdSelecionado: opcoes.length > 0 ? opcoes[0].clientePacoteId : null,
        pacotesDisponiveis: opcoes,
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

  // ─── Confirma e desconta dos pacotes escolhidos ──────────────────────────
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

  // ─── Demais funções ───────────────────────────────────────────────────────
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
    const { data: cp } = await supabase.from('clientes').select('profile_id').eq('id', solicitacao.cliente_id).single()
    if (cp?.profile_id) {
      await notificar({
        salaoId: profile!.salao_id, remetenteId: profile!.id, destinatarioId: cp.profile_id,
        titulo: '⚠️ Horários indisponíveis',
        mensagem: `Os horários sugeridos para ${solicitacao.servicos?.nome} não estão mais disponíveis.`,
        tipo: 'sistema',
        url: '/cliente/agendamentos'
      })
    }
    carregarDados()
  }

  async function recusarSolicitacao(solicitacao: any) {
    await supabase.from('solicitacoes_agendamento').update({ status: 'recusado' }).eq('id', solicitacao.id)
    const { data: cp } = await supabase.from('clientes').select('profile_id').eq('id', solicitacao.cliente_id).single()
    if (cp?.profile_id) {
      await notificar({
        salaoId: profile!.salao_id, remetenteId: profile!.id, destinatarioId: cp.profile_id,
        titulo: 'Solicitação não disponível',
        mensagem: `Não foi possível atender sua solicitação de ${solicitacao.servicos?.nome} no momento.`,
        tipo: 'sistema',
        url: '/cliente/agendamentos'
      })
    }
    carregarDados()
  }

  async function removerHorarioIndividual(solicitacao: any, horarioRemover: string) {
    const novos = solicitacao.horarios_sugeridos.filter((h: string) => h !== horarioRemover)
    if (novos.length === 0) { cancelarSugestao(solicitacao); return }
    await supabase.from('solicitacoes_agendamento').update({ horarios_sugeridos: novos }).eq('id', solicitacao.id)
    const { data: cp } = await supabase.from('clientes').select('profile_id').eq('id', solicitacao.cliente_id).single()
    if (cp?.profile_id) {
      await notificar({
        salaoId: profile!.salao_id, remetenteId: profile!.id, destinatarioId: cp.profile_id,
        titulo: '⚠️ Um horário foi removido',
        mensagem: `Um dos horários sugeridos para ${solicitacao.servicos?.nome} não está mais disponível.`,
        tipo: 'horario_sugerido',
        url: '/cliente/agendamentos'
      })
    }
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
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Notificações</h1>
      </div>

      <div className="flex bg-white border-b border-gray-100 overflow-x-auto">
        {([
          { key: 'pedidos', label: 'Pedidos' },
          { key: 'confirmacoes', label: 'Confirmar' },
          { key: 'avisos', label: 'Avisos' },
          { key: 'excluidas', label: 'Excluídas' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setAba(t.key)}
            className={'relative flex-1 py-3 text-xs font-medium whitespace-nowrap transition-all px-2 ' +
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
                  {(s.data_preferida || s.periodo_preferido) && (
                    <p className="text-xs font-medium mt-1" style={{ color: cor }}>
                      📅 Prefere: {s.data_preferida
                        ? new Date(s.data_preferida + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
                        : 'qualquer dia'}
                      {s.periodo_preferido ? ` · ${PERIODO_LABEL[s.periodo_preferido] || s.periodo_preferido}` : ''}
                    </p>
                  )}
                </div>
                <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                  (s.status === 'horario_sugerido' ? 'bg-blue-50 text-blue-600' : 'bg-yellow-50 text-yellow-600')}>
                  {s.status === 'horario_sugerido' ? 'Horários enviados' : 'Aguardando'}
                </span>
              </div>

              {s.status === 'horario_sugerido' && s.horarios_sugeridos && (
                <div className="bg-blue-50 rounded-xl p-3 flex flex-col gap-2">
                  <p className="text-xs font-medium text-blue-700">Horários sugeridos — toque ✕ para remover:</p>
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
                    <button onClick={() => recusarSolicitacao(s)}
                      className="px-4 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium">
                      <X size={14} />
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
                    <button onClick={() => cancelarSugestao(s)}
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
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
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
            <p className="text-sm text-gray-500">{modalSugestao.clientes?.nome} — {modalSugestao.servicos?.nome}</p>
            {horariosLivres.map((h, i) => (
              <div key={i}>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Opção {i + 1} {i === 0 ? '(obrigatória)' : '(opcional)'}
                </label>
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

      {/* Modal confirmar atendimento com seleção de pacote por serviço */}
      {modalConfirmar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Confirmar atendimento</h3>
              <button onClick={() => { setModalConfirmar(null); setCoberturas([]) }}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-600 font-medium">{modalConfirmar.clientes?.nome}</p>

            {carregandoCoberturas ? (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
                <p className="text-xs text-gray-400">Verificando pacotes ativos...</p>
              </div>
            ) : coberturas.length > 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Serviços deste atendimento
                </p>
                {coberturas.map(cob => (
                  <div key={cob.servicoId} className="bg-gray-50 rounded-2xl p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cor}18` }}>
                        <Package size={13} style={{ color: cor }} />
                      </div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {cob.servicoNome}
                        {cob.sessoesEquivalentes > 1 && (
                          <span className="text-xs font-normal text-gray-400"> (vale {cob.sessoesEquivalentes} sessões)</span>
                        )}
                      </p>
                    </div>

                    {cob.pacotesDisponiveis.length === 0 ? (
                      <p className="text-xs text-gray-400 ml-9">Sem pacote ativo para este serviço</p>
                    ) : (
                      <div className="ml-9">
                        <label className="text-xs text-gray-500 mb-1 block">Descontar de qual pacote?</label>
                        <select
                          className="input-field text-sm py-2"
                          value={cob.clientePacoteIdSelecionado || ''}
                          onChange={e => alterarPacoteServico(cob.servicoId, e.target.value || null)}>
                          <option value="">Não usar pacote</option>
                          {cob.pacotesDisponiveis.map(op => (
                            <option key={op.clientePacoteId} value={op.clientePacoteId}>
                              {op.nome} ({op.sessoesRestantes} sessão{op.sessoesRestantes !== 1 ? 'ões' : ''} restante{op.sessoesRestantes !== 1 ? 's' : ''})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}

                {coberturas.some(c => c.clientePacoteIdSelecionado) && (
                  <div className="bg-green-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-green-700 font-medium">
                      ✓ {coberturas.filter(c => c.clientePacoteIdSelecionado)
                        .reduce((acc, c) => acc + c.sessoesEquivalentes, 0)} sessão(ões) serão descontadas dos pacotes selecionados
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">O que foi realizado?</label>
              <input className="input-field" placeholder="Ex: Manicure + Pedicure tradicionais"
                value={servicoRealizado} onChange={e => setServicoRealizado(e.target.value)} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setModalConfirmar(null); setCoberturas([]) }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
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
