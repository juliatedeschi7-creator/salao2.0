'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, ShieldCheck, Check, X, Save, 
  LayoutDashboard, Calendar, Users, Briefcase, 
  Scissors, DollarSign, PieChart, Settings, Loader2 
} from 'lucide-react'

const PAGINAS_SISTEMA = [
  { key: 'dashboard', nome: 'Painel / Dashboard', categoria: 'Geral', descricao: 'Acesso à visão geral, métricas e estatísticas', icon: LayoutDashboard },
  { key: 'agenda', nome: 'Agenda de Serviços', categoria: 'Atendimento', descricao: 'Visualizar, criar e remarcar agendamentos', icon: Calendar },
  { key: 'clientes', nome: 'Gestão de Clientes', categoria: 'Atendimento', descricao: 'Visualizar lista e cadastrar clientes', icon: Users },
  { key: 'funcionarios', nome: 'Gestão de Funcionários', categoria: 'Equipe', descricao: 'Cadastrar membros da equipe e cargos', icon: Briefcase },
  { key: 'servicos', nome: 'Serviços & Preços', categoria: 'Catálogo', descricao: 'Editar lista de serviços e preços', icon: Scissors },
  { key: 'financeiro', nome: 'Caixa & Financeiro', categoria: 'Financeiro', descricao: 'Fluxo de caixa e despesas', icon: DollarSign },
  { key: 'comissoes', nome: 'Comissões & Relatórios', categoria: 'Financeiro', descricao: 'Relatórios de faturamento e comissão', icon: PieChart },
  { key: 'configuracoes', nome: 'Configurações do Salão', categoria: 'Sistema', descricao: 'Alterar horários e dados do salão', icon: Settings }
]

function PermissoesContent() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>('')
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({})
  const [carregando, setCarregando] = useState(true)
  const [carregandoFuncs, setCarregandoFuncs] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    if (loading) return
    if (!profile) {
      router.push('/login')
      return
    }
    if (profile.salao_id) {
      carregarFuncionarios(profile.salao_id)
    }
  }, [loading, profile])

  async function carregarFuncionarios(salaoId: string) {
    setCarregandoFuncs(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email, role')
        .eq('salao_id', salaoId)
        .neq('role', 'dono')

      if (error) throw error
      if (data && data.length > 0) {
        setFuncionarios(data)
        setFuncionarioSelecionado(data[0].id)
      }
    } catch (err: any) {
      alert('Erro ao carregar funcionários: ' + err.message)
    } finally {
      setCarregandoFuncs(false)
    }
  }

  useEffect(() => {
    if (!funcionarioSelecionado || !profile?.salao_id) return
    carregarPermissoesDoUsuario(funcionarioSelecionado)
  }, [funcionarioSelecionado])

  async function carregarPermissoesDoUsuario(userId: string) {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('permissoes_cargos')
        .select('pagina_key, permitido')
        .eq('salao_id', profile!.salao_id)
        .eq('user_id', userId)

      if (error) throw error

      const mapaPermissoes: Record<string, boolean> = {}
      PAGINAS_SISTEMA.forEach(pag => {
        mapaPermissoes[pag.key] = ['agenda', 'clientes'].includes(pag.key)
      })

      if (data && data.length > 0) {
        data.forEach((p: any) => {
          mapaPermissoes[p.pagina_key] = p.permitido
        })
      }

      setPermissoes(mapaPermissoes)
    } catch (err: any) {
      alert('Erro ao carregar permissões do usuário: ' + err.message)
    } finally {
      setCarregando(false)
    }
  }

  function togglePermissao(paginaKey: string, valor: boolean) {
    setPermissoes(prev => ({ ...prev, [paginaKey]: valor }))
  }

  async function salvarPermissoes() {
    if (!profile?.salao_id) {
      alert('ERRO: profile.salao_id está vazio! Você está logado corretamente?')
      return
    }
    if (!funcionarioSelecionado) {
      alert('ERRO: Nenhum funcionário selecionado!')
      return
    }

    setSalvando(true)
    setMensagem('')

    try {
      const funcAtual = funcionarios.find(f => f.id === funcionarioSelecionado)
      const roleGenerico = funcAtual?.role || 'profissional'

      const payload = Object.entries(permissoes).map(([pagina_key, permitido]) => ({
        salao_id: profile.salao_id,
        user_id: funcionarioSelecionado,
        role: roleGenerico,
        pagina_key,
        permitido
      }))

      alert(`Preparando para salvar ${payload.length} itens para o funcionário ID: ${funcionarioSelecionado}`)

      const { data, error } = await supabase
        .from('permissoes_cargos')
        .upsert(payload, { onConflict: 'salao_id,user_id,pagina_key' })
        .select()

      if (error) {
        alert('ERRO DO SUPABASE AO SALVAR: ' + JSON.stringify(error))
        throw error
      }

      alert('Sucesso absoluto! Retorno do banco: ' + JSON.stringify(data))
      setMensagem('Permissões individuais salvas com sucesso!')
      setTimeout(() => setMensagem(''), 3000)
    } catch (err: any) {
      alert('EXCEÇÃO CAPTURADA: ' + (err.message || JSON.stringify(err)))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-28">
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-pink-500" />
            <h1 className="font-bold text-gray-900 text-lg">🚀 Controle de Acessos V2</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={salvarPermissoes}
          disabled={salvando || carregando || !funcionarioSelecionado}
          className="px-4 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold shadow-md hover:bg-pink-600 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
      </div>

      <div className="px-4 mt-4 space-y-4 max-w-3xl mx-auto">
        {mensagem && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-2xl flex items-center gap-2">
            <Check size={16} className="text-emerald-600" />
            {mensagem}
          </div>
        )}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            Selecione o Funcionário:
          </label>
          {carregandoFuncs ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded-xl" />
          ) : funcionarios.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Nenhum funcionário cadastrado neste salão.</p>
          ) : (
            <select
              value={funcionarioSelecionado}
              onChange={(e) => setFuncionarioSelecionado(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-pink-500"
            >
              {funcionarios.map(func => (
                <option key={func.id} value={func.id}>
                  {func.nome} ({func.role || 'Funcionário'})
                </option>
              ))}
            </select>
          )}
        </div>

        {carregando ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 animate-pulse h-20" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Controle de Acesso às Telas
            </h2>

            {PAGINAS_SISTEMA.map(pag => {
              const Icone = pag.icon
              const temAcesso = permissoes[pag.key] ?? false

              return (
                <div
                  key={pag.key}
                  className={`bg-white p-4 rounded-2xl shadow-sm border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    temAcesso ? 'border-gray-100' : 'border-red-100 bg-red-50/20'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 ${temAcesso ? 'bg-pink-50 text-pink-600' : 'bg-gray-100 text-gray-400'}`}>
                      <Icone size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-sm">{pag.nome}</p>
                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {pag.categoria}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        {pag.descricao}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePermissao(pag.key, true)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                        temAcesso ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : 'bg-white text-gray-400 border-gray-200'
                      }`}
                    >
                      <Check size={14} /> Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePermissao(pag.key, false)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                        !temAcesso ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'bg-white text-gray-400 border-gray-200'
                      }`}
                    >
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
  )
}

export default function PermissoesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center"><div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <PermissoesContent />
    </Suspense>
  )
}
