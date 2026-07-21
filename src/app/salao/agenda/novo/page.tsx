'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Search, Plus, CheckCircle, X, Clock, Calendar, Repeat, DollarSign } from 'lucide-react'

type FrequenciaFixo = 'semanal' | 'quinzenal' | 'dias21' | 'mensal'

const FREQUENCIA_LABEL: Record<FrequenciaFixo, string> = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  dias21: 'A cada 21 dias',
  mensal: 'Mensal',
}

const OCORRENCIAS_POR_FREQUENCIA: Record<FrequenciaFixo, number> = {
  semanal: 8,
  quinzenal: 4,
  dias21: 3,
  mensal: 3,
}

export default function NovoAgendamentoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null)
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([])
  const [profissionaisSelecionados, setProfissionaisSelecionados] = useState<string[]>([])
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [horarioFixo, setHorarioFixo] = useState(false)
  const [frequenciaFixo, setFrequenciaFixo] = useState<FrequenciaFixo>('semanal')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  // Preço personalizado
  const [usarPrecoPersonalizado, setUsarPrecoPersonalizado] = useState(false)
  const [precoPersonalizado, setPrecoPersonalizado] = useState('')

  // Filtro e busca de serviços
  const [buscaServico, setBuscaServico] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*')
      .eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: cli } = await supabase.from('clientes').select('*')
      .eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(cli || [])

    const { data: srv } = await supabase.from('servicos').select('*')
      .eq('salao_id', profile!.salao_id!).eq('ativo', true).order('nome')
    setServicos(srv || [])

    const { data: prof } = await supabase.from('profiles').select('*')
      .eq('salao_id', profile!.salao_id!)
      .in('role', ['dono_salao', 'funcionario'])
    setProfissionais(prof || [])
  }

  // Calcular duração total e preço total padrão
  const servicosSelecionadosInfo = servicos.filter(s => servicosSelecionados.includes(s.id))
  const duracaoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0)
  const precoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + (s.preco || 0), 0)

  // Valor final que será gravado no agendamento
  const valorFinal = usarPrecoPersonalizado
    ? (parseFloat(precoPersonalizado.replace(',', '.')) || 0)
    : precoTotal

  // Filtrar serviços por categoria e busca
  const servicosFiltrados = servicos.filter(s => {
    const matchCategoria = !categoriaFiltro || s.categoria === categoriaFiltro
    const matchBusca = s.nome.toLowerCase().includes(buscaServico.toLowerCase())
    return matchCategoria && matchBusca
  })

  // Categorias únicas
  const categorias = [...new Set(servicos.map(s => s.categoria).filter(Boolean))].sort()

  function toggleServico(id: string) {
    setServicosSelecionados(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  function toggleProfissional(id: string) {
    setProfissionaisSelecionados(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function formatarDuracao(min: number) {
    if (min < 60) return `${min} min`
    const h = Math.floor(min / 60)
    const m = min % 60
    return m === 0 ? `${h}h` : `${h}h ${m}min`
  }

  // Calcula a data de cada ocorrência futura
  function calcularDataOcorrencia(base: Date, indice: number, frequencia: FrequenciaFixo): Date {
    const dataOcorrencia = new Date(base.getTime())
    if (frequencia === 'mensal') {
      dataOcorrencia.setMonth(dataOcorrencia.getMonth() + indice)
    } else {
      const intervaloDias = frequencia === 'quinzenal' ? 14 : frequencia === 'dias21' ? 21 : 7
      dataOcorrencia.setDate(dataOcorrencia.getDate() + (indice * intervaloDias))
    }
    return dataOcorrencia
  }

  // Prévia das datas geradas para o horário fixo
  const previasDatas = (horarioFixo && data && hora)
    ? Array.from({ length: OCORRENCIAS_POR_FREQUENCIA[frequenciaFixo] }, (_, i) => {
        const dBase = new Date(`${data}T${hora}:00`)
        return calcularDataOcorrencia(dBase, i, frequenciaFixo)
      })
    : []

  async function handleSalvar() {
    if (!clienteSelecionado) {
      setErro('Selecione uma cliente.')
      return
    }
    if (servicosSelecionados.length === 0) {
      setErro('Selecione pelo menos um serviço.')
      return
    }
    if (profissionaisSelecionados.length === 0) {
      setErro('Selecione pelo menos um profissional.')
      return
    }
    if (!data || !hora) {
      setErro('Informe data e horário.')
      return
    }

    setSalvando(true)
    setErro('')

    const primeiroServico = servicosSelecionados[0]
    const TOTAL_OCORRENCIAS = horarioFixo ? OCORRENCIAS_POR_FREQUENCIA[frequenciaFixo] : 1
    const recorrenciaId = horarioFixo ? crypto.randomUUID() : null
    const dataBase = new Date(`${data}T${hora}:00`)

    const agendamentosParaCriar = Array.from({ length: TOTAL_OCORRENCIAS }, (_, i) => {
      const dataOcorrencia = calcularDataOcorrencia(dataBase, i, frequenciaFixo)

      return {
        salao_id: profile!.salao_id,
        cliente_id: clienteSelecionado.id,
        servico_id: primeiroServico,
        servicos_ids: servicosSelecionados,
        profissional_id: profissionaisSelecionados[0],
        profissionais_ids: profissionaisSelecionados,
        data_hora: dataOcorrencia.toISOString(),
        duracao_minutos: duracaoTotal,
        duracao_total_minutos: duracaoTotal,
        status: 'confirmado',
        valor: valorFinal,
        observacoes: observacoes || null,
        horario_fixo: horarioFixo,
        recorrencia_id: recorrenciaId,
        recorrencia_frequencia: horarioFixo ? frequenciaFixo : null,
        criado_por: profile!.id,
      }
    })

    const { error } = await supabase.from('agendamentos').insert(agendamentosParaCriar)

    if (error) {
      setErro('Erro ao salvar agendamento: ' + error.message)
      setSalvando(false)
      return
    }

    // Atualiza o cadastro do cliente se for fixo
    if (horarioFixo) {
      await supabase.from('clientes').update({
        horario_fixo: true,
        frequencia_fixo: frequenciaFixo
      }).eq('id', clienteSelecionado.id)
    }

    // Notificar cliente
    const nomesServicos = servicosSelecionadosInfo.map(s => s.nome).join(', ')
    const nomesProfissionais = profissionais
      .filter(p => profissionaisSelecionados.includes(p.id))
      .map(p => p.nome)
      .join(', ')

    if (clienteSelecionado.profile_id) {
      await notificar({
        salaoId: profile!.salao_id,
        remetenteId: profile!.id,
        destinatarioId: clienteSelecionado.profile_id,
        titulo: 'Agendamento confirmado!',
        mensagem: `${nomesServicos} com ${nomesProfissionais} — ${dataBase.toLocaleDateString('pt-BR')} às ${hora}.${horarioFixo ? ` Cliente Fixa (${FREQUENCIA_LABEL[frequenciaFixo]}).` : ''}`,
        tipo: 'lembrete',
        url: '/cliente/agendamentos'
      })
    }

    setSucesso(true)
    setSalvando(false)
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase())
  )

  const cor = salao?.cor_primaria || '#E91E8C'
  const profissionaisSelecionadosInfo = profissionais.filter(p => profissionaisSelecionados.includes(p.id))

  if (sucesso) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-6">
      <div className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ backgroundColor: cor }}>
        <CheckCircle size={40} className="text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Agendamento criado!</h2>
      <p className="text-gray-500 text-center text-sm">
        {horarioFixo
          ? `${OCORRENCIAS_POR_FREQUENCIA[frequenciaFixo]} datas recorrentes (${FREQUENCIA_LABEL[frequenciaFixo]}) criadas com sucesso!`
          : 'Cliente notificado com sucesso.'}
      </p>
      <button onClick={() => router.push('/salao/agenda')}
        className="btn-primary" style={{ backgroundColor: cor }}>
        Ver Agenda
      </button>
      <button onClick={() => {
        setSucesso(false)
        setClienteSelecionado(null)
        setServicosSelecionados([])
        setProfissionaisSelecionados([])
        setData('')
        setHora('')
        setHorarioFixo(false)
        setFrequenciaFixo('semanal')
        setUsarPrecoPersonalizado(false)
        setPrecoPersonalizado('')
      }}
        className="text-sm text-gray-400">
        Criar outro agendamento
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f4f6]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg">Novo Agendamento</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 pb-8">
        {/* Cliente */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">CLIENTE</label>
            <button onClick={() => router.push('/salao/clientes/novo')}
              className="text-sm font-medium flex items-center gap-1"
              style={{ color: cor }}>
              <Plus size={14} />Novo Cliente
            </button>
          </div>
          {clienteSelecionado ? (
            <div className="card flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{clienteSelecionado.nome}</p>
                <p className="text-sm text-gray-500">{clienteSelecionado.telefone}</p>
              </div>
              <button onClick={() => setClienteSelecionado(null)}
                className="text-sm text-red-400">Trocar</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input className="input-field pl-12" placeholder="Buscar ou selecionar cliente..."
                  value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} />
              </div>
              {buscaCliente && (
                <div className="bg-white rounded-2xl shadow-lg mt-1 overflow-hidden z-10 relative">
                  {clientesFiltrados.slice(0, 5).map(c => (
                    <button key={c.id} onClick={() => { setClienteSelecionado(c); setBuscaCliente('') }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <p className="font-medium text-gray-900">{c.nome}</p>
                      <p className="text-sm text-gray-400">{c.telefone}</p>
                    </button>
                  ))}
                  {clientesFiltrados.length === 0 && (
                    <p className="px-4 py-3 text-gray-400 text-sm">Nenhum cliente encontrado</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Serviços */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            SERVIÇOS ({servicosSelecionados.length} selecionado{servicosSelecionados.length !== 1 ? 's' : ''})
          </label>

          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input-field pl-10 text-sm"
              placeholder="Buscar serviço..."
              value={buscaServico}
              onChange={e => setBuscaServico(e.target.value)}
            />
          </div>

          {categorias.length > 0 && (
            <div className="mb-3 flex gap-2 flex-wrap">
              <button
                onClick={() => setCategoriaFiltro(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  categoriaFiltro === null
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                Todas
              </button>
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    categoriaFiltro === cat
                      ? 'text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                  style={categoriaFiltro === cat ? { backgroundColor: cor } : {}}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {servicosFiltrados.length > 0 ? (
              servicosFiltrados.map(s => {
                const selecionado = servicosSelecionados.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleServico(s.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left"
                    style={selecionado
                      ? { borderColor: cor, backgroundColor: `${cor}10` }
                      : { borderColor: '#e5e7eb', backgroundColor: 'white' }}>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={selecionado
                        ? { borderColor: cor, backgroundColor: cor }
                        : { borderColor: '#d1d5db' }}>
                      {selecionado && <CheckCircle size={12} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{s.nome}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {s.categoria && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{s.categoria}</span>}
                        <Clock size={12} />
                        <span>{s.duracao_minutos} min</span>
                        <span>•</span>
                        <span>R$ {s.preco.toFixed(2)}</span>
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              <p className="text-center text-gray-400 text-sm py-4">Nenhum serviço encontrado</p>
            )}
          </div>

          {/* Resumo e Preço Personalizado */}
          {servicosSelecionados.length > 0 && (
            <div className="mt-3 p-3.5 bg-blue-50/80 rounded-2xl border border-blue-100 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-900">Resumo dos Serviços</p>
                  <p className="text-xs text-blue-700">Duração total: {formatarDuracao(duracaoTotal)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!usarPrecoPersonalizado) {
                      setPrecoPersonalizado(precoTotal.toFixed(2))
                    }
                    setUsarPrecoPersonalizado(!usarPrecoPersonalizado)
                  }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border bg-white transition-all shadow-sm"
                  style={{ color: cor, borderColor: `${cor}40` }}
                >
                  {usarPrecoPersonalizado ? 'Usar valor padrão' : 'Personalizar valor'}
                </button>
              </div>

              {usarPrecoPersonalizado ? (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-blue-100">
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <DollarSign size={13} className="text-gray-500" />
                    Valor cobrado nesta cliente (R$):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-field bg-white text-sm font-bold text-gray-900 py-1.5"
                      placeholder="0.00"
                      value={precoPersonalizado}
                      onChange={e => setPrecoPersonalizado(e.target.value)}
                    />
                    <span className="text-xs text-gray-500 shrink-0">
                      (Padrão: R$ {precoTotal.toFixed(2)})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1 border-t border-blue-100">
                  <span className="text-xs text-gray-600">Valor total:</span>
                  <span className="text-base font-bold text-gray-900">R$ {precoTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profissionais */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            PROFISSIONAIS ({profissionaisSelecionados.length} selecionado{profissionaisSelecionados.length !== 1 ? 's' : ''})
          </label>
          <div className="space-y-2">
            {profissionais.map(p => {
              const selecionado = profissionaisSelecionados.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProfissional(p.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left"
                  style={selecionado
                    ? { borderColor: cor, backgroundColor: `${cor}10` }
                    : { borderColor: '#e5e7eb', backgroundColor: 'white' }}>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={selecionado
                      ? { borderColor: cor, backgroundColor: cor }
                      : { borderColor: '#d1d5db' }}>
                    {selecionado && <CheckCircle size={12} className="text-white" />}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 flex-1">{p.nome}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Data e hora */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">DATA INICIAL</label>
            <input type="date" className="input-field"
              value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">HORÁRIO</label>
            <input type="time" className="input-field"
              value={hora} onChange={e => setHora(e.target.value)} />
          </div>
        </div>

        {/* Fixar Cliente / Horário Fixo */}
        <div className="card flex flex-col gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${cor}20` }}>
                <Repeat size={18} style={{ color: cor }} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Fixar essa cliente</p>
                <p className="text-xs text-gray-500">Agendar horários fixos recorrentes</p>
              </div>
            </div>
            <button onClick={() => setHorarioFixo(!horarioFixo)}
              className={`w-12 h-6 rounded-full transition-all ${horarioFixo ? 'bg-[#E91E8C]' : 'bg-gray-200'}`}
              style={horarioFixo ? { backgroundColor: cor } : {}}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-all mx-0.5 ${horarioFixo ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {horarioFixo && (
            <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700">Frequência da recorrência:</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FREQUENCIA_LABEL) as FrequenciaFixo[]).map(freq => (
                  <button key={freq} onClick={() => setFrequenciaFixo(freq)}
                    className="py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center gap-0.5"
                    style={frequenciaFixo === freq
                      ? { borderColor: cor, backgroundColor: `${cor}10`, color: cor }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    <span>{FREQUENCIA_LABEL[freq]}</span>
                    <span className="text-[10px] opacity-75">({OCORRENCIAS_POR_FREQUENCIA[freq]} datas)</span>
                  </button>
                ))}
              </div>

              {previasDatas.length > 0 && (
                <div className="mt-2 p-3 bg-pink-50/50 rounded-xl border border-pink-100">
                  <p className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1">
                    <Calendar size={14} style={{ color: cor }} />
                    Próximas datas que serão salvas:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-600">
                    {previasDatas.map((d, index) => (
                      <div key={index} className="bg-white px-2 py-1 rounded-lg border border-gray-100 flex justify-between">
                        <span className="font-medium text-gray-900">{index + 1}ª: {d.toLocaleDateString('pt-BR')}</span>
                        <span className="text-gray-400">{hora}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Observações */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">OBSERVAÇÕES</label>
          <textarea className="input-field resize-none" rows={3}
            placeholder="Alergias, pouca quantidade de cabelo..."
            value={observacoes} onChange={e => setObservacoes(e.target.value)} />
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}

        <button onClick={handleSalvar} disabled={salvando}
          className="btn-primary" style={{ backgroundColor: cor }}>
          {salvando
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><CheckCircle size={18} />Confirmar Agendamento (R$ {valorFinal.toFixed(2)})</>}
        </button>
      </div>
    </div>
  )
}
