'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Shield, Check, X, UserCheck, Crown, Clock, PauseCircle, PlayCircle, Calendar } from 'lucide-react'

const TODAS_AS_PERMISSOES = [
  { id: 'dashboard', nome: 'Painel / Dashboard', categoria: 'Geral', desc: 'Visão geral, métricas e estatísticas' },
  { id: 'agenda_total', nome: 'Agenda Completa (Todos)', categoria: 'Agenda', desc: 'Visualizar os horários de toda a equipe' },
  { id: 'agenda_propria', nome: 'Agenda Própria', categoria: 'Agenda', desc: 'Visualizar apenas os próprios agendamentos' },
  { id: 'clientes', nome: 'Gestão de Clientes', categoria: 'Atendimento', desc: 'Lista, cadastro e histórico de clientes' },
  { id: 'servicos', nome: 'Cadastro de Serviços', categoria: 'Configurações', desc: 'Adicionar e editar serviços, preços e durações' },
  { id: 'pacotes', nome: 'Gestão de Pacotes', categoria: 'Atendimento', desc: 'Controle de pacotes de serviços dos clientes' },
  { id: 'produtos', nome: 'Estoque / Produtos', categoria: 'Configurações', desc: 'Controle de produtos e insumos' },
  { id: 'financeiro', nome: 'Financeiro / Caixa', categoria: 'Gestão', desc: 'Relatórios de faturamento, entradas e saídas' },
  { id: 'avisos', nome: 'Avisos e Mural', categoria: 'Geral', desc: 'Visualizar recados e comunicados' },
  { id: 'funcionarios', nome: 'Gestão de Funcionários', categoria: 'Equipe', desc: 'Membros da equipe, cargos e convites' },
  { id: 'configuracoes', nome: 'Configurações do Salão', categoria: 'Configurações', desc: 'Dados da empresa e horários' },
]

const DIAS_SEMANA = [
  { id: 'seg', nome: 'Segunda-feira' },
  { id: 'ter', nome: 'Terça-feira' },
  { id: 'qua', nome: 'Quarta-feira' },
  { id: 'qui', nome: 'Quinta-feira' },
  { id: 'sex', nome: 'Sexta-feira' },
  { id: 'sab', nome: 'Sábado' },
  { id: 'dom', nome: 'Domingo' },
]

