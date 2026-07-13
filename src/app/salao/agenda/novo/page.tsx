'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Plus, X, Clock, Check } from 'lucide-react'

export default function NovoAgendamentoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    cliente_id: '',
    servicosSelecionados: [] as string[],
    profissional_id: '',
    data: '',
    hora: '',
    horario_fixo: false,
    observacoes: ''
  })

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: clis } = await supabase.from('clientes').select('id, nome, email').eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(clis || [])

    const { data: srvs } = await supabase.from('servicos').select('id, nome, duracao_minutos, preco, categoria').eq('salao_id', profile!.salao_id!).eq('ativo', true).order('categoria')
    setServicos(srvs || [])

    const { data: profs } = await supabase.from('profiles').select('id, nome').eq('salao_id', profile!.salao_id!).eq('ativo', true)
    setProfissionais(profs || [])
  }

  function toggleServico(id: string) {
    setForm(p => {
      const jaTem = p.servicosSelecionados.includes(id)
      return {
        ...p,
        servicosSelecionados: jaTem
          ? p.servicosSelecionados.filter(s => s !== id)
          : [...p.servicosSelecionados, id]
      }
    })
  }

  const servicosSelecionadosInfo = servicos.filter(s => form.servicosSelecionados.includes(s.id))
  const duracaoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0)
  const precoTotal = servicosSelecionadosInfo.reduce((acc, s) => acc + (s.preco || 0), 0)

  function formatarDuracao(min: number) {
    if (min < 60) return `${min} min`
    const h = Math.floor(min / 60), m = min % 60
    return m === 0 ? `${h}h` : `${h}h ${m}min`
  }

  async function salvar() {
    setErro('')
    if (!form.cliente_id) { setErro('Selecione a cliente.'); return }
    if (form.servicosSelecionados.length === 0) { setErro('Selecione pelo menos um serviço.'); return }
    if (!form.data || !form.hora) { setErro('Informe data e horário.'); return }

    setSalvando(true)

    const dataHora = new Date(`${form.data}T${form.hora}:00`)
    const primeiroServico = form.servicosSelecionados[0]

    const { error } = await supabase.from('agendamentos').insert({
      salao_id: profile!.salao_id,
      cliente_id: form.cliente_id,
      servico_id: primeiroServico,
      servicos_ids: form.servicosSelecionados,
      profissional_id: form.profissional_id || null,
      data_hora: dataHora.toISOString(),
      duracao_minutos: duracaoTotal,
      duracao_total_minutos: duracaoTotal,
      status: 'confirmado',
      horario_fixo: form.horario_fixo,
      observacoes: form.observacoes || null
    })

    if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return }

    // Notifica a cliente
    const cliente = clientes.find(c => c.id === form.cliente_id)
    const { data: clienteProfile } = await supabase.from('clientes')
      .select('profile_id').eq('id', form.cliente_id).single()

    if (clienteProfile?.profile_id) {
      const nomesServicos = servicosSelecionadosInfo.map(s => s.nome).join(', ')
      await supabase.from('notificacoes').insert({
        salao_id: profile!.salao_id,
        remetente_id: profile!.id,
        destinatario_id: clienteProfile.profile_id,
        titulo: '📅 Novo agendamento confirmado!',
        mensagem: `${nomesServicos} — ${dataHora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} às ${form.hora}`,
        tipo: 'agendamento'
      })
    }

    setSalvando(false)
    router.back()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const categorias = [...new Set(servicos.map(s => s.categoria).filter(Boolean))]

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Novo Agendamento</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* CLIENTE */}
        <div className="card flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</label>
          <select className="input-field" value={form.cliente_id}
            onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))}>
            <option value="">Selecione a cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {/* SERVIÇOS — multi-seleção */}
        <div className="card flex flex-col gap-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Serviços ({form.servicosSelecionados.length} selecionado{form.servicosSelecionados.length !== 1 ? 's' : ''})
          </label>

          {categorias.map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">{cat}</p>
              <div className="flex flex-col gap-2">
                {servicos.filter(s => s.categoria === cat).map(s => {
                  const selecionado = form.servicosSelecionados.includes(s.id)
                  return (
                    <button key={s.id} onClick={() => toggleServico(s.id)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-all text-left"
                      style={selecionado
                        ? { borderColor: cor, backgroundColor: `${cor}10` }
                        : { borderColor: '#e5e7eb', backgroundColor: 'white' }}>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={selecionado
                          ? { borderColor: cor, backgroundColor: cor }
                          : { borderColor: '#d1d5db' }}>
                        {selecionado && <Check size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{s.nome}</p>
                        <div
