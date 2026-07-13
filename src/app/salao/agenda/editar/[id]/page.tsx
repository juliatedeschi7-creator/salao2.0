'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, CheckCircle, X, Clock, AlertCircle, Trash2 } from 'lucide-react'

export default function EditarAgendamentoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const agendamentoId = params.id as string

  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [agendamento, setAgendamento] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

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

  // Modal de exclusão
  const [mostrarModalExclusao, setMostrarModalExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) {
      carregarDados()
    }
  }, [loading])

  useEffect(() => {
    if (clientes.length > 0 && servicos.length > 0 && profissionais.length > 0) {
      carregarAgendamento()
    }
  }, [clientes, servicos, profissionais])

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

  async function carregarAgendamento() {
    const { data: agend, error } = await supabase.from('agendamentos')
      .select('*').eq('id', agendamentoId).single()

    if (error || !agend) {
      setErro('Agendamento não encontrado.')
      setCarregando(false)
      return
    }

    setAgendamento(agend)
    
    // Preencher os campos
    const cliente = clientes.find(c => c.id === agend.cliente_id)
    setClienteSelecionado(cliente)
    
    setServicosSelecionados(agend.servicos_ids || [agend.servico_id])
    setProfissionaisSelecionados(agend.profissionais_ids || [agend.profissional_id])
    
    const [dataPart] = agend.data_hora.split('T')
    const horaMin = agend.data_hora.split('T')[1].substring(0, 5)
    
    setData(dataPart)
    setHora(horaMin)
    setHorarioFixo(agend.horario_fixo || false)
    setObservacoes(agend.observacoes || '')
    setCarregando(false)
  }

  const servicosSelecionadosInfo = servicos.filter(s => servicosSelecionados.includes(s.id))
  const duracaoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0)
  const precoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + (s.preco || 0), 0)

  const servicosFiltrados = servicos.filter(s => {
    const matchCategoria = !categoriaFiltro || s.categoria === categoriaFiltro
    const matchBusca = s.nome.toLowerCase().includes(buscaServico.toLowerCase())
    return matchCategoria && matchBusca
  })

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
      setErro('Selecione um cliente.')
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

    try {
      const dataHora = new Date(`${data}T${hora}:00`)
      const primeiroServico = servicosSelecionados[0]

      const { error } = await supabase.from('agendamentos')
        .update({
          cliente_id: clienteSelecionado.id,
          servico_id: primeiroServico,
          servicos_ids: servicosSelecionados,
          profissional_id: profissionaisSelecionados[0],
          profissionais_ids: profissionaisSelecionados,
          data_hora: dataHora.toISOString(),
          duracao_minutos: duracaoTotal,
          observacoes: observacoes || null,
          horario_fixo: horarioFixo,
        })
        .eq('id', agendamentoId)

      if (error) {
        console.error('Erro Supabase:', error)
        setErro(`Erro ao atualizar: ${error.message}`)
        setSalvando(false)
        return
      }

      setSucesso(true)
      setSalvando(false)
      setTimeout(() => router.push('/salao/agenda'), 1500)
    } catch (err) {
      console.error('Erro:', err)
      setErro('Erro ao atualizar agendamento.')
      setSalvando(false)
    }
  }

  async function handleExcluir() {
    setExcluindo(true)
    setErro('')

    try {
      const { error } = await supabase.from('agendamentos')
        .delete()
        .eq('id', agendamentoId)

      if (error) {
        console.error('Erro ao deletar:', error)
        setErro('Erro ao excluir agendamento.')
        setExcluindo(false)
        return
      }

      // Notificar cliente sobre cancelamento
      if (clienteSelecionado?.profile_id) {
        await supabase.from('notificacoes').insert({
          salao_id: profile!.salao_id,
          remetente_id: profile!.id,
          destinatario_id: clienteSelecionado.profile_id,
          titulo: '❌ Agendamento cancelado',
          mensagem: `Seu agendamento de ${servicosSelecionadosInfo.map(s => s.nome).join(', ')} foi cancelado.`,
          tipo: 'lembrete'
        })
      }

      setExcluindo(false)
      router.push('/salao/agenda')
    } catch (err) {
      console.error('Erro:', err)
      setErro('Erro ao excluir agendamento.')
      setExcluindo(false)
    }
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase())
  )

  const cor = salao?.cor_primaria || '#E91E8C'
  const profissionaisSelecionadosInfo = profissionais.filter(p => profissionaisSelecionados.includes(p.id))

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#f8f4f6] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: cor }}>
          <CheckCircle size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Agendamento atualizado!</h2>
        <p className="text-gray-500 text-center">Redirecionando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f4f6]">
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-lg">Editar Agendamento</h1>
        </div>
        <button 
          onClick={() => setMostrarModalExclusao(true)}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 size={20} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 pb-8">
        {/* Cliente */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">CLIENTE</label>
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
                <input className="input-field pl-11" placeholder="Buscar cliente..."
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Serviços */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            SERVIÇOS ({servicosSelecionados.length})
          </label>
          
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

          {categorias.length > 0 && (
            <div className="mb-3 flex gap-2 flex-wrap">
              <button
                onClick={() => setCategoriaFiltro(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  categoriaFiltro === null
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-700'
                }`}
              >
                Todas
              </button>
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    categoriaFiltro === cat ? 'text-white' : 'bg-white border border-gray-200 text-gray-700'
                  }`}
                  style={categoriaFiltro === cat ? { backgroundColor: cor } : {}}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {servicosFiltrados.map(s => {
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
            })}
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

        {/* Profissionais */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            PROFISSIONAIS ({profissionaisSelecionados.length})
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
            : <>Salvar Alterações</>}
        </button>
      </div>

      {/* Modal de Exclusão */}
      {mostrarModalExclusao && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Cancelar agendamento?</h3>
                <p className="text-sm text-gray-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleExcluir}
                disabled={excluindo}
                className="w-full py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
                {excluindo ? 'Cancelando...' : 'Sim, cancelar agendamento'}
              </button>
              <button
                onClick={() => setMostrarModalExclusao(false)}
                className="w-full py-3 bg-gray-100 text-gray-900 font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                Não, voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
