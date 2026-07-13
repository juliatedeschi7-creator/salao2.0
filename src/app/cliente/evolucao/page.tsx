'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Calendar, Package, ClipboardList, Camera, Plus, X, Eye, EyeOff, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'

type Grupo = {
  grupo_id: string
  data: string
  descricao?: string
  antes?: string
  antesId?: string
  depois?: string
  depoisId?: string
  agendamento_id?: string
  cliente_pacote_id?: string
  visivel_cliente?: boolean
}

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
  const [evolucoes, setEvolucoes] = useState<Grupo[]>([])
  const [aba, setAba] = useState<'resumo' | 'pacotes' | 'historico' | 'anamnese' | 'evolucao'>('resumo')
  const [carregando, setCarregando] = useState(true)

  // Evolução
  const [modalEvolucao, setModalEvolucao] = useState(false)
  const [indexAtivo, setIndexAtivo] = useState(0)
  const [ladoAtivo, setLadoAtivo] = useState<Record<string, 'antes' | 'depois'>>({})
  const [fotoAntes, setFotoAntes] = useState<File | null>(null)
  const [fotoDepois, setFotoDepois] = useState<File | null>(null)
  const [previewAntes, setPreviewAntes] = useState<string | null>(null)
  const [previewDepois, setPreviewDepois] = useState<string | null>(null)
  const [descricaoEvolucao, setDescricaoEvolucao] = useState('')
  const [visivelCliente, setVisivelCliente] = useState(true)
  const [agendamentoVinculado, setAgendamentoVinculado] = useState('')
  const [salvandoEvolucao, setSalvandoEvolucao] = useState(false)

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

    const { data: ags } = await supabase.from('agendamentos')
      .select('*, servicos(nome), profiles!agendamentos_profissional_id_fkey(nome)')
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

    await carregarEvolucoes()
    setCarregando(false)
  }

  async function carregarEvolucoes() {
    const { data: evs } = await supabase.from('evolucoes')
      .select('*').eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })

    if (!evs) return
    const mapa: Record<string, Grupo> = {}
    for (const ev of evs) {
      if (!mapa[ev.grupo_id]) {
        mapa[ev.grupo_id] = {
          grupo_id: ev.grupo_id,
          data: ev.created_at,
          descricao: ev.descricao,
          agendamento_id: ev.agendamento_id,
          cliente_pacote_id: ev.cliente_pacote_id
        }
      }
      if (ev.tipo === 'antes') { mapa[ev.grupo_id].antes = ev.url; mapa[ev.grupo_id].antesId = ev.id }
      if (ev.tipo === 'depois') { mapa[ev.grupo_id].depois = ev.url; mapa[ev.grupo_id].depoisId = ev.id }
    }
    setEvolucoes(Object.values(mapa).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()))
  }

  function selecionarFoto(file: File, tipo: 'antes' | 'depois') {
    const reader = new FileReader()
    reader.onload = e => {
      if (tipo === 'antes') { setFotoAntes(file); setPreviewAntes(e.target?.result as string) }
      else { setFotoDepois(file); setPreviewDepois(e.target?.result as string) }
    }
    reader.readAsDataURL(file)
  }

  async function uploadFoto(file: File, tipo: 'antes' | 'depois', grupoId: string): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `${profile!.salao_id}/${clienteId}/${grupoId}/${tipo}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('evolucao').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('evolucao').getPublicUrl(path)
    return data.publicUrl
  }

  async function salvarEvolucao() {
    if (!fotoAntes && !fotoDepois) return
    setSalvandoEvolucao(true)

    const grupoId = crypto.randomUUID()
    const inserts = []

    if (fotoAntes) {
      const url = await uploadFoto(fotoAntes, 'antes', grupoId)
      if (url) inserts.push({
        salao_id: profile!.salao_id, cliente_id: clienteId,
        grupo_id: grupoId, tipo: 'antes', url,
        descricao: descricaoEvolucao || null,
        visivel_cliente: visivelCliente,
        agendamento_id: agendamentoVinculado || null,
        criado_por: profile!.id
      })
    }

    if (fotoDepois) {
      const url = await uploadFoto(fotoDepois, 'depois', grupoId)
      if (url) inserts.push({
        salao_id: profile!.salao_id, cliente_id: clienteId,
        grupo_id: grupoId, tipo: 'depois', url,
        descricao: descricaoEvolucao || null,
        visivel_cliente: visivelCliente,
        agendamento_id: agendamentoVinculado || null,
        criado_por: profile!.id
      })
    }

    if (inserts.length > 0) await supabase.from('evolucoes').insert(inserts)

    setModalEvolucao(false)
    setFotoAntes(null); setFotoDepois(null)
    setPreviewAntes(null); setPreviewDepois(null)
    setDescricaoEvolucao(''); setAgendamentoVinculado('')
    setVisivelCliente(true)
    setSalvandoEvolucao(false)
    carregarEvolucoes()
  }

  async function excluirGrupo(g: Grupo) {
    const ids = [g.antesId, g.depoisId].filter(Boolean)
    if (ids.length > 0) await supabase.from('evolucoes').delete().in('id', ids)
    carregarEvolucoes()
  }

async function alternarVisibilidade(g: Grupo) {
  await supabase
    .from('evolucao_registros')
    .update({ visivel_cliente: !g.visivel_cliente })
    .eq('id', g.grupo_id)
  carregarDados()
}

  const cor = salao?.cor_primaria || '#E91E8C'

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
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900">{cliente?.nome}</h1>
          <p className="text-xs text-gray-400">{cliente?.email}</p>
        </div>
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ backgroundColor: cor }}>
          {cliente?.nome?.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="flex bg-white border-b border-gray-100 overflow-x-auto">
        {([
          { key: 'resumo', label: 'Resumo' },
          { key: 'historico', label: 'Histórico' },
          { key: 'pacotes', label: 'Pacotes' },
          { key: 'evolucao', label: 'Evolução' },
          { key: 'anamnese', label: 'Anamnese' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setAba(t.key)}
            className={'flex-1 py-3 text-xs font-medium whitespace-nowrap transition-all px-2 ' + (aba === t.key ? 'border-b-2' : 'text-gray-400')}
            style={aba === t.key ? { color: cor, borderColor: cor } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {/* RESUMO */}
        {aba === 'resumo' && (
          <>
            <div className="card flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados pessoais</p>
              {cliente?.telefone && <div className="flex justify-between"><span className="text-sm text-gray-500">Telefone</span><span className="text-sm font-medium">{cliente.telefone}</span></div>}
              {cliente?.data_nascimento && <div className="flex justify-between"><span className="text-sm text-gray-500">Nascimento</span><span className="text-sm font-medium">{new Date(cliente.data_nascimento + 'T12:00').toLocaleDateString('pt-BR')}</span></div>}
              {cliente?.observacoes && <div><p className="text-xs text-gray-400 mb-1">Observações</p><p className="text-sm text-gray-700">{cliente.observacoes}</p></div>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="card text-center">
                <p className="text-2xl font-bold text-gray-900">{agendamentos.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Visitas</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold" style={{ color: cor }}>{pacotes.filter(p => p.status === 'ativo').length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Pacotes</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold text-gray-900">{evolucoes.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Evoluções</p>
              </div>
            </div>

            {agendamentos.length > 0 && (
              <div className="card">
                <p className="text-xs font-semibold text-gray-500 mb-2">Último atendimento</p>
                <p className="font-medium text-gray-900">{agendamentos[0].servicos?.nome}</p>
                <p className="text-xs text-gray-400">{new Date(agendamentos[0].data_hora).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
            )}
          </>
        )}

        {/* HISTÓRICO */}
        {aba === 'historico' && (
          agendamentos.length === 0 ? (
            <div className="card text-center py-8"><Calendar size={32} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhum atendimento</p></div>
          ) : agendamentos.map(ag => (
            <div key={ag.id} className="card flex flex-col gap-1">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-gray-900">{ag.servicos?.nome}</p>
                <span className={'text-xs px-2 py-0.5 rounded-full ' + (statusCor[ag.status] || 'bg-gray-100 text-gray-500')}>{ag.status}</span>
              </div>
              <p className="text-xs text-gray-400">{new Date(ag.data_hora).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              {ag.profiles?.nome && <p className="text-xs text-gray-400">Prof: {ag.profiles.nome}</p>}
            </div>
          ))
        )}

        {/* PACOTES */}
        {aba === 'pacotes' && (
          pacotes.length === 0 ? (
            <div className="card text-center py-8"><Package size={32} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhum pacote</p></div>
          ) : pacotes.map(p => {
            const progresso = p.sessoes_total > 0 ? (p.sessoes_usadas / p.sessoes_total) * 100 : 0
            return (
              <div key={p.id} className="card flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <p className="font-bold text-gray-900">{p.pacotes?.nome || 'Pacote manual'}</p>
                  <span className={'text-xs px-2 py-0.5 rounded-full ' + (p.status === 'ativo' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500')}>{p.status}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1"><span>{p.sessoes_usadas} usadas</span><span>{p.sessoes_total - p.sessoes_usadas} restantes</span></div>
                  <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 rounded-full" style={{ width: progresso + '%', backgroundColor: cor }} /></div>
                </div>
                <p className="text-xs text-gray-400">Vendido por: {p.profiles?.nome || 'Não informado'}</p>
              </div>
            )
          })
        )}

        {/* EVOLUÇÃO */}
        {aba === 'evolucao' && (
          <>
            <button onClick={() => setModalEvolucao(true)}
              className="w-full py-3.5 rounded-2xl text-white font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: cor }}>
              <Plus size={18} />Adicionar registro de evolução
            </button>

            {evolucoes.length === 0 ? (
              <div className="card text-center py-8 flex flex-col items-center gap-2">
                <Camera size={32} className="text-gray-300" />
                <p className="text-gray-400">Nenhuma evolução registrada</p>
                <p className="text-xs text-gray-300">Adicione fotos de antes e depois dos atendimentos</p>
              </div>
            ) : (
              <>
                {evolucoes.length > 1 && (
                  <div className="bg-white rounded-2xl p-3 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Todos os registros</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {evolucoes.map((g, i) => {
                        const url = g.depois || g.antes
                        return (
                          <button key={g.grupo_id} onClick={() => setIndexAtivo(i)}
                            className="shrink-0 flex flex-col items-center gap-1">
                            <div className={'w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ' + (i === indexAtivo ? 'scale-110' : 'opacity-50')}
                              style={{ borderColor: i === indexAtivo ? cor : 'transparent' }}>
                              {url
                                ? <img src={url} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-lg">📷</div>}
                            </div>
                            <p className="text-[10px] text-gray-400">{new Date(g.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(() => {
                  const g = evolucoes[indexAtivo]
                  if (!g) return null
                  const lado = ladoAtivo[g.grupo_id] || (g.depois ? 'depois' : 'antes')
                  const urlAtiva = lado === 'antes' ? g.antes : g.depois
                  const temAmbos = !!(g.antes && g.depois)

                  return (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700">
                          {new Date(g.data).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => alternarVisibilidade(g)}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                            title={g.visivel_cliente ? 'Ocultar da cliente' : 'Mostrar para cliente'}>
                            {g.visivel_cliente
                              ? <Eye size={14} className="text-gray-500" />
                              : <EyeOff size={14} className="text-gray-400" />}
                          </button>
                          <button onClick={() => excluirGrupo(g)}
                            className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      </div>

                      {!g.visivel_cliente && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
                          <p className="text-xs text-yellow-700">👁 Oculto para a cliente</p>
                        </div>
                      )}

                      <div className="relative bg-white rounded-3xl overflow-hidden shadow-sm">
                        {urlAtiva ? (
                          <img src={urlAtiva} alt={lado} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square bg-gray-100 flex flex-col items-center justify-center gap-2">
                            <Camera size={32} className="text-gray-300" />
                            <p className="text-xs text-gray-400">Foto {lado} não adicionada</p>
                          </div>
                        )}
                        <div className="absolute top-3 left-3">
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg"
                            style={{ backgroundColor: lado === 'antes' ? '#6b7280' : cor }}>
                            {lado === 'antes' ? '📷 Antes' : '✨ Depois'}
                          </span>
                        </div>
                      </div>

                      {temAmbos && (
                        <div className="flex gap-2">
                          <button onClick={() => setLadoAtivo(prev => ({ ...prev, [g.grupo_id]: 'antes' }))}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                            style={lado === 'antes' ? { backgroundColor: '#6b7280', color: 'white' } : { backgroundColor: 'white', color: '#9ca3af' }}>
                            📷 Antes
                          </button>
                          <button onClick={() => setLadoAtivo(prev => ({ ...prev, [g.grupo_id]: 'depois' }))}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                            style={lado === 'depois' ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#9ca3af' }}>
                            ✨ Depois
                          </button>
                        </div>
                      )}

                      {g.descricao && (
                        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                          <p className="text-xs font-medium text-gray-400 mb-1">Observação</p>
                          <p className="text-sm text-gray-700">{g.descricao}</p>
                        </div>
                      )}

                      {evolucoes.length > 1 && (
                        <div className="flex gap-2">
                          <button onClick={() => setIndexAtivo(Math.max(0, indexAtivo - 1))} disabled={indexAtivo === 0}
                            className="flex-1 py-2.5 rounded-xl bg-white text-sm font-medium text-gray-500 flex items-center justify-center gap-1 disabled:opacity-30 shadow-sm">
                            <ChevronLeft size={16} />Anterior
                          </button>
                          <button onClick={() => setIndexAtivo(Math.min(evolucoes.length - 1, indexAtivo + 1))} disabled={indexAtivo === evolucoes.length - 1}
                            className="flex-1 py-2.5 rounded-xl bg-white text-sm font-medium text-gray-500 flex items-center justify-center gap-1 disabled:opacity-30 shadow-sm">
                            Próximo<ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </>
            )}
          </>
        )}

        {/* ANAMNESE */}
        {aba === 'anamnese' && (
          anamneses.length === 0 ? (
            <div className="card text-center py-8"><ClipboardList size={32} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhuma anamnese respondida</p></div>
          ) : anamneses.map(a => (
            <div key={a.id} className="card flex flex-col gap-2">
              <p className="font-semibold text-gray-900">{a.fichas_anamnese?.titulo}</p>
              <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('pt-BR')}</p>
              {a.respostas && typeof a.respostas === 'object' && Object.entries(a.respostas).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-900">{String(v)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Modal adicionar evolução */}
      {modalEvolucao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Novo registro de evolução</h3>
              <button onClick={() => setModalEvolucao(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">📷 Foto ANTES</label>
                {previewAntes ? (
                  <div className="relative">
                    <img src={previewAntes} className="w-full aspect-square object-cover rounded-2xl" />
                    <button onClick={() => { setFotoAntes(null); setPreviewAntes(null) }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer gap-2 bg-gray-50">
                    <Camera size={24} className="text-gray-300" />
                    <p className="text-xs text-gray-400">Adicionar</p>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) selecionarFoto(e.target.files[0], 'antes') }} />
                  </label>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">✨ Foto DEPOIS</label>
                {previewDepois ? (
                  <div className="relative">
                    <img src={previewDepois} className="w-full aspect-square object-cover rounded-2xl" />
                    <button onClick={() => { setFotoDepois(null); setPreviewDepois(null) }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer gap-2 bg-gray-50">
                    <Camera size={24} className="text-gray-300" />
                    <p className="text-xs text-gray-400">Adicionar</p>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) selecionarFoto(e.target.files[0], 'depois') }} />
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Observação (opcional)</label>
              <textarea className="input-field resize-none" rows={3}
                placeholder="Ex: Hidratação intensa, cliente com cabelos secos..."
                value={descricaoEvolucao}
                onChange={e => setDescricaoEvolucao(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Vincular ao atendimento (opcional)</label>
              <select className="input-field" value={agendamentoVinculado}
                onChange={e => setAgendamentoVinculado(e.target.value)}>
                <option value="">Nenhum</option>
                {agendamentos.slice(0, 10).map(ag => (
                  <option key={ag.id} value={ag.id}>
                    {ag.servicos?.nome} — {new Date(ag.data_hora).toLocaleDateString('pt-BR')}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Visível para a cliente</p>
                <p className="text-xs text-gray-400">A cliente pode ver essa evolução no app</p>
              </div>
              <button onClick={() => setVisivelCliente(!visivelCliente)}
                className="w-12 h-6 rounded-full transition-all relative shrink-0"
                style={{ backgroundColor: visivelCliente ? cor : '#d1d5db' }}>
                <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all"
                  style={{ left: visivelCliente ? '26px' : '2px' }} />
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalEvolucao(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={salvarEvolucao}
                disabled={salvandoEvolucao || (!fotoAntes && !fotoDepois)}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-40"
                style={{ backgroundColor: cor }}>
                {salvandoEvolucao ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
