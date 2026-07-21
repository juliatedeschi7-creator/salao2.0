'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Mail, Calendar, Package, ClipboardList, Camera, Edit2, Check, X, Lock } from 'lucide-react'

export default function ClientePerfilPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string

  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [pacotes, setPacotes] = useState<any[]>([])
  const [anamneses, setAnamneses] = useState<any[]>([])
  const [aba, setAba] = useState<'resumo' | 'pacotes' | 'historico' | 'anamnese'>('resumo')
  const [carregando, setCarregando] = useState(true)
  const [editandoObs, setEditandoObs] = useState(false)
  const [obsText, setObsText] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    carregarDados()
  }, [loading, profile, clienteId])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: cli } = await supabase.from('clientes').select('*').eq('id', clienteId).single()
    setCliente(cli)
    setObsText(cli?.observacoes_internas || '')

    const { data: ags } = await supabase.from('agendamentos')
      .select('*, servicos(nome, preco), profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('cliente_id', clienteId).order('data_hora', { ascending: false })
    setAgendamentos(ags || [])

    const { data: pacs } = await supabase.from('cliente_pacotes')
      .select('*, pacotes(nome, sessoes_inclusas), profiles!vendido_por(nome)')
      .eq('cliente_id', clienteId).order('data_compra', { ascending: false })
    setPacotes(pacs || [])

    const { data: ans } = await supabase.from('respostas_anamnese')
      .select('*, fichas_anamnese(titulo)')
      .eq('cliente_id', clienteId).order('created_at', { ascending: false })
    setAnamneses(ans || [])

    setCarregando(false)
  }

  async function salvarObservacoes() {
    setSalvandoObs(true)
    await supabase.from('clientes').update({ observacoes_internas: obsText }).eq('id', clienteId)
    setCliente((prev: any) => ({ ...prev, observacoes_internas: obsText }))
    setSalvandoObs(false)
    setEditandoObs(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const totalSessoes = pacotes.filter(p => p.status === 'ativo').reduce((acc, p) => acc + (p.sessoes_total - p.sessoes_usadas), 0)

  const statusCor: Record<string, string> = {
    confirmado: 'bg-green-50 text-green-600',
    pendente: 'bg-yellow-50 text-yellow-600',
    concluido: 'bg-gray-100 text-gray-500',
    cancelado: 'bg-red-50 text-red-400',
  }

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">

      {/* Header com gradiente */}
      <div className="relative overflow-hidden px-4 pt-12 pb-20"
        style={{ background: `linear-gradient(135deg, ${cor}, ${cor}bb)` }}>
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10 bg-white" />
        <div className="absolute top-16 -left-8 w-24 h-24 rounded-full opacity-10 bg-white" />

        <button onClick={() => router.back()}
          className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-4">
          <ArrowLeft size={18} className="text-white" />
        </button>

        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white font-bold text-2xl shrink-0">
            {cliente?.nome?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-white font-bold text-xl leading-tight">{cliente?.nome}</h1>
            {cliente?.email && (
              <div className="flex items-center gap-1.5 mt-1">
                <Mail size={12} className="text-white/70" />
                <p className="text-white/70 text-xs">{cliente.email}</p>
              </div>
            )}
          </div>
          <button onClick={() => router.push('/salao/clientes/' + clienteId + '/editar')}
            className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Edit2 size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Cards de resumo sobrepostos */}
      <div className="px-4 -mt-10 relative z-10 mb-4">
        <div className="bg-white rounded-2xl shadow-md grid grid-cols-3 divide-x divide-gray-100">
          <div className="flex flex-col items-center py-4 gap-0.5">
            <p className="text-2xl font-bold text-gray-900">{agendamentos.length}</p>
            <p className="text-xs text-gray-400">Atendimentos</p>
          </div>
          <div className="flex flex-col items-center py-4 gap-0.5">
            <p className="text-2xl font-bold" style={{ color: cor }}>{pacotes.filter(p => p.status === 'ativo').length}</p>
            <p className="text-xs text-gray-400">Pacotes ativos</p>
          </div>
          <div className="flex flex-col items-center py-4 gap-0.5">
            <p className="text-2xl font-bold text-gray-900">{totalSessoes}</p>
            <p className="text-xs text-gray-400 text-center leading-tight">Sessões restantes</p>
          </div>
        </div>
      </div>

      {/* Contato rápido */}
      {cliente?.telefone && (
        <div className="px-4 mb-4">
          <a href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`} target="_blank"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-medium text-sm"
            style={{ backgroundColor: '#25D366' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Enviar mensagem no WhatsApp
          </a>
        </div>
      )}

      {/* Abas */}
      <div className="px-4 mb-4">
        <div className="flex gap-1.5 bg-white rounded-2xl p-1 shadow-sm overflow-x-auto">
          {([
            { key: 'resumo', label: 'Resumo' },
            { key: 'historico', label: 'Histórico' },
            { key: 'pacotes', label: 'Pacotes' },
            { key: 'anamnese', label: 'Anamnese' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setAba(t.key)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
              style={aba === t.key ? { backgroundColor: cor, color: 'white' } : { color: '#9ca3af' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 flex flex-col gap-3">

        {/* RESUMO */}
        {aba === 'resumo' && (
          <>
            {/* Observações internas — VISÍVEL APENAS PARA DONOS */}
            <div className="card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={14} style={{ color: cor }} />
                  <p className="text-sm font-semibold text-gray-700">Observações internas</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                  Só você vê
                </span>
              </div>

              {editandoObs ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                    rows={5}
                    placeholder="Ex: Tintura 7.1, alérgica a amônia, prefere atendimento pela manhã, cabelo fino e quebradiço..."
                    value={obsText}
                    onChange={e => setObsText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setObsText(cliente?.observacoes_internas || ''); setEditandoObs(false) }}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium flex items-center justify-center gap-1">
                      <X size={14} />Cancelar
                    </button>
                    <button onClick={salvarObservacoes} disabled={salvandoObs}
                      className="flex-1 py-2 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-1"
                      style={{ backgroundColor: cor }}>
                      {salvandoObs ? '...' : <><Check size={14} />Salvar</>}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditandoObs(true)} className="text-left w-full">
                  {cliente?.observacoes_internas ? (
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {cliente.observacoes_internas}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-300 italic">
                      Toque para adicionar observações sobre esta cliente (tintura, preferências, alergias, etc.)
                    </p>
                  )}
                </button>
              )}
            </div>

            {/* Dados pessoais */}
            <div className="card flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dados pessoais</p>
              {cliente?.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-700">{cliente.email}</p>
                </div>
              )}
              {cliente?.data_nascimento && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-700">
                    Nasc: {new Date(cliente.data_nascimento + 'T12:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <p className="text-sm text-gray-400">
                  Cliente desde {new Date(cliente?.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {agendamentos.length > 0 && (
              <div className="card">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Último atendimento</p>
                <p className="font-medium text-gray-900">{agendamentos[0].servicos?.nome}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(agendamentos[0].data_hora).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            )}
          </>
        )}

        {/* HISTÓRICO */}
        {aba === 'historico' && (
          agendamentos.length === 0 ? (
            <div className="card text-center py-8">
              <Calendar size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhum atendimento</p>
            </div>
          ) : agendamentos.map(ag => (
            <div key={ag.id} className="card flex flex-col gap-1">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-gray-900">{ag.servicos?.nome}</p>
                <span className={'text-xs px-2 py-0.5 rounded-full ' + (statusCor[ag.status] || 'bg-gray-100 text-gray-500')}>
                  {ag.status}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {new Date(ag.data_hora).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {ag.profiles?.nome && <p className="text-xs text-gray-400">Prof: {ag.profiles.nome}</p>}
              {ag.valor && <p className="text-sm font-bold" style={{ color: cor }}>R$ {Number(ag.valor).toFixed(2).replace('.', ',')}</p>}
            </div>
          ))
        )}

        {/* PACOTES */}
        {aba === 'pacotes' && (
          pacotes.length === 0 ? (
            <div className="card text-center py-8">
              <Package size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhum pacote</p>
            </div>
          ) : pacotes.map(p => {
            const progresso = p.sessoes_total > 0 ? (p.sessoes_usadas / p.sessoes_total) * 100 : 0
            return (
              <div key={p.id} className="card flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <p className="font-bold text-gray-900">{p.pacotes?.nome || 'Pacote manual'}</p>
                  <span className={'text-xs px-2 py-0.5 rounded-full ' + (p.status === 'ativo' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500')}>
                    {p.status}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{p.sessoes_usadas} usadas</span>
                    <span>{p.sessoes_total - p.sessoes_usadas} restantes</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-2 rounded-full" style={{ width: progresso + '%', backgroundColor: cor }} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Vendido por: {p.profiles?.nome || 'Não informado'}</p>
              </div>
            )
          })
        )}

        {/* ANAMNESE */}
        {aba === 'anamnese' && (
          anamneses.length === 0 ? (
            <div className="card text-center py-8">
              <ClipboardList size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhuma anamnese respondida</p>
            </div>
          ) : anamneses.map(a => (
            <div key={a.id} className="card flex flex-col gap-2">
              <p className="font-semibold text-gray-900">{a.fichas_anamnese?.titulo}</p>
              <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('pt-BR')}</p>
              {a.respostas && typeof a.respostas === 'object' && Object.entries(a.respostas).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm border-t border-gray-50 pt-1.5">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-900">{String(v)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
