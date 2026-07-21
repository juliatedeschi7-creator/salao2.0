'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Search, Plus, CheckCircle, X, Clock, Calendar, Repeat, HelpCircle, Pencil, RotateCcw } from 'lucide-react'

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

  // Preço personalizado por serviço: { [servicoId]: valorPersonalizado }
  const [precosPersonalizados, setPrecosPersonalizados] = useState<Record<string, number>>({})
  const [editandoPrecoId, setEditandoPrecoId] = useState<string | null>(null)
  const [tempPrecoInput, setTempPrecoInput] = useState('')

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

  // Obter preço efetivo (personalizado ou padrão de fábrica)
  function getPrecoServico(servico: any) {
    if (precosPersonalizados[servico.id] !== undefined) {
      return precosPersonalizados[servico.id]
    }
    return servico.preco || 0
  }

  // Funções para edição de preço individual
  function iniciarEdicaoPreco(s: any, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setEditandoPrecoId(s.id)
    setTempPrecoInput(getPrecoServico(s).toFixed(2))
  }

  function salvarPrecoEditado(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    const val = parseFloat(tempPrecoInput.replace(',', '.'))
    if (!isNaN(val) && val >= 0) {
      setPrecosPersonalizados(prev => ({ ...prev, [id]: val }))
    }
    setEditandoPrecoId(null)
  }

  function resetarPrecoServico(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setPrecosPersonalizados(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
    if (editandoPrecoId === id) setEditandoPrecoId(null)
  }

  // Calcular duração total e valor total com base nos preços finais
  const servicosSelecionadosInfo = servicos.filter(s => servicosSelecionados.includes(s.id))
  const duracaoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0)
  const precoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + getPrecoServico(s), 0)

  // Nomes dos serviços formatados para exibição
  const nomesServicosTexto = servicosSelecionadosInfo.length > 0
    ? servicosSelecionadosInfo.map(s => s.nome).join(', ')
    : 'este serviço'

  // Filtrar serviços por categoria e busca
  const servicosFiltrados = servicos.filter(s => {
    const matchCategoria = !categoriaFiltro || s.categoria === categoriaFiltro
    const matchBusca = s.nome.toLowerCase().includes(buscaServico.toLowerCase())
    return matchCategoria && matchBusca
  })

  // Categorias únicas
  const categorias = [...new Set(servicos.map(s => s.categoria).filter(Boolean))].sort()

  function toggleServico(id: string) {
    setServicosSelecionados(prev => {
      const nov = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
      if (!nov.includes(id)) {
        // Limpar preço personalizado se o serviço for desmarcado
        resetarPrecoServico(id)
      }
      return nov
    })
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
        valor: precoTotal,
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
        mensagem: `${nomesServicosTexto} com ${nomesProfissionais} — ${dataBase.toLocaleDateString('pt-BR')} às ${hora}.${horarioFixo ? ` Cliente Fixa (${FREQUENCIA_LABEL[frequenciaFixo]}).` : ''}`,
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

  if (sucesso) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-6">
      <div className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ backgroundColor: cor }}>
        <CheckCircle size={40} className="text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Agendamento criado!</h2>
      <p className="text-gray-500 text-center text-sm">
        {horarioFixo
          ? `${OCORRENCIAS_POR_FREQUENCIA[frequenciaFixo]} datas recorrentes (${FREQUENCIA_LABEL[frequenciaFixo]}) reservadas com sucesso!`
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
        setPrecosPersonalizados({})
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
                const precoEfetivo = getPrecoServico(s)
                const foiEditado = precosPersonalizados[s.id] !== undefined
                const estaEditando = editandoPrecoId === s.id

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
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        {s.categoria && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{s.categoria}</span>}
                        <Clock size={12} />
                        <span>{s.duracao_minutos} min</span>
                        <span>•</span>

                        {/* Campo ou exibições de preço individual */}
                        {estaEditando ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <span className="font-semibold text-gray-700">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              autoFocus
                              className="w-20 px-1.5 py-0.5 text-xs font-bold border border-pink-400 rounded bg-white text-gray-900 focus:outline-none"
                              value={tempPrecoInput}
                              onChange={e => setTempPrecoInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') salvarPrecoEditado(s.id, e as any)
                              }}
                            />
                            <button
                              type="button"
                              onClick={e => salvarPrecoEditado(s.id, e)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Confirmar valor"
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setEditandoPrecoId(null) }}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={foiEditado ? 'font-bold text-pink-600' : ''}>
                              R$ {precoEfetivo.toFixed(2)}
                            </span>
                            {foiEditado && (
                              <span className="text-[10px] bg-pink-100 text-pink-700 px-1 rounded font-medium">Editado</span>
                            )}
                            <button
                              type="button"
                              onClick={e => iniciarEdicaoPreco(s, e)}
                              className="p-1 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded transition-all ml-1"
                              title="Editar preço deste serviço"
                            >
                              <Pencil size={13} />
                            </button>
                            {foiEditado && (
                              <button
                                type="button"
                                onClick={e => resetarPrecoServico(s.id, e)}
                                className="p-1 text-gray-400 hover:text-red-500 rounded"
                                title={`Restaurar valor padrão (R$ ${s.preco.toFixed(2)})`}
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              <p className="text-center text-gray-400 text-sm py-4">Nenhum serviço encontrado</p>
            )}
          </div>

          {/* Resumo detalhado por serviço selecionado */}
          {servicosSelecionados.length > 0 && (
            <div className="mt-3 p-3.5 bg-blue-50/80 rounded-2xl border border-blue-100 flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-blue-100">
                <p className="text-xs font-semibold text-blue-900">Resumo dos Serviços Selecionados</p>
                <p className="text-xs text-blue-700 font-medium">Duração: {formatarDuracao(duracaoTotal)}</p>
              </div>

              {/* Lista das linhas dos serviços com editar */}
              <div className="space-y-1.5 py-1">
                {servicosSelecionadosInfo.map(s => {
                  const precoEfetivo = getPrecoServico(s)
                  const foiEditado = precosPersonalizados[s.id] !== undefined
                  const estaEditando = editandoPrecoId === s.id

                  return (
                    <div key={s.id} className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded-lg border border-blue-100/60">
                      <span className="font-medium text-gray-800 flex-1 truncate pr-2">{s.nome}</span>

                      {estaEditando ? (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-gray-700">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            autoFocus
                            className="w-16 px-1 py-0.5 text-xs font-bold border border-pink-400 rounded bg-white text-gray-900 focus:outline-none"
                            value={tempPrecoInput}
                            onChange={e => setTempPrecoInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') salvarPrecoEditado(s.id)
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => salvarPrecoEditado(s.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Salvar"
                          >
                            <CheckCircle size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditandoPrecoId(null)}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                            title="Cancelar"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`font-semibold ${foiEditado ? 'text-pink-600' : 'text-gray-900'}`}>
                            R$ {precoEfetivo.toFixed(2)}
                          </span>
                          {foiEditado && (
                            <span className="text-[10px] text-gray-400 line-through">
                              (R$ {s.preco.toFixed(2)})
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoPreco(s)}
                            className="p-1 text-blue-600 hover:bg-blue-100/50 rounded transition-all"
                            title="Editar preço deste serviço"
                          >
                            <Pencil size={12} />
                          </button>
                          {foiEditado && (
                            <button
                              type="button"
                              onClick={() => resetarPrecoServico(s.id)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded"
                              title="Restaurar valor padrão"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Valor Total Final Somado */}
              <div className="flex items-center justify-between pt-2 border-t border-blue-100">
                <span className="text-xs font-semibold text-gray-700">Valor Total Final:</span>
                <span className="text-base font-bold text-gray-900" style={{ color: cor }}>
                  R$ {precoTotal.toFixed(2)}
                </span>
              </div>
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

        {/* Fixar Cliente / Horário Fixo com Pergunta de Frequência do Serviço */}
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
            <button type="button" onClick={() => setHorarioFixo(!horarioFixo)}
              className={`w-12 h-6 rounded-full transition-all ${horarioFixo ? 'bg-[#E91E8C]' : 'bg-gray-200'}`}
              style={horarioFixo ? { backgroundColor: cor } : {}}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-all mx-0.5 ${horarioFixo ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {horarioFixo && (
            <div className="flex flex-col gap-3 pt-3 border-t border-gray-100">
              {/* Caixa de Pergunta Específica do Serviço */}
              <div className="p-3 bg-pink-50/60 rounded-xl border border-pink-100 flex flex-col gap-1">
                <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <HelpCircle size={14} style={{ color: cor }} />
                  Com qual frequência {clienteSelecionado ? clienteSelecionado.nome.split(' ')[0] : 'a cliente'} faz{' '}
                  <span className="font-bold underline" style={{ color: cor }}>
                    {nomesServicosTexto}
                  </span>?
                </p>
                <p className="text-[11px] text-gray-500">
                  Selecione o intervalo habitual em que este serviço se repete.
                </p>
              </div>

              {/* Botões de Frequência */}
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FREQUENCIA_LABEL) as FrequenciaFixo[]).map(freq => (
                  <button key={freq} type="button" onClick={() => setFrequenciaFixo(freq)}
                    className="py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center gap-0.5"
                    style={frequenciaFixo === freq
                      ? { borderColor: cor, backgroundColor: `${cor}10`, color: cor }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    <span>{FREQUENCIA_LABEL[freq]}</span>
                    <span className="text-[10px] opacity-75">({OCORRENCIAS_POR_FREQUENCIA[freq]} datas)</span>
                  </button>
                ))}
              </div>

              {/* Nota explicativa de flexibilidade de serviço */}
              <p className="text-xs text-gray-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200/70 leading-relaxed">
                💡 <strong>Nota:</strong> Como os serviços podem mudar a cada visita, estas datas serão reservadas com <strong>{nomesServicosTexto}</strong> como sugestão. Você poderá trocar o serviço ou alterar o valor em cada dia de atendimento.
              </p>

              {/* Prévia das Datas Geradas */}
              {previasDatas.length > 0 && (
                <div className="mt-1 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1">
                    <Calendar size={14} style={{ color: cor }} />
                    Próximas datas de {nomesServicosTexto}:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-600">
                    {previasDatas.map((d, index) => (
                      <div key={index} className="bg-white px-2 py-1.5 rounded-lg border border-gray-200 flex justify-between">
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
            placeholder="Alergias, pouca quantidade de cabelo, preferência de produto..."
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
            : <><CheckCircle size={18} />Confirmar Agendamento (R$ {precoTotal.toFixed(2)})</>}
        </button>
      </div>
    </div>
  )
}
