'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Phone, Mail, Calendar, Package, ClipboardList, Edit3, MessageCircle, Star } from 'lucide-react'

type Tab = 'resumo' | 'pacotes' | 'historico' | 'questionarios'

export default function ClientePerfilPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string

  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [questionarios, setQuestionarios] = useState<any[]>([])
  const [tab, setTab] = useState<Tab>('resumo')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: cli } = await supabase.from('clientes').select('*').eq('id', clienteId).single()
    setCliente(cli)

    const { data: pacs } = await supabase
      .from('cliente_pacotes')
      .select('*, pacotes(nome, descricao, categoria)')
      .eq('cliente_id', clienteId)
      .order('data_compra', { ascending: false })
    setPacotes(pacs || [])

    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, servicos(nome), profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('cliente_id', clienteId)
      .order('data_hora', { ascending: false })
      .limit(20)
    setAgendamentos(ags || [])

    setCarregando(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  const pacotesAtivos = pacotes.filter(p => p.status === 'ativo')
  const totalSessoes = pacotesAtivos.reduce((acc, p) => acc + (p.sessoes_total - p.sessoes_usadas), 0)
  const totalAtendimentos = agendamentos.filter(a => a.status === 'concluido').length

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  if (!cliente) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="text-gray-500">Cliente não encontrada.</p>
      <button onClick={() => router.back()} className="text-sm font-medium" style={{ color: cor }}>Voltar</button>
    </div>
  )

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'resumo', label: 'Resumo', icon: Star },
    { key: 'pacotes', label: 'Pacotes', icon: Package },
    { key: 'historico', label: 'Histórico', icon: Calendar },
    { key: 'questionarios', label: 'Questionários', icon: ClipboardList },
  ]

  const statusPacote: Record<string, string> = {
    ativo: 'bg-green-50 text-green-600',
    expirado: 'bg-red-50 text-red-500',
    concluido: 'bg-gray-100 text-gray-400',
  }

  const statusAg: Record<string, { label: string; cor: string }> = {
    confirmado: { label: 'Confirmado', cor: 'text-green-600' },
    pendente: { label: 'Pendente', cor: 'text-yellow-600' },
    concluido: { label: 'Concluído', cor: 'text-gray-400' },
    cancelado: { label: 'Cancelado', cor: 'text-red-400' },
  }

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#f4f4f8' }}>

      {/* Header */}
      <div className="relative px-5 pt-12 pb-20 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, ${cor}bb 100%)` }}>
        <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-10 -left-4 w-28 h-28 rounded-full opacity-10 bg-white" />

        <button onClick={() => router.back()}
          className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-5">
          <ArrowLeft size={18} className="text-white" />
        </button>

        <div className="relative flex items-end gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-2xl font-bold">
            {cliente.nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 pb-1">
            <h1 className="text-white text-xl font-bold leading-tight">{cliente.nome}</h1>
            {cliente.telefone && (
              <p className="text-white/70 text-xs mt-0.5">{cliente.telefone}</p>
            )}
          </div>
          <button onClick={() => router.push(`/salao/clientes/${clienteId}/editar`)}
            className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Edit3 size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Stats flutuantes */}
      <div className="px-4 -mt-10 relative z-10 mb-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
          <div className="px-3 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalAtendimentos}</p>
            <p className="text-xs text-gray-400 mt-0.5">Atendimentos</p>
          </div>
          <div className="px-3 py-3 text-center">
            <p className="text-2xl font-bold" style={{ color: cor }}>{pacotesAtivos.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Pacotes ativos</p>
          </div>
          <div className="px-3 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalSessoes}</p>
            <p className="text-xs text-gray-400 mt-0.5">Sessões restantes</p>
          </div>
        </div>
      </div>

      {/* Contato rápido */}
      <div className="px-4 mb-4 flex gap-2">
        {cliente.telefone && (
          <a href={`https://wa.me/55${cliente.telefone?.replace(/\D/g, '')}`} target="_blank"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium active:scale-95 transition-all">
            <MessageCircle size={16} />WhatsApp
          </a>
        )}
        {cliente.email && (
          <a href={`mailto:${cliente.email}`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium active:scale-95 transition-all">
            <Mail size={16} />E-mail
          </a>
        )}
        {!cliente.telefone && !cliente.email && (
          <div className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-400 text-sm text-center">
            Sem contato cadastrado
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl p-1 flex gap-1 shadow-sm border border-gray-100">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === t.key ? 'text-white shadow-sm' : 'text-gray-400'
              }`}
              style={tab === t.key ? { backgroundColor: cor } : {}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das tabs */}
      <div className="px-4 flex flex-col gap-3">

        {/* RESUMO */}
        {tab === 'resumo' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Dados pessoais</p>
              <div className="flex flex-col gap-2.5">
                {cliente.email && (
                  <div className="flex items-center gap-3">
                    <Mail size={15} className="text-gray-300 shrink-0" />
                    <p className="text-sm text-gray-700">{cliente.email}</p>
                  </div>
                )}
                {cliente.telefone && (
                  <div className="flex items-center gap-3">
                    <Phone size={15} className="text-gray-300 shrink-0" />
                    <p className="text-sm text-gray-700">{cliente.telefone}</p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar size={15} className="text-gray-300 shrink-0" />
                  <p className="text-sm text-gray-500">
                    Cliente desde {new Date(cliente.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {cliente.observacoes && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Observações</p>
                <p className="text-sm text-gray-600 leading-relaxed">{cliente.observacoes}</p>
              </div>
            )}

            {/* Último agendamento */}
            {agendamentos[0] && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Último atendimento</p>
                <p className="text-sm font-semibold text-gray-800">{agendamentos[0].servicos?.nome}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(agendamentos[0].data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </>
        )}

        {/* PACOTES */}
        {tab === 'pacotes' && (
          <>
            {pacotes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <Package size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Nenhum pacote registrado</p>
              </div>
            ) : pacotes.map(p => {
              const progresso = p.sessoes_total > 0 ? (p.sessoes_usadas / p.sessoes_total) * 100 : 0
              return (
                <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{p.pacotes?.nome}</p>
                      {p.pacotes?.categoria && (
                        <p className="text-xs text-gray-400 mt-0.5">{p.pacotes.categoria}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusPacote[p.status] || 'bg-gray-100 text-gray-400'}`}>
                      {p.status === 'ativo' ? 'Ativo' : p.status === 'expirado' ? 'Expirado' : 'Concluído'}
                    </span>
                  </div>

                  {/* Barra de progresso */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>{p.sessoes_usadas} usadas</span>
                      <span>{p.sessoes_total - p.sessoes_usadas} restantes</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${progresso}%`, backgroundColor: cor }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">{p.sessoes_total} sessões no total</p>
                  </div>

                  {p.data_expiracao && (
                    <p className="text-xs text-gray-400">
                      Expira em {new Date(p.data_expiracao).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* HISTÓRICO */}
        {tab === 'historico' && (
          <>
            {agendamentos.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <Calendar size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Nenhum atendimento registrado</p>
              </div>
            ) : agendamentos.map(ag => {
              const st = statusAg[ag.status] || { label: ag.status, cor: 'text-gray-400' }
              return (
                <div key={ag.id} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cor}15` }}>
                    <Calendar size={16} style={{ color: cor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{ag.servicos?.nome || 'Serviço'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(ag.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {ag.profiles?.nome ? ` · ${ag.profiles.nome}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${st.cor}`}>{st.label}</span>
                </div>
              )
            })}
          </>
        )}

        {/* QUESTIONÁRIOS */}
        {tab === 'questionarios' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${cor}15` }}>
              <ClipboardList size={24} style={{ color: cor }} />
            </div>
            <p className="text-gray-700 font-semibold text-sm">Questionários em breve</p>
            <p className="text-gray-400 text-xs leading-relaxed text-center">
              Em breve você poderá enviar questionários personalizados para suas clientes e consultar as respostas aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
