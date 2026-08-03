'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, ShieldCheck, Check, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'

const CARGOS = [
  { id: 'gerente', label: 'Gerente', cor: 'bg-purple-500' },
  { id: 'recepcionista', label: 'Recepcionista', cor: 'bg-blue-500' },
  { id: 'profissional', label: 'Profissional', cor: 'bg-gray-900' },
  { id: 'auxiliar', label: 'Auxiliar', cor: 'bg-amber-500' }
]

const TELAS_SISTEMA = [
  {
    id: 'dashboard',
    nome: 'Painel / Dashboard',
    tag: 'Geral',
    descricao: 'Acesso à visão geral, métricas e estatísticas do salão'
  },
  {
    id: 'agenda',
    nome: 'Agenda de Serviços',
    tag: 'Atendimento',
    descricao: 'Visualizar, criar e remarcar agendamentos de clientes'
  },
  {
    id: 'clientes',
    nome: 'Gestão de Clientes',
    tag: 'Atendimento',
    descricao: 'Visualizar lista, cadastrar e mesclar histórico de clientes'
  },
  {
    id: 'funcionarios',
    nome: 'Gestão de Funcionários',
    tag: 'Equipe',
    descricao: 'Gerenciar membros da equipe, cargos e convites'
  }
]

export default function PermissoesPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [cargoSelecionado, setCargoSelecionado] = useState('profissional')
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [sucesso, setSucesso] = useState(false)

  // Estado que armazena as permissões de todas as telas por cargo
  const [permissoes, setPermissoes] = useState<Record<string, Record<string, boolean>>>({
    gerente: {},
    recepcionista: {},
    profissional: {},
    auxiliar: {}
  })

  // Carrega as permissões salvas do banco de dados ao iniciar
  useEffect(() => {
    if (authLoading || !profile?.salao_id) return
    carregarPermissoesDoBanco()
  }, [authLoading, profile])

  async function carregarPermissoesDoBanco() {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('permissoes_cargos')
        .select('role, pagina_key, permitido')
        .eq('salao_id', profile!.salao_id)

      if (error) throw error

      // Monta o objeto inicial com padrão true ou false
      const novoMapa: Record<string, Record<string, boolean>> = {
        gerente: { dashboard: true, agenda: true, clientes: true, funcionarios: true },
        recepcionista: { dashboard: false, agenda: true, clientes: true, funcionarios: false },
        profissional: { dashboard: true, agenda: true, clientes: true, funcionarios: false },
        auxiliar: { dashboard: false, agenda: true, clientes: false, funcionarios: false }
      }

      if (data && data.length > 0) {
        data.forEach((item: any) => {
          if (!novoMapa[item.role]) novoMapa[item.role] = {}
          novoMapa[item.role][item.pagina_key] = item.permitido
        })
      }

      setPermissoes(novoMapa)
    } catch (err: any) {
      console.error('Erro ao carregar permissões:', err.message)
    } finally {
      setCarregando(false)
    }
  }

  function togglePermissao(telaId: string, valor: boolean) {
    setPermissoes(prev => ({
      ...prev,
      [cargoSelecionado]: {
        ...prev[cargoSelecionado],
        [telaId]: valor
      }
    }))
  }

  async function handleSalvar() {
    if (!profile?.salao_id) {
      alert('Erro: Salão não identificado.')
      return
    }

    setSalvando(true)
    setSucesso(false)

    try {
      // Prepara o array com todas as permissões de todos os cargos para enviar ao banco
      const payload: any[] = []

      Object.entries(permissoes).forEach(([role, telas]) => {
        Object.entries(telas).forEach(([pagina_key, permitido]) => {
          payload.push({
            salao_id: profile.salao_id,
            role: role,
            pagina_key: pagina_key,
            permitido: permitido
          })
        })
      })

      // Salva em lote na tabela permissoes_cargos usando upsert
      const { error } = await supabase
        .from('permissoes_cargos')
        .upsert(payload, { onConflict: 'salao_id,role,pagina_key' })

      if (error) throw error

      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (err: any) {
      alert('Erro ao salvar permissões no banco: ' + (err.message || err))
    } finally {
      setSalvando(false)
    }
  }

  const corRosa = '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} style={{ color: corRosa }} />
            <h1 className="font-bold text-gray-900 text-lg">Permissões de Acesso</h1>
          </div>
        </div>

        <button
          onClick={handleSalvar}
          disabled={salvando || carregando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-xs font-bold shadow-sm disabled:opacity-50"
          style={{ backgroundColor: corRosa }}>
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-6">

        {/* FEEDBACK DE SUCESSO */}
        {sucesso && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
            <Check size={16} /> Permissões salvas com sucesso na tabela do banco!
          </div>
        )}

        {/* BLOCO DE SELEÇÃO DE CARGO */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            SELECIONE O CARGO / TIPO DE FUNCIONÁRIO:
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {CARGOS.map(c => {
              const ativo = cargoSelecionado === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setCargoSelecionado(c.id)}
                  className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                    ativo 
                      ? 'bg-gray-900 text-white border-gray-900 shadow-md' 
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${c.cor}`} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* MATRIZ DE PERMISSÕES DE TELA */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              ACESSO ÀS TELAS DO SISTEMA
            </p>
            <span className="text-xs font-semibold text-gray-500 capitalize">
              Cargo selecionado: <strong>{CARGOS.find(c => c.id === cargoSelecionado)?.label}</strong>
            </span>
          </div>

          {carregando ? (
            <div className="bg-white p-8 rounded-3xl text-center text-gray-400 text-xs">
              Carregando permissões...
            </div>
          ) : (
            <div className="space-y-3">
              {TELAS_SISTEMA.map(tela => {
                const temAcesso = permissoes[cargoSelecionado]?.[tela.id] ?? false

                return (
                  <div key={tela.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-base">{tela.nome}</h3>
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-semibold">
                            {tela.tag}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{tela.descricao}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                      <button
                        onClick={() => togglePermissao(tela.id, true)}
                        className={`flex items-center gap-1 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                          temAcesso 
                            ? 'bg-emerald-500 text-white shadow-sm' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        <Check size={14} /> Sim
                      </button>

                      <button
                        onClick={() => togglePermissao(tela.id, false)}
                        className={`flex items-center gap-1 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                          !temAcesso 
                            ? 'bg-gray-200 text-gray-700' 
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}>
                        <X size={14} /> Não
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
