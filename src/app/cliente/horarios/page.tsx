// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Clock, CheckCircle, XCircle, User, Plus, Minus, X } from 'lucide-react'

const DIAS = [
  { key: 'segunda', label: 'Segunda-feira', abrev: 'SEG' },
  { key: 'terca', label: 'Terça-feira', abrev: 'TER' },
  { key: 'quarta', label: 'Quarta-feira', abrev: 'QUA' },
  { key: 'quinta', label: 'Quinta-feira', abrev: 'QUI' },
  { key: 'sexta', label: 'Sexta-feira', abrev: 'SEX' },
  { key: 'sabado', label: 'Sábado', abrev: 'SÁB' },
  { key: 'domingo', label: 'Domingo', abrev: 'DOM' },
]

const CHAVE_DIA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60), m = minutos % 60
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`
  return `${h}h${m > 0 ? ` e ${m}min` : ''}`
}

type ItemCarrinho = { id: string; nome: string; preco: number; duracao_minutos: number; quantidade: number }

export default function ClienteHorariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [horarios, setHorarios] = useState<Record<string, any>>({})
  const [vagos, setVagos] = useState<any[]>([])
  const [reservando, setReservando] = useState<string | null>(null)
  const [reservados, setReservados] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'vagas' | 'funcionamento'>('vagas')

  // Estados para o modal de agendamento (serviços, categorias, carrinho)
  const [servicos, setServicos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('todos')
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [modalAgendar, setModalAgendar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [dataPreferida, setDataPreferida] = useState('')
  const [periodoPreferido, setPeriodoPreferido] = useState('qualquer')

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: cli } = await supabase
      .from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    if (!cli) { setCarregando(false); return }
    setCliente(cli)
    setSalao(cli.saloes)
    setHorarios(cli.saloes?.horarios_funcionamento || {})
    const salaoId = cli.saloes?.id

    if (salaoId) {
      const { data: srvs } = await supabase.from('servicos').select('*').eq('salao_id', salaoId).eq('ativo', true).order('categoria')
      if (srvs) {
        setServicos(srvs)
        const cats = Array.from(new Set(srvs.map(s => s.categoria).filter(Boolean))) as string[]
        setCategorias(cats)
      }
    }

    const agora = new Date().toISOString()
    const { data: hrs } = await supabase
      .from('horarios_vagos')
      .select('*, profiles(nome)')
      .eq('salao_id', salaoId)
      .eq('reservado', false)
      .gte('data_hora', agora)
      .order('data_hora')
    setVagos(hrs || [])
    setCarregando(false)
  }

  function adicionarAoCarrinho(s: any) {
    setCarrinho(prev => {
      const existe = prev.find(i => i.id === s.id)
      if (existe) return prev.map(i => i.id === s.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { id: s.id, nome: s.nome, preco: s.preco, duracao_minutos: s.duracao_minutos, quantidade: 1 }]
    })
  }

  function removerDoCarrinho(id: string) {
    setCarrinho(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      if (item.quantidade === 1) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, quantidade: i.quantidade - 1 } : i)
    })
  }

  function qtdCarrinho(id: string) { return carrinho.find(i => i.id === id)?.quantidade || 0 }

  const totalCarrinho = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const totalItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0)
  const duracaoTotal = carrinho.reduce((acc, i) => acc + i.duracao_minutos * i.quantidade, 0)

  const servicosFiltrados = categoriaSelecionada === 'todos' 
    ? servicos 
    : servicos.filter(s => s.categoria === categoriaSelecionada)

  async function enviarCarrinho() {
    if (carrinho.length === 0 || !cliente || !salao) return
    setEnviando(true)
    const grupoId = crypto.randomUUID()
    for (const item of carrinho) {
      await supabase.from('solicitacoes_agendamento').insert({
        salao_id: salao.id, cliente_id: cliente.id, servico_id: item.id, status: 'pendente', grupo_id: grupoId,
        data_preferida: dataPreferida || null,
        periodo_preferido: periodoPreferido !== 'qualquer' ? periodoPreferido : null,
      })
    }
    const resumo = carrinho.map(i => `${i.quantidade}x ${i.nome}`).join(', ')
    await notificar({
      salaoId: salao.id,
      remetenteId: profile!.id,
      destinatarioId: salao.dono_id,
      titulo: 'Nova solicitação de agendamento',
      mensagem: `${cliente.nome} quer agendar: ${resumo}`,
      tipo: 'solicitacao',
      url: '/salao/notificacoes'
    })
    setEnviando(false)
    setEnviado(true)
    setCarrinho([])
    setDataPreferida('')
    setPeriodoPreferido('qualquer')
    setTimeout(() => {
      setEnviado(false)
      setModalAgendar(false)
      carregarDados()
    }, 3000)
  }

  async function reservarHorario(horario: any) {
    if (reservados.has(horario.id) || reservando === horario.id) return
    setReservando(horario.id)
    await supabase.from('horarios_vagos').update({
      reservado: true, cliente_id: cliente.id
    }).eq('id', horario.id)
    await notificar({
      salaoId: salao.id,
      remetenteId: profile!.id,
      destinatarioId: salao.dono_id,
      titulo: 'Horário reservado!',
      mensagem: `${cliente.nome} reservou o horário de ${formatarDataHora(horario.data_hora)}.`,
      tipo: 'horario',
      url: '/salao/agenda'
    })
    setReservados(prev => new Set(Array.from(prev).concat(horario.id)))
    setVagos(prev => prev.filter(h => h.id !== horario.id))
    setReservando(null)
  }

  function formatarDataHora(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const diaHojeKey = CHAVE_DIA[new Date().getDay()]
  const hojeH = horarios[diaHojeKey]

  const hojeAberto = () => {
    if (!hojeH || !hojeH.ativo) return false
    const agora = new Date()
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
    const noManha = hojeH.manha_inicio && hojeH.manha_fim && horaAtual >= hojeH.manha_inicio && horaAtual <= hojeH.manha_fim
    const naTarde = hojeH.tarde_inicio && hojeH.tarde_fim && horaAtual >= hojeH.tarde_inicio && horaAtual <= hojeH.tarde_fim
    return noManha || naTarde
  }

  const gruposVagos: Record<string, any[]> = {}
  vagos.forEach(h => {
    const dia = new Date(h.data_hora).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!gruposVagos[dia]) gruposVagos[dia] = []
    gruposVagos[dia].push(h)
  })

  const aberto = hojeAberto()

  if (loading || carregando) return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Horários</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-4 animate-pulse h-20" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28 relative">
      <div className="px-4 pt-12 pb-4 flex items-center justify-between" style={{ backgroundColor: cor }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
          <h1 className="font-bold text-white text-lg">Horários</h1>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100 flex sticky top-0 z-10 shadow-sm">
        <button onClick={() => setAba('vagas')}
          className={'flex-1 py-3 text-sm font-semibold transition-all ' + (aba === 'vagas' ? 'border-b-2' : 'text-gray-400')}
          style={aba === 'vagas' ? { color: cor, borderColor: cor } : {}}>
          Vagas {vagos.length > 0 && `(${vagos.length})`}
        </button>
        <button onClick={() => setAba('funcionamento')}
          className={'flex-1 py-3 text-sm font-semibold transition-all ' + (aba === 'funcionamento' ? 'border-b-2' : 'text-gray-400')}
          style={aba === 'funcionamento' ? { color: cor, borderColor: cor } : {}}>
          Funcionamento
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* Botão de Agendar Novo Horário em destaque */}
        <div 
          onClick={() => setModalAgendar(true)}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer transition-transform active:scale-98">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cor}15` }}>
              <Clock size={20} style={{ color: cor }} />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Agendar novo horário</p>
              <p className="text-xs text-gray-400">Escolha serviços, data e período preferido</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
            <Plus size={16} />
          </div>
        </div>

        {/* ABA VAGAS */}
        {aba === 'vagas' && (
          vagos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${cor}15` }}>
                <Clock size={20} style={{ color: cor }} />
              </div>
              <p className="text-gray-500 text-sm font-medium">Nenhuma vaga disponível agora</p>
              <p className="text-gray-400 text-xs text-center leading-relaxed">
                Quando o salão liberar horários, eles aparecem aqui para você reservar
              </p>
            </div>
          ) : (
            Object.entries(gruposVagos).map(([dia, hrs]) => (
              <div key={dia} className="flex flex-col gap-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">{dia}</p>
                {hrs.map(h => {
                  const jaReservado = reservados.has(h.id)
                  return (
                    <div key={h.id} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cor}15` }}>
                        <span className="font-bold text-sm" style={{ color: cor }}>
                          {new Date(h.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {h.profiles?.nome && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <User size={11} />{h.profiles.nome}
                          </p>
                        )}
                        {h.observacao && (
                          <p className="text-xs text-gray-500 mt-0.5">{h.observacao}</p>
                        )}
                        <p className="text-xs text-gray-300">{formatarDuracao(h.duracao_minutos)}</p>
                      </div>
                      {jaReservado ? (
                        <div className="flex items-center gap-1 text-green-500 shrink-0">
                          <CheckCircle size={16} />
                          <span className="text-xs font-semibold">Reservado!</span>
                        </div>
                      ) : (
                        <button onClick={() => reservarHorario(h)} disabled={reservando === h.id}
                          className="px-4 py-2 rounded-xl text-white text-sm font-bold shrink-0 active:scale-95 transition-all"
                          style={{ backgroundColor: cor }}>
                          {reservando === h.id
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : 'Reservar'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )
        )}

        {/* ABA FUNCIONAMENTO */}
        {aba === 'funcionamento' && (
          <>
            {hojeH && (
              <div className={'rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm ' +
                (aberto ? 'bg-green-50 border border-green-100' : 'bg-white border border-gray-100')}>
                {aberto
                  ? <CheckCircle size={20} className="text-green-500 shrink-0" />
                  : <XCircle size={20} className="text-gray-300 shrink-0" />}
                <div>
                  <p className={'font-bold ' + (aberto ? 'text-green-700' : 'text-gray-400')}>
                    {aberto ? 'Aberto agora' : !hojeH.ativo ? 'Fechado hoje' : 'Fora do horário'}
                  </p>
                  {hojeH.ativo && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {hojeH.manha_inicio && hojeH.manha_fim &&
                        `${hojeH.tarde_inicio ? 'Manhã: ' : ''}${hojeH.manha_inicio} – ${hojeH.manha_fim}`}
                      {hojeH.tarde_inicio && hojeH.tarde_fim &&
                        `  •  Tarde: ${hojeH.tarde_inicio} – ${hojeH.tarde_fim}`}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {DIAS.map(({ key, label, abrev }, i) => {
                const h = horarios[key]
                const ehHoje = key === diaHojeKey
                return (
                  <div key={key}
                    className={'flex items-start gap-3 px-4 py-3 ' + (i < DIAS.length - 1 ? 'border-b border-gray-50' : '')}
                    style={ehHoje ? { backgroundColor: `${cor}08` } : {}}>
                    <div className={'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ' +
                      (ehHoje ? 'text-white' : 'text-gray-400 bg-gray-50')}
                      style={ehHoje ? { backgroundColor: cor } : {}}>
                      {abrev}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className={'text-sm font-semibold ' + (ehHoje ? 'text-gray-900' : 'text-gray-700')}>
                        {label}{ehHoje && <span className="text-xs font-normal text-gray-400"> (hoje)</span>}
                      </p>
                      {!h || !h.ativo ? (
                        <p className="text-xs text-gray-300 mt-0.5">Fechado</p>
                      ) : (
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          {h.manha_inicio && h.manha_fim && (
                            <p className="text-xs text-gray-500">
                              {h.tarde_inicio ? 'Manhã: ' : ''}{h.manha_inicio} – {h.manha_fim}
                            </p>
                          )}
                          {h.tarde_inicio && h.tarde_fim && (
                            <p className="text-xs text-gray-500">Tarde: {h.tarde_inicio} – {h.tarde_fim}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="pt-2">
                      <div className={'w-2 h-2 rounded-full ' + (h?.ativo ? 'bg-green-400' : 'bg-gray-200')} />
                    </div>
                  </div>
                )
              })}
            </div>

            {salao?.telefone && (
              <a href={`https://wa.me/55${salao.telefone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-medium text-sm"
                style={{ backgroundColor: cor }}>
                Falar no WhatsApp
              </a>
            )}
          </>
        )}
      </div>

      {/* Botão flutuante para agendar */}
      <div className="fixed bottom-6 right-6 z-20">
        <button
          onClick={() => setModalAgendar(true)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full text-white font-bold text-sm shadow-xl transition-transform active:scale-95"
          style={{ backgroundColor: cor }}>
          <Plus size={18} /> Agendar Horário
        </button>
      </div>

      {/* MODAL DE AGENDAMENTO / SELEÇÃO DE SERVIÇOS E FILTRO POR CATEGORIA */}
      {modalAgendar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Novo Agendamento</h3>
              <button onClick={() => setModalAgendar(false)}><X size={22} className="text-gray-400" /></button>
            </div>

            {enviado ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: cor }}>
                  <CheckCircle size={32} className="text-white" />
                </div>
                <p className="font-bold text-gray-900 text-lg text-center">Pedido enviado!</p>
                <p className="text-gray-500 text-sm text-center">Aguarde o salão entrar em contato com os horários disponíveis.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase">1. Selecione os serviços</p>

                  {/* Filtro por Categoria */}
                  {categorias.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      <button
                        onClick={() => setCategoriaSelecionada('todos')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                          categoriaSelecionada === 'todos' ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                        }`}
                        style={categoriaSelecionada === 'todos' ? { backgroundColor: cor } : {}}
                      >
                        Todos
                      </button>
                      {categorias.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setCategoriaSelecionada(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                            categoriaSelecionada === cat ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                          }`}
                          style={categoriaSelecionada === cat ? { backgroundColor: cor } : {}}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 mt-1">
                    {servicosFiltrados.length === 0 ? (
                      <p className="text-xs text-gray-400 py-3 text-center">Nenhum serviço encontrado nesta categoria.</p>
                    ) : servicosFiltrados.map(s => {
                      const qtd = qtdCarrinho(s.id)
                      return (
                        <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-semibold text-gray-900 text-sm truncate">{s.nome}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-bold" style={{ color: cor }}>R$ {Number(s.preco).toFixed(2).replace('.', ',')}</span>
                              <span className="text-xs text-gray-400">• {formatarDuracao(s.duracao_minutos)}</span>
                            </div>
                          </div>
                          {qtd === 0 ? (
                            <button onClick={() => adicionarAoCarrinho(s)}
                              className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold shrink-0"
                              style={{ backgroundColor: cor }}>
                              Adicionar
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => removerDoCarrinho(s.id)} className="w-6 h-6 rounded-full border flex items-center justify-center" style={{ borderColor: cor }}>
                                <Minus size={12} style={{ color: cor }} />
                              </button>
                              <span className="font-bold text-gray-900 text-sm w-4 text-center">{qtd}</span>
                              <button onClick={() => adicionarAoCarrinho(s)} className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
                                <Plus size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {carrinho.length > 0 && (
                  <>
                    <div className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1.5 border border-gray-100">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Serviços selecionados: {totalItens}</span>
                        <span>Tempo: {formatarDuracao(duracaoTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-200/50">
                        <span className="font-bold text-gray-900 text-sm">Total estimado</span>
                        <span className="font-bold text-base" style={{ color: cor }}>R$ {totalCarrinho.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase">2. Dia preferido e Período</p>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Data preferida (opcional)</label>
                        <input type="date" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none"
                          style={{ borderColor: `${cor}66` }}
                          value={dataPreferida}
                          onChange={e => setDataPreferida(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Período preferido</label>
                        <div className="flex gap-2">
                          {[
                            { valor: 'qualquer', label: 'Indiferente' },
                            { valor: 'manha', label: 'Manhã' },
                            { valor: 'tarde', label: 'Tarde' },
                            { valor: 'noite', label: 'Noite' },
                          ].map(p => (
                            <button key={p.valor} type="button" onClick={() => setPeriodoPreferido(p.valor)}
                              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all border"
                              style={periodoPreferido === p.valor
                                ? { backgroundColor: cor, color: 'white', borderColor: cor }
                                : { backgroundColor: '#f3f4f6', color: '#6b7280', borderColor: 'transparent' }}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <button onClick={enviarCarrinho} disabled={enviando || carrinho.length === 0}
                  className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                  style={{ backgroundColor: cor }}>
                  {enviando ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Enviar pedido de agendamento'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
