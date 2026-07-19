'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Plus, CheckCircle, X, Clock, ChevronDown } from 'lucide-react'

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
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')
  
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

  // Calcular duração total e preço total dos serviços selecionados
  const servicosSelecionadosInfo = servicos.filter(s => servicosSelecionados.includes(s.id))
  const duracaoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0)
  const precoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + (s.preco || 0), 0)

  // Filtrar serviços por categoria e busca
  const servicosFiltrados = servicos.filter(s => {
    const matchCategoria = !categoriaFiltro || s.categoria === categoriaFiltro
    const matchBusca = s.nome.toLowerCase().includes(buscaServico.toLowerCase())
    return matchCategoria && matchBusca
  })

  // Obter categorias únicas
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

    const dataHora = new Date(`${data}T${hora}:00`)
    const primeiroServico = servicosSelecionados[0]

    // Inserir agendamento com múltiplos serviços e profissionais
    const { error } = await supabase.from('agendamentos').insert({
      salao_id: profile!.salao_id,
      cliente_id: clienteSelecionado.id,
      servico_id: primeiroServico,
      servicos_ids: servicosSelecionados,
      profissional_id: profissionaisSelecionados[0],
      profissionais_ids: profissionaisSelecionados,
      data_hora: dataHora.toISOString(),
      duracao_minutos: duracaoTotal,
      duracao_total_minutos: duracaoTotal,
      status: 'confirmado',
      valor: precoTotal,
      observacoes: observacoes || null,
      horario_fixo: horarioFixo,
      criado_por: profile!.id,
    })

    if (error) {
      setErro('Erro ao salvar agendamento.')
      setSalvando(false)
      return
    }

    // Notificar cliente
    const nomesServicos = servicosSelecionadosInfo.map(s => s.nome).join(', ')
    const nomesProfissionais = profissionais
      .filter(p => profissionaisSelecionados.includes(p.id))
      .map(p => p.nome)
      .join(', ')

await notificar({
  salaoId: profile!.salao_id,
  remetenteId: profile!.id,
  destinatarioId: clienteSelecionado.profile_id,
  titulo: 'Agendamento confirmado!',
  mensagem: `${nomesServicos} com ${nomesProfissionais} — ${dataHora.toLocaleDateString('pt-BR')} às ${hora}.`,
  tipo: 'lembrete',
  url: '/cliente/agendamentos'
})

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
      <p className="text-gray-500 text-center">
        Cliente notificado com sucesso.
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
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input-field pl-11" placeholder="Buscar ou selecionar cliente..."
                  value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} />
              </div>
              {buscaCliente && (
                <div className="bg-white rounded-2xl shadow-lg mt-1 overflow-hidden">
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

        {/* Serviços - Multi-seleção com Filtro e Busca */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            SERVIÇOS ({servicosSelecionados.length} selecionado{servicosSelecionados.length !== 1 ? 's' : ''})
          </label>
          
          {/* Busca de Serviços */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              className="input-field pl-10 text-sm"
              placeholder="Buscar serviço..."
              value={buscaServico}
              onChange={e => setBuscaServico(e.target.value)}
            />
          </div>

          {/* Filtro por Categoria */}
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

          {/* Lista de Serviços Filtrados */}
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

          {servicosSelecionados.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs text-gray-600 mb-1">Resumo:</p>
              <p className="text-sm font-semibold text-gray-900">
                Duração total: {formatarDuracao(duracaoTotal)}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                Valor total: R$ {precoTotal.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Profissionais - Multi-seleção */}
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
          {profissionaisSelecionados.length > 0 && (
            <div className="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-xs text-gray-600 mb-1">Profissionais selecionados:</p>
              <div className="flex flex-wrap gap-2">
                {profissionaisSelecionadosInfo.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-2 px-2 py-1 bg-white rounded-lg text-xs font-medium text-gray-900 border" style={{ borderColor: cor }}>
                    {p.nome}
                    <button onClick={() => toggleProfissional(p.id)} className="text-gray-400 hover:text-gray-600">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Data e hora */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">DATA</label>
            <input type="date" className="input-field"
              value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">HORÁRIO</label>
            <input type="time" className="input-field"
              value={hora} onChange={e => setHora(e.target.value)} />
          </div>
        </div>

        {/* Horário fixo */}
        <div className="card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
              <CheckCircle size={18} style={{ color: cor }} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Horário Fixo</p>
              <p className="text-xs text-gray-400">Repetir agendamento semanalmente</p>
            </div>
          </div>
          <button onClick={() => setHorarioFixo(!horarioFixo)}
            className={`w-12 h-6 rounded-full transition-all ${horarioFixo ? 'bg-[#E91E8C]' : 'bg-gray-200'}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-all mx-0.5 ${horarioFixo ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        {/* Observações */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">OBSERVAÇÕES</label>
          <textarea className="input-field resize-none" rows={3}
            placeholder="Alergias, preferência de cor..."
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
            : <><CheckCircle size={18} />Confirmar Agendamento</>}
        </button>
      </div>
    </div>
  )
}
