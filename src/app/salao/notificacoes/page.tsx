'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Bell, Calendar, Check, X, Clock, Trash2, RotateCcw, Package } from 'lucide-react'

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

export default function NotificacoesSalaoCompleto() {
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

  const p = profile as any
  const isDono = p?.tipo === 'dono' || p?.nivel === 'admin' || p?.cargo === 'dono' || !p?.tipo

  useEffect(() => {
    if (loading) return
    if (!profile) return
    
    // Se for funcionário, valida se ele tem permissão de notificações ou gerenciar agenda
    if (!isDono && !p?.permite_notificacoes && !p?.permite_gerenciar_agenda) {
      router.push('/funcionario/dashboard')
      return
    }

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

    if (idsServicos.length === 0) return []

    const { data: servicosInfo } = await supabase.from('servicos')
      .select('id, nome, sessoes_equivalentes').in('id', idsServicos)

    const { data: clientePacotes } = await supabase.from('cliente_pacotes')
      .select('*, pacotes(nome, pacote_itens(servico_id))')
      .eq('cliente_id', agendamento.cliente_id)
      .eq('status', 'ativo')

    const pacotesAtivos = (clientePacotes || []).filter((cp: any) => cp.sessoes_usadas < cp.sessoes_total)

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
    setCoberturas(prev => prev.map(c => c.servicoId === servicoId ? { ...c, clientePacoteIdSelecionado: clientePacoteId } : c))
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
      const { data: cp } = await supabase.from('cliente_pacotes').select('sessoes_usadas, sessoes_total').eq('id', cpId).single()
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
            className={'relative flex-1 py-3 text-xs font-medium whitespace-nowrap transition-all px-2 ' + (aba === t.key ? 'border-b-2' : 'text-gray-400')}
            style={aba === t.key ? { color: cor, borderColor: cor } : {}}>
            {t.label}
            {badges[t.key] > 0 && (
              <span className="absolute top-1.5 right-1 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold" style={{ backgroundColor: cor }}>
                {badges[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3 max-w-2xl mx-auto">
        {aba === 'pedidos' && (
          solicitacoes.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">Nenhuma solicitação pendente</p> :
          solicitacoes.map(s => (
            <div key={s.id} className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
              <div>
                <p className="font-bold text-gray-900 text-sm">{s.clientes?.nome}</p>
                <p className="text-xs text-gray-500">{s.servicos?.nome}</p>
              </div>
              <div className="flex gap-2">
                {s.status === 'pendente' && (
                  <>
                    <button onClick={() => { setModalSugestao(s); setHorariosLivres(['', '', '']) }} className="flex-1 py-2 rounded-xl text-white text-xs font-semibold" style={{ backgroundColor: cor }}>Sugerir horários</button>
                    <button onClick={() => recusarSolicitacao(s)} className="px-3 py-2 rounded-xl bg-red-50 text-red-500 text-xs font-semibold">Recusar</button>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {aba === 'confirmacoes' && (
          confirmacoes.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">Nenhum atendimento para confirmar</p> :
          confirmacoes.map(ag => (
            <div key={ag.id} className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
              <p className="font-bold text-gray-900 text-sm">{ag.clientes?.nome} — {ag.servicos?.nome}</p>
              <button onClick={() => abrirModalConfirmar(ag)} className="w-full py-2.5 rounded-xl text-white text-xs font-semibold mt-1" style={{ backgroundColor: cor }}>Confirmar Atendimento</button>
            </div>
          ))
        )}

        {aba === 'avisos' && (
          notificacoes.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">Nenhum aviso</p> :
          notificacoes.map(n => (
            <div key={n.id} onClick={() => handleClicarNotificacao(n)} className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-1 cursor-pointer">
              <h3 className="font-bold text-gray-900 text-sm">{n.titulo}</h3>
              <p className="text-xs text-gray-600">{n.mensagem}</p>
            </div>
          ))
        )}

        {aba === 'excluidas' && (
          notificacoesExcluidas.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">Nenhuma notificação excluída</p> :
          notificacoesExcluidas.map(n => (
            <div key={n.id} className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100 opacity-60 flex flex-col gap-1">
              <h3 className="font-bold text-gray-900 text-sm">{n.titulo}</h3>
              <button onClick={() => restaurarNotificacao(n.id)} className="text-xs text-blue-500 mt-1">Restaurar</button>
            </div>
          ))
        )}
      </div>

      {modalConfirmar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-base">Confirmar Atendimento</h3>
            {coberturas.map(cob => (
              <div key={cob.servicoId} className="bg-gray-50 p-3 rounded-2xl flex flex-col gap-2">
                <p className="font-semibold text-sm text-gray-900">{cob.servicoNome}</p>
                {cob.pacotesDisponiveis.length > 0 && (
                  <select className="input-field text-sm" value={cob.clientePacoteIdSelecionado || ''} onChange={e => alterarPacoteServico(cob.servicoId, e.target.value || null)}>
                    <option value="">Não usar pacote</option>
                    {cob.pacotesDisponiveis.map(op => <option key={op.clientePacoteId} value={op.clientePacoteId}>{op.nome} ({op.sessoesRestantes} restantes)</option>)}
                  </select>
                )}
              </div>
            ))}
            <input type="text" className="input-field text-sm" value={servicoRealizado} onChange={e => setServicoRealizado(e.target.value)} placeholder="O que foi realizado?" />
            <button onClick={confirmarAtendimento} disabled={salvando} className="w-full py-3 rounded-2xl text-white text-sm font-semibold" style={{ backgroundColor: cor }}>{salvando ? 'Salvando...' : 'Concluir'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
