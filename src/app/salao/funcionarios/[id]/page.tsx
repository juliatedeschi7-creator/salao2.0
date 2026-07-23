'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Shield, Check, X, Save } from 'lucide-react'

// Lista completa de todas as páginas do sistema
const TODAS_AS_PAGINAS = [
  { id: 'dashboard', nome: 'Painel / Dashboard', categoria: 'Geral', desc: 'Acesso à visão geral, métricas e estatísticas' },
  { id: 'agenda', nome: 'Agenda de Serviços', categoria: 'Atendimento', desc: 'Visualizar, criar e remarcar agendamentos' },
  { id: 'clientes', nome: 'Gestão de Clientes', categoria: 'Atendimento', desc: 'Visualizar lista, cadastrar e histórico de clientes' },
  { id: 'funcionarios', nome: 'Gestão de Funcionários', categoria: 'Equipe', desc: 'Gerenciar membros da equipe, cargos e convites' },
  { id: 'permissoes', nome: 'Permissões de Acesso', categoria: 'Equipe', desc: 'Configurar controle de acesso às telas' },
  { id: 'servicos', nome: 'Cadastro de Serviços', categoria: 'Configurações', desc: 'Adicionar e editar serviços, preços e durações' },
  { id: 'produtos', nome: 'Estoque / Produtos', categoria: 'Configurações', desc: 'Controle de produtos e insumos do salão' },
  { id: 'financeiro', nome: 'Financeiro / Caixa', categoria: 'Gestão', desc: 'Relatórios de faturamento, entradas e saídas' },
  { id: 'configuracoes', nome: 'Configurações do Salão', categoria: 'Configurações', desc: 'Dados da empresa, horários de funcionamento e aparências' },
]

export default function DetalheFuncionarioPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()
  params = useParams()
  const funcionarioId = params.id as string

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
    if (funcionarioId) {
      carregarDadosFuncionario()
    }
  }, [authLoading, profile, funcionarioId])

  async function carregarDadosFuncionario() {
    setCarregando(true)
    try {
      // Buscar dados do funcionário
      const { data: funcData, error: funcErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', funcionarioId)
        .single()

      if (funcErr) throw funcErr
      setFuncionario(funcData)

      // Buscar dados do salão para cor primária
      if (funcData?.salao_id) {
        const { data: salData } = await supabase
          .from('saloes')
          .select('*')
          .eq('id', funcData.salao_id)
          .single()
        setSalao(salData)
      }

      // Carregar permissões salvas (caso exista uma coluna ou tabela de permissões individuais)
      // Se o campo permissoes for um JSONB no profile:
      if (funcData?.permissoes_paginas) {
        setPermissoesCustom(funcData.permissoes_paginas)
      } else {
        // Padrão inicial: por padrão tudo liberado ou baseado no cargo
        const padrao: Record<string, boolean> = {}
        TODAS_AS_PAGINAS.forEach(p => {
          padrao[p.id] = true // Padrão liberado para customizar
        })
        setPermissoesCustom(padrao)
      }
    } catch (err) {
      console.error('Erro ao carregar funcionário:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function salvarPermissoes() {
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissoes_paginas: permissoesCustom })
        .eq('id', funcionarioId)

      if (error) throw error
      alert('Permissões individuais salvas com sucesso!')
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
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-pink-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-base">{funcionario?.nome || 'Funcionário'}</h1>
            <p className="text-xs text-gray-400">{funcionario?.email}</p>
          </div>
        </div>

        <button
          onClick={salvarPermissoes}
          disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-xs font-bold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-xl mx-auto">
        <div className="bg-pink-50 border border-pink-100 p-4 rounded-2xl flex items-start gap-3">
          <Shield size={20} className="text-pink-600 shrink-0 mt-0.5" />
          <div className="text-xs text-pink-900">
            <p className="font-bold mb-0.5">Controle de Acesso Individual</p>
            <p className="text-pink-700 leading-relaxed">
              Defina exatamente quais páginas do sistema este funcionário pode acessar. As alterações entram em vigor imediatamente após salvar.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Todas as Páginas do Sistema ({TODAS_AS_PAGINAS.length})
          </p>

          {TODAS_AS_PAGINAS.map(pagina => {
            const permitido = permissoesCustom[pagina.id] ?? true
            return (
              <div 
                key={pagina.id} 
                className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-sm">{pagina.nome}</p>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                      {pagina.categoria}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{pagina.desc}</p>
                </div>

                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100 shrink-0">
                  <button
                    onClick={() => setPermissoesCustom(prev => ({ ...prev, [pagina.id]: true }))}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      permitido ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'
                    }`}>
                    <Check size={14} /> Sim
                  </button>
                  <button
                    onClick={() => setPermissoesCustom(prev => ({ ...prev, [pagina.id]: false }))}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !permitido ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'
                    }`}>
                    <X size={14} /> Não
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
