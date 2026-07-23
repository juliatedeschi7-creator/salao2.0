'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Shield, Check, X, User, Mail, Phone, Lock, Unlock } from 'lucide-react'

// LISTA DE TODAS AS PÁGINAS DO SISTEMA
const TODAS_AS_PAGINAS = [
  { id: 'dashboard', nome: 'Painel / Dashboard', categoria: 'Geral', desc: 'Visão geral, métricas e estatísticas' },
  { id: 'agenda', nome: 'Agenda de Serviços', categoria: 'Atendimento', desc: 'Visualizar, criar e remarcar agendamentos' },
  { id: 'clientes', nome: 'Gestão de Clientes', categoria: 'Atendimento', desc: 'Lista, cadastro e histórico de clientes' },
  { id: 'funcionarios', nome: 'Gestão de Funcionários', categoria: 'Equipe', desc: 'Membros da equipe, cargos e convites' },
  { id: 'servicos', nome: 'Cadastro de Serviços', categoria: 'Configurações', desc: 'Adicionar e editar serviços, preços e durações' },
  { id: 'produtos', nome: 'Estoque / Produtos', categoria: 'Configurações', desc: 'Controle de produtos e insumos' },
  { id: 'financeiro', nome: 'Financeiro / Caixa', categoria: 'Gestão', desc: 'Relatórios de faturamento, entradas e saídas' },
  { id: 'configuracoes', nome: 'Configurações do Salão', categoria: 'Configurações', desc: 'Dados da empresa e horários' },
]

export default function FuncionarioDetalhesPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const funcionarioId = params?.id as string

  const [funcionario, setFuncionario] = useState<any>(null)
  const [salao, setSalao] = useState<any>(null)
  const [permissoesCustom, setPermissoesCustom] = useState<Record<string, boolean>>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!profile) {
      router.push('/login')
      return
    }
    if (profile.salao_id && funcionarioId) {
      carregarDados()
    }
  }, [authLoading, profile, funcionarioId])

  async function carregarDados() {
    setCarregando(true)
    try {
      const [salRes, funcRes] = await Promise.all([
        supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
        supabase.from('profiles').select('*').eq('id', funcionarioId).single()
      ])

      setSalao(salRes.data)
      const funcData = funcRes.data
      setFuncionario(funcData)

      if (funcData?.permissoes_paginas) {
        setPermissoesCustom(funcData.permissoes_paginas)
      } else {
        const padrao: Record<string, boolean> = {}
        TODAS_AS_PAGINAS.forEach(p => {
          padrao[p.id] = true
        })
        setPermissoesCustom(padrao)
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function salvarPermissoes() {
    if (!funcionarioId) return
    setSalvando(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissoes_paginas: permissoesCustom })
        .eq('id', funcionarioId)

      if (error) throw error

      alert('Permissões atualizadas com sucesso!')
      router.push('/salao/funcionarios')
    } catch (err: any) {
      alert('Erro ao salvar permissões: ' + (err.message || 'Tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (authLoading || carregando) {
    return (
      <div className="min-h-screen pb-8 bg-[#f8f9fa]">
        <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg flex-1">Carregando...</h1>
        </div>
      </div>
    )
  }

  if (!funcionario) {
    return (
      <div className="min-h-screen pb-8 bg-[#f8f9fa] p-4 text-center">
        <p className="text-gray-500 mt-10">Funcionário não encontrado.</p>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold">Voltar</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12 bg-[#f8f9fa]">
      <div className="bg-white px-4 py-4 flex items-center gap-2 shadow-sm sticky top-0 z-10">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1 truncate">Permissões de Acesso</h1>
      </div>

      <div className="px-4 py-4 max-w-xl mx-auto flex flex-col gap-4">
        {/* CARD DO FUNCIONÁRIO */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
            style={{ backgroundColor: cor }}>
            {funcionario.nome ? funcionario.nome.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-gray-900 text-sm truncate">{funcionario.nome || 'Sem nome'}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{funcionario.email}</p>
          </div>
        </div>

        <div className="bg-pink-50 border border-pink-100 p-3.5 rounded-2xl flex items-start gap-3">
          <Shield size={20} className="text-pink-600 shrink-0 mt-0.5" />
          <p className="text-xs text-pink-900 leading-relaxed">
            Selecione abaixo quais páginas este colaborador pode visualizar ou interagir no sistema.
          </p>
        </div>

        {/* LISTA DE PÁGINAS */}
        <div className="flex flex-col gap-2.5">
          {TODAS_AS_PAGINAS.map(pagina => {
            const permitido = permissoesCustom[pagina.id] ?? true
            return (
              <div key={pagina.id} className="bg-white p-3.5 rounded-2xl border border-gray-100 flex items-center justify-between gap-3 shadow-sm">
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-xs">{pagina.nome}</p>
                    <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md border border-gray-200 font-medium">
                      {pagina.categoria}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{pagina.desc}</p>
                </div>

                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPermissoesCustom(prev => ({ ...prev, [pagina.id]: true }))}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      permitido ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-200'
                    }`}>
                    <Check size={12} /> Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermissoesCustom(prev => ({ ...prev, [pagina.id]: false }))}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      !permitido ? 'bg-red-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-200'
                    }`}>
                    <X size={12} /> Não
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* BOTÃO DE SALVAR */}
        <div className="pt-2">
          <button 
            onClick={salvarPermissoes} 
            disabled={salvando} 
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-sm transition-all" 
            style={{ backgroundColor: cor }}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
