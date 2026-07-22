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

// Mapeamento de todas as páginas do sistema
const PAGINAS_SISTEMA = [
  {
    key: 'dashboard',
    nome: 'Painel / Dashboard',
    categoria: 'Geral',
    descricao: 'Acesso à visão geral, métricas e estatísticas do salão',
    icon: LayoutDashboard
  },
  {
    key: 'agenda',
    nome: 'Agenda de Serviços',
    categoria: 'Atendimento',
    descricao: 'Visualizar, criar e remarcar agendamentos de clientes',
    icon: Calendar
  },
  {
    key: 'clientes',
    nome: 'Gestão de Clientes',
    categoria: 'Atendimento',
    descricao: 'Visualizar lista, cadastrar e mesclar histórico de clientes',
    icon: Users
  },
  {
    key: 'funcionarios',
    nome: 'Gestão de Funcionários',
    categoria: 'Equipe',
    descricao: 'Cadastrar membros da equipe, cargos e comissões',
    icon: Briefcase
  },
  {
    key: 'servicos',
    nome: 'Serviços & Preços',
    categoria: 'Catálogo',
    descricao: 'Editar lista de serviços, preços e durações',
    icon: Scissors
  },
  {
    key: 'financeiro',
    nome: 'Caixa & Financeiro',
    categoria: 'Financeiro',
    descricao: 'Fluxo de caixa, lançamento de receitas e despesas',
    icon: DollarSign
  },
  {
    key: 'comissoes',
    nome: 'Comissões & Relatórios',
    categoria: 'Financeiro',
    descricao: 'Visualizar relatórios de faturamento e comissão da equipe',
    icon: PieChart
  },
  {
    key: 'configuracoes',
    nome: 'Configurações do Salão',
    categoria: 'Sistema',
    descricao: 'Alterar horários de funcionamento, dados do salão e termos',
    icon: Settings
  }
]

// Tipos de funcionários / Cargos disponíveis
const CARGOS = [
  { id: 'gerente', nome: 'Gerente / Administrador', cor: 'bg-purple-500' },
  { id: 'recepcao', nome: 'Recepcionista', cor: 'bg-blue-500' },
  { id: 'profissional', nome: 'Profissional / Atendente', cor: 'bg-pink-500' },
  { id: 'auxiliar', nome: 'Auxiliar / Estagiário', cor: 'bg-amber-500' }
]

function PermissoesContent() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [cargoSelecionado, setCargoSelecionado] = useState('profissional')
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    if (loading) return
    if (!profile) {
      router.push('/login')
      return
    }
    if (profile.salao_id) {
      carregarPermissoes(cargoSelecionado)
    }
  }, [loading, profile, cargoSelecionado])

  async function carregarPermissoes(role: string) {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('permissoes_cargos')
        .select('pagina_key, permitido')
        .eq('salao_id', profile!.salao_id)
        .eq('role', role)

      if (error) throw error

      // Estado inicial padrão (se não configurado ainda, libera acesso padrão)
      const mapaPermissoes: Record<string, boolean> = {}
      
      PAGINAS_SISTEMA.forEach(pag => {
        // Gerente inicia com tudo liberado; outros cargos iniciam com true apenas para agenda/clientes
        const padrao = role === 'gerente' ? true : ['agenda', 'clientes'].includes(pag.key)
        mapaPermissoes[pag.key] = padrao
      })

      // Sobrescreve com o que está no banco
      if (data && data.length > 0) {
        data.forEach((p: any) => {
          mapaPermissoes[p.pagina_key] = p.permitido
        })
      }

      setPermissoes(mapaPermissoes)
    } catch (err: any) {
      console.error('Erro ao carregar permissões:', err)
    } finally {
      setCarregando(false)
    }
  }

  function togglePermissao(paginaKey: string, valor: boolean) {
    setPermissoes(prev => ({
      ...prev,
      [paginaKey]: valor
    }))
  }

  async function salvarPermissoes() {
    if (!profile?.salao_id) return
    setSalvando(true)
    setMensagem('')

    try {
      const payload = Object.entries(permissoes).map(([pagina_key, permitido]) => ({
        salao_id: profile.salao_id,
        role: cargoSelecionado,
        pagina_key,
        permitido
      }))

      const { error } = await supabase
        .from('permissoes_cargos')
        .upsert(payload, { onConflict: 'salao_id,role,pagina_key' })

      if (error) throw error

      setMensagem('Permissões salvas com sucesso!')
      setTimeout(() => setMensagem(''), 3000)
    } catch (err: any) {
      alert('Erro ao salvar permissões: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-28">
      {/* Topbar */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-pink-500" />
            <h1 className="font-bold text-gray-900 text-lg">Permissões de Acesso</h1>
          </div>
        </div>

        <button
          onClick={salvarPermissoes}
          disabled={salvando || carregando}
          className="px-4 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold shadow-md hover:bg-pink-600 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
      </div>

      <div className="px-4 mt-4 space-y-4 max-w-3xl mx-auto">
        {mensagem && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-2xl flex items-center gap-2 animate-fade-in">
            <Check size={16} className="text-emerald-600" />
            {mensagem}
          </div>
        )}

        {/* Seleção do Cargo / Tipo de Funcionário */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            Selecione o Cargo / Tipo de Funcionário:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CARGOS.map(cargo => {
              const ativo = cargoSelecionado === cargo.id
              return (
                <button
                  key={cargo.id}
                  onClick={() => setCargoSelecionado(cargo.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 text-center border ${
                    ativo 
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm' 
                      : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cargo.cor}`} />
                  <span className="truncate">{cargo.nome.split('/')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista de Páginas do Sistema com Botões Sim / Não */}
        {carregando ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 animate-pulse h-20" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Acesso às Telas do Sistema
              </h2>
              <span className="text-[11px] text-gray-400">
                Cargo selecionado: <b>{CARGOS.find(c => c.id === cargoSelecionado)?.nome}</b>
              </span>
            </div>

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

                  {/* BOTÕES SIM / NÃO */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePermissao(pag.key, true)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                        temAcesso 
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' 
                          : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Check size={14} />
                      Sim
                    </button>

                    <button
                      type="button"
                      onClick={() => togglePermissao(pag.key, false)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                        !temAcesso 
                          ? 'bg-red-500 text-white border-red-500 shadow-sm' 
                          : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <X size={14} />
                      Não
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Barra Flutuante Inferior para Salvar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 p-4 shadow-lg flex items-center justify-between max-w-3xl mx-auto z-10">
        <span className="text-xs text-gray-500">
          Altere as opções acima e clique em salvar.
        </span>
        <button
          onClick={salvarPermissoes}
          disabled={salvando || carregando}
          className="px-6 py-2.5 bg-pink-500 text-white rounded-xl text-xs font-bold shadow-md hover:bg-pink-600 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar Alterações
        </button>
      </div>
    </div>
  )
}

export default function PermissoesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PermissoesContent />
    </Suspense>
  )
}
