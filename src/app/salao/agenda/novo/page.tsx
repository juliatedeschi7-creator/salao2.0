'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Plus, CheckCircle } from 'lucide-react'

export default function NovoAgendamentoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null)
  const [servicoId, setServicoId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [horarioFixo, setHorarioFixo] = useState(false)
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

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

  async function handleSalvar() {
    if (!clienteSelecionado || !servicoId || !profissionalId || !data || !hora) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    setSalvando(true)
    setErro('')

    const servico = servicos.find(s => s.id === servicoId)
    const dataHora = new Date(`${data}T${hora}:00`)

    const { error } = await supabase.from('agendamentos').insert({
      salao_id: profile!.salao_id,
      cliente_id: clienteSelecionado.id,
      servico_id: servicoId,
      profissional_id: profissionalId,
      data_hora: dataHora.toISOString(),
      duracao_minutos: servico?.duracao_minutos || 60,
      status: 'confirmado',
      valor: servico?.preco || 0,
      observacoes: observacoes || null,
      horario_fixo: horarioFixo,
      criado_por: profile!.id,
    })

    if (error) {
      setErro('Erro ao salvar agendamento.')
      setSalvando(false)
      return
    }

    await supabase.from('notificacoes').insert({
      salao_id: profile!.salao_id,
      remetente_id: profile!.id,
      destinatario_id: clienteSelecionado.profile_id,
      titulo: 'Agendamento confirmado!',
      mensagem: `Seu agendamento de ${servico?.nome} foi confirmado para ${dataHora.toLocaleDateString('pt-BR')} às ${hora}.`,
      tipo: 'lembrete'
    })

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
      <p className="text-gray-500 text-center">
        Cliente notificado com sucesso.
      </p>
      <button onClick={() => router.push('/salao/agenda')}
        className="btn-primary" style={{ backgroundColor: cor }}>
        Ver Agenda
      </button>
      <button onClick={() => { setSucesso(false); setClienteSelecionado(null); setServicoId(''); setProfissionalId(''); setData(''); setHora('') }}
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

        {/* Serviço */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">SERVIÇO</label>
          <select className="input-field" value={servicoId}
            onChange={e => setServicoId(e.target.value)}>
            <option value="">Selecione o serviço...</option>
            {servicos.map(s => (
              <option key={s.id} value={s.id}>
                {s.nome} — R$ {s.preco.toFixed(2)} ({s.duracao_minutos}min)
              </option>
            ))}
          </select>
        </div>

        {/* Profissional */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">PROFISSIONAL</label>
          <select className="input-field" value={profissionalId}
            onChange={e => setProfissionalId(e.target.value)}>
            <option value="">Quem irá atender?</option>
            {profissionais.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
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
