'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Shield, Check, X } from 'lucide-react'

// LISTA COMPLETA DE TODAS AS OPÇÕES E PÁGINAS DO SISTEMA
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

export default function FuncionariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  // Estado do Modal de Permissões Individuais Completas
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<any>(null)
  const [permissoesCustom, setPermissoesCustom] = useState<Record<string, boolean>>({})
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
        // FILTRANDO APENAS QUEM É DA EQUIPE (excluindo clientes da mesma tabela profiles)
        // Se na sua tabela o cargo/tipo for diferente, ajuste o filtro abaixo (ex: .neq('role', 'cliente') ou .in('role', ['dono', 'funcionario']))
        supabase
          .from('profiles')
          .select('*')
          .eq('salao_id', profile!.salao_id!)
          .neq('role', 'cliente') // <- Garante que clientes não apareçam na lista de funcionários
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

  // Abrir o modal carregando as permissões atuais do funcionário
  function abrirPermissoesIndividuais(func: any) {
    setFuncionarioSelecionado(func)
    
    if (func.permissoes_paginas) {
      setPermissoesCustom(func.permissoes_paginas)
    } else {
      const padrao: Record<string, boolean> = {}
      TODAS_AS_PERMISSOES.forEach(p => {
        padrao[p.id] = true // Padrão: com acesso total
      })
      setPermissoesCustom(padrao)
    }
  }

  // Salvar as permissões completas no banco
  async function salvarPermissoesIndividuais() {
    if (!funcionarioSelecionado) return
    setSalvando(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissoes_paginas: permissoesCustom })
        .eq('id', funcionarioSelecionado.id)

      if (error) throw error

      alert('Permissões atualizadas com sucesso!')
      setFuncionarioSelecionado(null)
      carregarDados()
    } catch (err: any) {
      alert('Erro ao salvar permissões: ' + (err.message || 'Tente novamente.'))
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
        <div className="px-4 py-4 flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse flex flex-col gap-2">
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12 bg-[#f8f9fa]">
      {/* HEADER */}
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
        {/* INSTRUÇÃO */}
        <div className="bg-pink-50 border border-pink-100 p-4 rounded-2xl flex items-start gap-3">
          <Shield size={20} className="text-pink-600 shrink-0 mt-0.5" />
          <div className="text-xs text-pink-900 leading-relaxed">
            <p className="font-bold mb-0.5">Controle Completo de Acessos</p>
            <p className="text-pink-700">
              Clique em cima de qualquer funcionário para abrir o painel e configurar individualmente cada agenda, página e recurso do sistema.
            </p>
          </div>
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">
          Equipe Cadastrada ({funcionarios.length})
        </p>

        {/* LISTA DE FUNCIONÁRIOS (SEM CLIENTES) */}
        {funcionarios.map(f => {
          const eDono = f.role === 'dono'
          return (
            <div 
              key={f.id} 
              onClick={() => abrirPermissoesIndividuais(f)}
              className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between gap-3 shadow-sm cursor-pointer hover:border-pink-300 transition-all">
              
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm"
                  style={{ backgroundColor: cor }}>
                  {f.nome ? f.nome.charAt(0).toUpperCase() : 'U'}
                </div>
                
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-sm truncate">{f.nome || 'Sem nome'}</p>
                    {eDono && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full border border-purple-100">
                        Dono
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{f.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-3 py-1.5 rounded-xl border border-pink-100">
                  Configurar Acessos ➔
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL DE PERMISSÕES COMPLETAS POR FUNCIONÁRIO */}
      {funcionarioSelecionado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Permissões de Acesso</h3>
                <p className="text-xs text-gray-500 mt-0.5">Funcionário: <span className="font-semibold text-gray-800">{funcionarioSelecionado.nome}</span></p>
              </div>
              <button onClick={() => setFuncionarioSelecionado(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Escolha quais recursos e páginas este funcionário pode visualizar ou gerenciar:
            </p>

            <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {TODAS_AS_PERMISSOES.map(item => {
                const permitido = permissoesCustom[item.id] ?? true
                return (
                  <div key={item.id} className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 flex items-center justify-between gap-3">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-xs">{item.nome}</p>
                        <span className="text-[10px] bg-white text-gray-500 px-2 py-0.5 rounded-md border border-gray-200 font-medium">
                          {item.categoria}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.desc}</p>
                    </div>

                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPermissoesCustom(prev => ({ ...prev, [item.id]: true }))}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          permitido ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'
                        }`}>
                        <Check size={12} /> Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setPermissoesCustom(prev => ({ ...prev, [item.id]: false }))}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          !permitido ? 'bg-red-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'
                        }`}>
                        <X size={12} /> Não
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 pt-2 border-t">
              <button 
                onClick={() => setFuncionarioSelecionado(null)} 
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-xs">
                Cancelar
              </button>
              <button 
                onClick={salvarPermissoesIndividuais} 
                disabled={salvando} 
                className="flex-1 py-3 rounded-2xl text-white font-bold text-xs shadow-sm" 
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