export default function FuncionariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  // Estado do Modal
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<any>(null)
  const [abaAtiva, setAbaAtiva] = useState<'cargo' | 'permissao' | 'escala' | 'ponto'>('cargo')
  
  const [cargoSelecionado, setCargoSelecionado] = useState<string>('comum')
  const [permissoesCustom, setPermissoesCustom] = useState<Record<string, boolean>>({})
  
  // Escala e Horários (Corrigido para 'boolean')
  const [escalaDias, setEscalaDias] = useState<Record<string, { ativo: boolean; entrada: string; saida: string }>>({})
  
  // Registros de Ponto e Horas Extras (tabela registro_horas)
  const [registrosPonto, setRegistrosPonto] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setCarregando(false)
    }, 3000)

    if (loading) return
    if (!profile) {
      router.push('/login')
      return
    }

    if (profile.salao_id) {
      carregarDados()
    } else {
      setCarregando(false)
    }

    return () => clearTimeout(timer)
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    try {
      const [salRes, funcRes] = await Promise.all([
        supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
        supabase
          .from('profiles')
          .select('*')
          .eq('salao_id', profile!.salao_id!)
          .neq('role', 'cliente')
          .order('nome', { ascending: true })
      ])

      setSalao(salRes.data)
      setFuncionarios(funcRes.data || [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function abrirConfiguracoes(func: any) {
    setFuncionarioSelecionado(func)
    setAbaAtiva('cargo')
    
    const cargoAtual = func.role === 'socio' || func.cargo === 'socio' ? 'socio' : 'comum'
    setCargoSelecionado(cargoAtual)

    if (func.permissoes_paginas) {
      setPermissoesCustom(func.permissoes_paginas)
    } else {
      const padrao: Record<string, boolean> = {}
      TODAS_AS_PERMISSOES.forEach(p => { padrao[p.id] = true })
      setPermissoesCustom(padrao)
    }

    // Carregar escala salva ou padrão
    if (func.escala_dias) {
      setEscalaDias(func.escala_dias)
    } else {
      const escalaPadrao: any = {}
      DIAS_SEMANA.forEach(d => {
        escalaPadrao[d.id] = { ativo: ['sab', 'dom'].includes(d.id) ? false : true, entrada: '09:00', saida: '18:00' }
      })
      setEscalaDias(escalaPadrao)
    }

    // Buscar registros de ponto da tabela registro_horas do funcionário
    const { data: pontoData } = await supabase
      .from('registro_horas')
      .select('*')
      .eq('profile_id', func.id)
      .order('created_at', { ascending: false })
      .limit(10)

    setRegistrosPonto(pontoData || [])
  }

  async function alternarStatusAtivo(func: any, e: React.MouseEvent) {
    e.stopPropagation()
    const novoStatus = func.ativo === false ? true : false
    const { error } = await supabase
      .from('profiles')
      .update({ ativo: novoStatus, atualizado_por: profile!.id })
      .eq('id', func.id)

    if (!error) {
      carregarDados()
    } else {
      alert('Erro ao alterar status: ' + error.message)
    }
  }

  async function salvarAlteracoes() {
    if (!funcionarioSelecionado || !profile) return
    setSalvando(true)

    try {
      const novasPermissoes = cargoSelecionado === 'socio'
        ? TODAS_AS_PERMISSOES.reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
        : permissoesCustom

      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: cargoSelecionado,
          cargo: cargoSelecionado,
          permissoes_paginas: novasPermissoes,
          escala_dias: escalaDias,
          atualizado_por: profile.id
        })
        .eq('id', funcionarioSelecionado.id)

      if (error) throw error

      alert('Configurações salvas com sucesso!')
      setFuncionarioSelecionado(null)
      carregarDados()
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.message || 'Tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) {
    return (
      <div className="min-h-screen pb-8 bg-[#f8f9fa]">
        <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg flex-1">Funcionários</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12 bg-[#f8f9fa]">
      <div className="bg-white px-4 py-4 flex items-center gap-2 shadow-sm sticky top-0 z-10">
        <button onClick={() => router.push('/salao')}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1 truncate">Funcionários</h1>
        
        <button 
          onClick={() => router.push('/salao/funcionarios/convidar')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-xs font-bold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Convidar
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="bg-pink-50 border border-pink-100 p-4 rounded-2xl flex items-start gap-3">
          <Shield size={20} className="text-pink-600 shrink-0 mt-0.5" />
          <div className="text-xs text-pink-900 leading-relaxed">
            <p className="font-bold mb-0.5">Gestão de Equipe e Ponto</p>
            <p className="text-pink-700">
              Clique em qualquer funcionário para configurar cargos, permissões por página, escalas de dias/horários e acompanhar o controle de ponto.
            </p>
          </div>
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">
          Equipe Cadastrada ({funcionarios.length})
        </p>

        {funcionarios.map(f => {
          const eSocio = f.role === 'socio' || f.cargo === 'socio' || f.role === 'dono'
          const estaAtivo = f.ativo !== false

          return (
            <div 
              key={f.id} 
              onClick={() => abrirConfiguracoes(f)}
              className={`bg-white p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-sm cursor-pointer transition-all ${
                estaAtivo ? 'border-gray-100 hover:border-pink-300' : 'border-red-200 bg-red-50/20 opacity-70'
              }`}>
              
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm"
                  style={{ backgroundColor: cor }}>
                  {f.nome ? f.nome.charAt(0).toUpperCase() : 'U'}
                </div>
                
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-sm truncate">{f.nome || 'Sem nome'}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${eSocio ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {eSocio ? 'Sócio / Dono' : 'Comum'}
                    </span>
                    {!estaAtivo && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                        Pausado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{f.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={(e) => alternarStatusAtivo(f, e)}
                  title={estaAtivo ? 'Pausar acesso' : 'Ativar acesso'}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                    estaAtivo ? 'bg-gray-50 text-amber-700 border-amber-200 hover:bg-amber-50' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}>
                  {estaAtivo ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                </button>
                
                <button
                  onClick={() => abrirConfiguracoes(f)}
                  className="text-xs font-semibold text-pink-600 bg-pink-50 px-3 py-1.5 rounded-xl border border-pink-100">
                  Gerenciar ➔
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL DE CONFIGURAÇÕES DO FUNCIONÁRIO */}
      {funcionarioSelecionado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Painel do Colaborador</h3>
                <p className="text-xs text-gray-500 mt-0.5">Nome: <span className="font-semibold text-gray-800">{funcionarioSelecionado.nome}</span></p>
              </div>
              <button onClick={() => setFuncionarioSelecionado(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* ABAS DO MODAL */}
            <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setAbaAtiva('cargo')} className={`py-1.5 text-xs font-bold rounded-lg transition-all ${abaAtiva === 'cargo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Cargo</button>
              <button onClick={() => setAbaAtiva('permissao')} className={`py-1.5 text-xs font-bold rounded-lg transition-all ${abaAtiva === 'permissao' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Páginas</button>
              <button onClick={() => setAbaAtiva('escala')} className={`py-1.5 text-xs font-bold rounded-lg transition-all ${abaAtiva === 'escala' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Escala</button>
              <button onClick={() => setAbaAtiva('ponto')} className={`py-1.5 text-xs font-bold rounded-lg transition-all ${abaAtiva === 'ponto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Ponto</button>
            </div>

            {/* CONTEÚDO ABA CARGO */}
            {abaAtiva === 'cargo' && (
              <div className="flex flex-col gap-3 py-2">
                <p className="text-xs font-bold text-gray-700">Selecione o Cargo</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setCargoSelecionado('comum')}
                    className={`p-3 rounded-xl border flex flex-col items-center text-center gap-1 transition-all ${cargoSelecionado === 'comum' ? 'border-pink-600 bg-pink-50/50 text-pink-900 font-bold' : 'border-gray-200 bg-white text-gray-600'}`}>
                    <UserCheck size={18} className={cargoSelecionado === 'comum' ? 'text-pink-600' : 'text-gray-400'} />
                    <span className="text-xs">Funcionário Comum</span>
                  </button>
                  <button type="button" onClick={() => setCargoSelecionado('socio')}
                    className={`p-3 rounded-xl border flex flex-col items-center text-center gap-1 transition-all ${cargoSelecionado === 'socio' ? 'border-pink-600 bg-pink-50/50 text-pink-900 font-bold' : 'border-gray-200 bg-white text-gray-600'}`}>
                    <Crown size={18} className={cargoSelecionado === 'socio' ? 'text-pink-600' : 'text-gray-400'} />
                    <span className="text-xs">Sócio / Dono</span>
                  </button>
                </div>
                {cargoSelecionado === 'socio' && (
                  <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
                    Sócio possui acesso total automático a todas as páginas do sistema.
                  </p>
                )}
              </div>
            )}

            {/* CONTEÚDO ABA PERMISSÕES */}
            {abaAtiva === 'permissao' && (
              <div className="flex flex-col gap-2 py-2">
                {cargoSelecionado === 'socio' ? (
                  <p className="text-xs text-gray-400 text-center py-6">Opção indisponível para sócios (acesso total liberado).</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
                    {TODAS_AS_PERMISSOES.map(item => {
                      const permitido = permissoesCustom[item.id] ?? true
                      return (
                        <div key={item.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-3">
                          <p className="font-bold text-gray-900 text-xs">{item.nome}</p>
                          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shrink-0">
                            <button type="button" onClick={() => setPermissoesCustom(p => ({ ...p, [item.id]: true }))}
                              className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${permitido ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>Sim</button>
                            <button type="button" onClick={() => setPermissoesCustom(p => ({ ...p, [item.id]: false }))}
                              className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${!permitido ? 'bg-red-600 text-white' : 'text-gray-400'}`}>Não</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO ABA ESCALA */}
            {abaAtiva === 'escala' && (
              <div className="flex flex-col gap-2 py-2 max-h-[42vh] overflow-y-auto pr-1">
                <p className="text-xs text-gray-500">Defina os dias trabalhados e o horário de expediente padrão:</p>
                {DIAS_SEMANA.map(d => {
                  const diaInfo = escalaDias[d.id] || { ativo: false, entrada: '09:00', saida: '18:00' }
                  return (
                    <div key={d.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-800">{d.nome}</span>
                        <button type="button" onClick={() => setEscalaDias(prev => ({ ...prev, [d.id]: { ...diaInfo, ativo: !diaInfo.ativo } }))}
                          className={`px-3 py-1 rounded-lg text-xs font-bold ${diaInfo.ativo ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {diaInfo.ativo ? 'Trabalha' : 'Folga'}
                        </button>
                      </div>
                      {diaInfo.ativo && (
                        <div className="flex items-center gap-2 pt-1 border-t border-gray-200/60">
                          <span className="text-[10px] text-gray-500">Entrada:</span>
                          <input type="time" value={diaInfo.entrada} onChange={e => setEscalaDias(prev => ({ ...prev, [d.id]: { ...diaInfo, entrada: e.target.value } }))}
                            className="p-1 bg-white border border-gray-200 rounded text-xs" />
                          <span className="text-[10px] text-gray-500 ml-2">Saída:</span>
                          <input type="time" value={diaInfo.saida} onChange={e => setEscalaDias(prev => ({ ...prev, [d.id]: { ...diaInfo, saida: e.target.value } }))}
                            className="p-1 bg-white border border-gray-200 rounded text-xs" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* CONTEÚDO ABA PONTO */}
            {abaAtiva === 'ponto' && (
              <div className="flex flex-col gap-2 py-2 max-h-[40vh] overflow-y-auto pr-1">
                <p className="text-xs text-gray-500 mb-1">Últimos registros de ponto e horas:</p>
                {registrosPonto.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Nenhum registro de ponto encontrado para este colaborador.</p>
                ) : (
                  registrosPonto.map(p => (
                    <div key={p.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-1 text-xs">
                      <div className="flex justify-between font-bold text-gray-800">
                        <span>Data: {new Date(p.created_at).toLocaleDateString()}</span>
                        <span className="text-pink-600">Total: {p.total_horas || '0h'}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 grid grid-cols-2 gap-1 mt-1">
                        <div>Entrada: <span className="font-semibold text-gray-800">{p.entrada || '--:--'}</span></div>
                        <div>Saída Almoço: <span className="font-semibold text-gray-800">{p.saida_almoco || '--:--'}</span></div>
                        <div>Volta Almoço: <span className="font-semibold text-gray-800">{p.volta_almoco || '--:--'}</span></div>
                        <div>Saída Final: <span className="font-semibold text-gray-800">{p.saida || '--:--'}</span></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t">
              <button onClick={() => setFuncionarioSelecionado(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-xs">
                Cancelar
              </button>
              <button onClick={salvarAlteracoes} disabled={salvando} className="flex-1 py-3 rounded-2xl text-white font-bold text-xs shadow-sm" style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
