'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, CheckCircle, XCircle, Calendar, Send } from 'lucide-react'

export default function NotificacoesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [confirmacoes, setConfirmacoes] = useState<any[]>([])
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [aba, setAba] = useState<'notif' | 'confirmacoes' | 'solicitacoes'>('notif')
  const [modalNotif, setModalNotif] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [enviando, setEnviando] = useState(false)
  const [modalConfirm, setModalConfirm] = useState<any>(null)
  const [oQueFez, setOQueFez] = useState('')
  const [horariosLivres, setHorariosLivres] = useState<string[]>(['', '', ''])

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: notifs } = await supabase.from('notificacoes').select('*')
      .eq('salao_id', profile!.salao_id!)
      .eq('remetente_id', profile!.id)
      .order('created_at', { ascending: false })
    setNotificacoes(notifs || [])

    const { data: clis } = await supabase.from('clientes').select('id, nome').eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(clis || [])

    const hoje = new Date()
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1)
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(nome, id), servicos(nome), confirmacoes_atendimento(*)')
      .eq('salao_id', profile!.salao_id!)
      .gte('data_hora', ontem.toISOString())
      .lte('data_hora', hoje.toISOString())
      .eq('status', 'confirmado')
    setConfirmacoes(ags?.filter((a: any) => !a.confirmacoes_atendimento?.length) || [])

    const { data: sols } = await supabase.from('solicitacoes_agendamento')
      .select('*, clientes(nome), servicos(nome)')
      .eq('salao_id', profile!.salao_id!)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
    setSolicitacoes(sols || [])
  }

  async function enviarNotificacao() {
    if (!titulo || !mensagem) return
    setEnviando(true)
    const destinatarios = clienteId
      ? [clientes.find(c => c.id === clienteId)]
      : clientes

    for (const c of destinatarios) {
      const { data: prof } = await supabase.from('profiles').select('id').eq('salao_id', profile!.salao_id!).eq('role', 'cliente').eq('id', c.id).single()
      if (prof) {
        await supabase.from('notificacoes').insert({
          salao_id: profile!.salao_id,
          remetente_id: profile!.id,
          destinatario_id: prof.id,
          titulo, mensagem, tipo: 'personalizada', lida: false
        })
      }
    }
    setTitulo(''); setMensagem(''); setClienteId('')
    setModalNotif(false); setEnviando(false); carregarDados()
  }

  async function confirmarAtendimento(ag: any, veio: boolean) {
    await supabase.from('confirmacoes_atendimento').insert({
      agendamento_id: ag.id, confirmado: veio,
      o_que_fez: veio ? oQueFez : null, respondido_em: new Date().toISOString()
    })
    if (veio && oQueFez) {
      await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', ag.id)
      const { data: pacote } = await supabase.from('cliente_pacotes')
        .select('*').eq('cliente_id', ag.clientes?.id).eq('status', 'ativo').single()
      if (pacote) {
        const novasUsadas = pacote.sessoes_usadas + 1
        await supabase.from('cliente_pacotes').update({
          sessoes_usadas: novasUsadas,
          status: novasUsadas >= pacote.sessoes_total ? 'concluido' : 'ativo'
        }).eq('id', pacote.id)
        await supabase.from('sessoes_pacote').insert({
          cliente_pacote_id: pacote.id,
          data_sessao: new Date(ag.data_hora).toISOString().split('T')[0],
          servico_realizado: oQueFez,
          profissional_id: profile!.id
        })
      }
    }
    setModalConfirm(null); setOQueFez(''); carregarDados()
  }

  async function sugerirHorarios(solicitacao: any) {
    const horarios = horariosLivres.filter(h => h)
    if (!horarios.length) return
    const { data: prof } = await supabase.from('clientes').select('profile_id').eq('id', solicitacao.cliente_id).single()
    await supabase.from('notificacoes').insert({
      salao_id: profile!.salao_id,
      remetente_id: profile!.id,
      destinatario_id: prof?.profile_id,
      titulo: 'Horarios sugeridos para ' + solicitacao.servicos?.nome,
      mensagem: 'Temos esses horarios disponiveis: ' + horarios.join(', ') + '. Confirme o de sua preferencia respondendo esta mensagem.',
      tipo: 'horario_sugerido', lida: false
    })
    await supabase.from('solicitacoes_agendamento').update({ status: 'horario_sugerido' }).eq('id', solicitacao.id)
    setHorariosLivres(['', '', '']); carregarDados()
  }

  async function enviarLembrete() {
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
    const { data: ags } = await supabase.from('agendamentos')
      .select('*, clientes(profile_id, nome), servicos(nome)')
      .eq('salao_id', profile!.salao_id!)
      .gte('data_hora', amanha.toISOString().split('T')[0] + 'T00:00:00')
      .lte('data_hora', amanha.toISOString().split('T')[0] + 'T23:59:59')
      .neq('status', 'cancelado')

    for (const ag of ags || []) {
      if (ag.clientes?.profile_id) {
        const hora = new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        await supabase.from('notificacoes').insert({
          salao_id: profile!.salao_id,
          remetente_id: profile!.id,
          destinatario_id: ag.clientes.profile_id,
          titulo: 'Lembrete de agendamento',
          mensagem: 'Ola ' + ag.clientes.nome + '! Voce tem ' + ag.servicos?.nome + ' amanha as ' + hora + '. Te esperamos!',
          tipo: 'lembrete', lida: false
        })
      }
    }
    alert('Lembretes enviados para ' + (ags?.length || 0) + ' cliente(s)!')
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Notificacoes</h1>
        <button onClick={() => setModalNotif(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-sm font-medium"
          style={{ backgroundColor: cor }}>
          <Send size={14} />Enviar
        </button>
      </div>

      <div className="flex bg-white border-b border-gray-100">
        {[
          { key: 'notif', label: 'Enviadas' },
          { key: 'confirmacoes', label: 'Confirmar (' + confirmacoes.length + ')' },
          { key: 'solicitacoes', label: 'Pedidos (' + solicitacoes.length + ')' },
        ].map(t => (
          <button key={t.key} onClick={() => setAba(t.key as any)}
            className={'flex-1 py-3 text-xs font-medium transition-all ' + (aba === t.key ? 'border-b-2' : 'text-gray-400')}
            style={aba === t.key ? { color: cor, borderColor: cor } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {aba === 'notif' && (
          <>
            <button onClick={enviarLembrete}
              className="card flex items-center gap-3 active:scale-95 transition-all">
              <Bell size={20} style={{ color: cor }} />
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900 text-sm">Enviar lembretes de amanha</p>
                <p className="text-xs text-gray-400">Notifica todos os clientes com agendamento amanha</p>
              </div>
            </button>

            {notificacoes.length === 0 ? (
              <div className="card text-center py-10"><Bell size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhuma notificacao enviada</p></div>
            ) : notificacoes.map(n => (
              <div key={n.id} className="card flex flex-col gap-1">
                <div className="flex justify-between">
                  <p className="font-semibold text-gray-900 text-sm">{n.titulo}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{n.tipo}</span>
                </div>
                <p className="text-sm text-gray-500">{n.mensagem}</p>
                <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
          </>
        )}

        {aba === 'confirmacoes' && (
          confirmacoes.length === 0 ? (
            <div className="card text-center py-10"><CheckCircle size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhum atendimento para confirmar</p></div>
          ) : confirmacoes.map(ag => (
            <div key={ag.id} className="card flex flex-col gap-3">
              <div>
                <p className="font-bold text-gray-900">{ag.clientes?.nome}</p>
                <p className="text-sm text-gray-500">{ag.servicos?.nome}</p>
                <p className="text-xs text-gray-400">{new Date(ag.data_hora).toLocaleString('pt-BR')}</p>
              </div>
              <p className="text-sm font-medium text-gray-700">{ag.clientes?.nome} veio ao atendimento?</p>
              <div className="flex gap-2">
                <button onClick={() => { setModalConfirm(ag) }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
                  style={{ backgroundColor: cor }}>
                  <CheckCircle size={16} />Sim, veio
                </button>
                <button onClick={() => confirmarAtendimento(ag, false)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium">
                  <XCircle size={16} />Nao veio
                </button>
              </div>
            </div>
          ))
        )}

        {aba === 'solicitacoes' && (
          solicitacoes.length === 0 ? (
            <div className="card text-center py-10"><Calendar size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhuma solicitacao pendente</p></div>
          ) : solicitacoes.map(sol => (
            <div key={sol.id} className="card flex flex-col gap-3">
              <div>
                <p className="font-bold text-gray-900">{sol.clientes?.nome}</p>
                <p className="text-sm text-gray-500">Quer agendar: {sol.servicos?.nome}</p>
                <p className="text-xs text-gray-400">{new Date(sol.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <p className="text-sm font-medium text-gray-700">Sugerir horarios livres:</p>
              {horariosLivres.map((h, i) => (
                <input key={i} className="input-field" type="datetime-local"
                  value={h} onChange={e => { const n = [...horariosLivres]; n[i] = e.target.value; setHorariosLivres(n) }} />
              ))}
              <button onClick={() => sugerirHorarios(sol)}
                className="w-full py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ backgroundColor: cor }}>
                Enviar sugestao de horarios
              </button>
            </div>
          ))
        )}
      </div>

      {modalNotif && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">Enviar Notificacao</h3>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Para</label>
              <select className="input-field" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Todas as clientes</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Titulo</label>
              <input className="input-field" placeholder="Ex: Promocao especial!" value={titulo} onChange={e => setTitulo(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Mensagem</label>
              <textarea className="input-field resize-none" rows={4} placeholder="Digite sua mensagem..." value={mensagem} onChange={e => setMensagem(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalNotif(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={enviarNotificacao} disabled={!titulo || !mensagem || enviando}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: cor }}>
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">O que foi feito?</h3>
            <p className="text-sm text-gray-500">Informe o servico realizado para atualizar o pacote da cliente</p>
            <textarea className="input-field resize-none" rows={3}
              placeholder="Ex: Limpeza de pele + hidratacao..."
              value={oQueFez} onChange={e => setOQueFez(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => { setModalConfirm(null); setOQueFez('') }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={() => confirmarAtendimento(modalConfirm, true)} disabled={!oQueFez}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: cor }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
