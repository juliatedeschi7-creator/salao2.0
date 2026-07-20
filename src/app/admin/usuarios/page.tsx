'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, CheckCircle, XCircle, Search, User, Pause, Play, Trash2, RotateCcw } from 'lucide-react'

export default function AdminUsuariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'aprovados' | 'excluidos'>('pendentes')
  const [carregando, setCarregando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<any>(null)

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (profile.role !== 'admin_geral') { router.replace('/login'); return }
    carregarUsuarios()
  }, [loading, profile])

  async function carregarUsuarios() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*, saloes!profiles_salao_id_fkey(nome)')
      .in('role', ['dono_salao', 'funcionario']) // ← exclui clientes e admin
      .order('created_at', { ascending: false })
    if (error) console.error('Erro ao carregar usuários:', error)
    setUsuarios(data || [])
    setCarregando(false)
  }

async function aprovar(u: any) {
  await supabase.from('profiles').update({ aprovado: true, ativo: true }).eq('id', u.id)
  await notificar({
    remetenteId: profile?.id,
    destinatarioId: u.id,
    titulo: 'Conta aprovada!',
    mensagem: 'Sua conta foi aprovada! Você já pode acessar o sistema.',
    tipo: 'admin'
  })
  carregarUsuarios()
}

  async function reprovar(u: any) {
    await supabase.from('profiles').update({ aprovado: false, ativo: false }).eq('id', u.id)
    carregarUsuarios()
  }

  async function alternarPausa(u: any) {
    await supabase.from('profiles').update({ ativo: !u.ativo }).eq('id', u.id)
    carregarUsuarios()
  }

  async function excluirUsuario(u: any) {
    const { error } = await supabase.from('profiles')
      .update({ excluido: true, ativo: false })
      .eq('id', u.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    setConfirmandoExclusao(null)
    carregarUsuarios()
  }

  async function reativarUsuario(u: any) {
    const { error } = await supabase.from('profiles').update({ excluido: false }).eq('id', u.id)
    if (error) { alert('Erro ao reativar: ' + error.message); return }
    carregarUsuarios()
  }

  const roleLabel: Record<string, string> = {
    dono_salao: 'Dono de Salão',
    funcionario: 'Funcionário',
  }

  const pendentes = usuarios.filter(u => !u.aprovado && !u.excluido)
  const donos = usuarios.filter(u => u.role === 'dono_salao' && !u.excluido)
  const funcionarios = usuarios.filter(u => u.role === 'funcionario' && !u.excluido)

  const filtrados = usuarios.filter(u => {
    const matchBusca =
      u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      u.email?.toLowerCase().includes(busca.toLowerCase())
    const matchFiltro =
      filtro === 'todos' ? !u.excluido :
      filtro === 'pendentes' ? !u.aprovado && !u.excluido :
      filtro === 'aprovados' ? u.aprovado && !u.excluido :
      filtro === 'excluidos' ? !!u.excluido : true
    return matchBusca && matchFiltro
  })

  if (loading || !profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 px-4 pt-12 pb-5 flex items-center gap-3">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-white" />
        </button>
        <h1 className="font-bold text-white text-lg flex-1">Gerenciar Usuários</h1>
        {pendentes.length > 0 && (
          <span className="bg-yellow-400 text-gray-900 text-xs px-2 py-1 rounded-full font-bold">
            {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Stats — só donos e funcionários */}
      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{donos.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Salões</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{funcionarios.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Funcionários</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-yellow-500">{pendentes.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pendentes</p>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-3 pb-8">
        {/* Busca */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-11" placeholder="Buscar por nome ou email..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          {(['pendentes', 'aprovados', 'todos', 'excluidos'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={'px-4 py-2 rounded-full text-sm font-medium transition-all ' +
                (filtro === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-500')}>
              {f === 'pendentes' ? 'Pendentes' :
               f === 'aprovados' ? 'Aprovados' :
               f === 'todos' ? 'Todos' : 'Excluídos'}
            </button>
          ))}
        </div>

        {carregando ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-10 shadow-sm">
            <User size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum usuário encontrado</p>
          </div>
        ) : filtrados.map(u => (
          <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0 font-bold text-gray-600">
                {u.nome?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900">{u.nome}</p>
                  {u.excluido ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-500">Excluído</span>
                  ) : (
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                      (u.aprovado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                      {u.aprovado ? 'Aprovado' : 'Pendente'}
                    </span>
                  )}
                  {!u.ativo && !u.excluido && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">Pausado</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{u.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {roleLabel[u.role] || u.role}
                  {u.saloes?.nome ? ` · ${u.saloes.nome}` : ''}
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  Cadastro: {new Date(u.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {u.excluido ? (
              <button onClick={() => reativarUsuario(u)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-600 font-medium text-sm">
                <RotateCcw size={16} />Reativar usuário
              </button>
            ) : !u.aprovado ? (
              <div className="flex gap-2">
                <button onClick={() => reprovar(u)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-500 font-medium text-sm">
                  <XCircle size={16} />Reprovar
                </button>
                <button onClick={() => aprovar(u)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 text-white font-medium text-sm">
                  <CheckCircle size={16} />Aprovar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => alternarPausa(u)}
                  className={'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm ' +
                    (u.ativo ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600')}>
                  {u.ativo ? <><Pause size={16} />Pausar</> : <><Play size={16} />Reativar</>}
                </button>
                <button onClick={() => setConfirmandoExclusao(u)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-500 font-medium text-sm">
                  <Trash2 size={16} />Excluir
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {confirmandoExclusao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Excluir usuário?</h3>
            <p className="text-sm text-gray-500">
              <span className="font-semibold">{confirmandoExclusao.nome}</span> será removido do sistema, mas poderá ser reativado a qualquer momento na aba "Excluídos".
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoExclusao(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={() => excluirUsuario(confirmandoExclusao)}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-medium">
                Confirmar exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}