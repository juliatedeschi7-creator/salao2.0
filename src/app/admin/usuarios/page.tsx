'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Search,
  User,
  Pause,
  Play,
  Trash2,
  RotateCcw,
} from 'lucide-react'

type FiltroUsuario = 'todos' | 'pendentes' | 'aprovados' | 'excluidos'

export default function AdminUsuariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [usuarios, setUsuarios] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroUsuario>('pendentes')
  const [carregando, setCarregando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] =
    useState<any | null>(null)

  const ehAdministrador =
    profile?.role === 'dono_salao' &&
    profile?.nivel_acesso === 'total'

  useEffect(() => {
    if (loading) return

    if (!profile || !ehAdministrador) {
      router.replace('/login')
      return
    }

    void carregarUsuarios()
  }, [loading, profile, ehAdministrador])

  async function carregarUsuarios() {
    setCarregando(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, saloes!profiles_salao_id_fkey(nome)')
        .in('role', ['dono_salao', 'funcionario'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao carregar usuários:', error)
        alert('Não foi possível carregar os usuários: ' + error.message)
        return
      }

      setUsuarios(data || [])
    } catch (error) {
      console.error('Erro inesperado ao carregar usuários:', error)
      alert('Ocorreu um erro ao carregar os usuários.')
    } finally {
      setCarregando(false)
    }
  }

  async function aprovar(u: any) {
    const { error } = await supabase
      .from('profiles')
      .update({ aprovado: true, ativo: true })
      .eq('id', u.id)

    if (error) {
      alert('Erro ao aprovar usuário: ' + error.message)
      return
    }

    await notificar({
      remetenteId: profile?.id,
      destinatarioId: u.id,
      titulo: 'Conta aprovada!',
      mensagem: 'Sua conta foi aprovada! Você já pode acessar o sistema.',
      tipo: 'admin',
    })

    await carregarUsuarios()
  }

  async function reprovar(u: any) {
    const { error } = await supabase
      .from('profiles')
      .update({ aprovado: false, ativo: false })
      .eq('id', u.id)

    if (error) {
      alert('Erro ao reprovar usuário: ' + error.message)
      return
    }

    await carregarUsuarios()
  }

  async function alternarPausa(u: any) {
    const { error } = await supabase
      .from('profiles')
      .update({ ativo: !u.ativo })
      .eq('id', u.id)

    if (error) {
      alert('Erro ao alterar o status: ' + error.message)
      return
    }

    await carregarUsuarios()
  }

  async function excluirUsuario(u: any) {
    const { error } = await supabase
      .from('profiles')
      .update({ excluido: true, ativo: false })
      .eq('id', u.id)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }

    setConfirmandoExclusao(null)
    await carregarUsuarios()
  }

  async function reativarUsuario(u: any) {
    const { error } = await supabase
      .from('profiles')
      .update({ excluido: false })
      .eq('id', u.id)

    if (error) {
      alert('Erro ao reativar: ' + error.message)
      return
    }

    await carregarUsuarios()
  }

  const roleLabel: Record<string, string> = {
    dono_salao: 'Dono de Salão',
    funcionario: 'Funcionário',
  }

  const pendentes = usuarios.filter(
    (u) => !u.aprovado && !u.excluido
  )

  const donos = usuarios.filter(
    (u) => u.role === 'dono_salao' && !u.excluido
  )

  const funcionarios = usuarios.filter(
    (u) => u.role === 'funcionario' && !u.excluido
  )

  const filtrados = usuarios.filter((u) => {
    const termo = busca.toLowerCase()

    const matchBusca =
      u.nome?.toLowerCase().includes(termo) ||
      u.email?.toLowerCase().includes(termo)

    const matchFiltro =
      filtro === 'todos'
        ? !u.excluido
        : filtro === 'pendentes'
          ? !u.aprovado && !u.excluido
          : filtro === 'aprovados'
            ? u.aprovado && !u.excluido
            : filtro === 'excluidos'
              ? !!u.excluido
              : true

    return matchBusca && matchFiltro
  })

  if (loading || !profile || !ehAdministrador) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Voltar"
            className="text-white"
          >
            <ArrowLeft size={22} />
          </button>

          <h1 className="flex-1 text-lg font-bold text-white">
            Gerenciar Usuários
          </h1>

          {pendentes.length > 0 && (
            <span className="rounded-full bg-yellow-400 px-2 py-1 text-xs font-bold text-gray-900">
              {pendentes.length} pendente
              {pendentes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 py-4">
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {donos.length}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">Salões</p>
        </div>

        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {funcionarios.length}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">Funcionários</p>
        </div>

        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-yellow-500">
            {pendentes.length}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">Pendentes</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-8">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            className="input-field pl-11"
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            ['pendentes', 'aprovados', 'todos', 'excluidos'] as const
          ).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFiltro(f)}
              className={
                'rounded-full px-4 py-2 text-sm font-medium transition-all ' +
                (filtro === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500')
              }
            >
              {f === 'pendentes'
                ? 'Pendentes'
                : f === 'aprovados'
                  ? 'Aprovados'
                  : f === 'todos'
                    ? 'Todos'
                    : 'Excluídos'}
            </button>
          ))}
        </div>

        {carregando ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-900 border-t-transparent" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-2xl bg-white py-10 text-center shadow-sm">
            <User
              size={36}
              className="mx-auto mb-2 text-gray-300"
            />
            <p className="text-gray-400">
              Nenhum usuário encontrado
            </p>
          </div>
        ) : (
          filtrados.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-600">
                  {u.nome?.charAt(0).toUpperCase() || '?'}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-gray-900">
                      {u.nome}
                    </p>

                    {u.excluido ? (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Excluído
                      </span>
                    ) : (
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (u.aprovado
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700')
                        }
                      >
                        {u.aprovado ? 'Aprovado' : 'Pendente'}
                      </span>
                    )}

                    {!u.ativo && !u.excluido && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                        Pausado
                      </span>
                    )}
                  </div>

                  <p className="truncate text-sm text-gray-500">
                    {u.email}
                  </p>

                  <p className="mt-0.5 text-xs text-gray-400">
                    {roleLabel[u.role] || u.role}
                    {u.saloes?.nome ? ` · ${u.saloes.nome}` : ''}
                  </p>

                  <p className="mt-0.5 text-xs text-gray-300">
                    Cadastro:{' '}
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString(
                          'pt-BR'
                        )
                      : 'Data indisponível'}
                  </p>
                </div>
              </div>

              {u.excluido ? (
                <button
                  type="button"
                  onClick={() => void reativarUsuario(u)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-green-50 py-2.5 text-sm font-medium text-green-600"
                >
                  <RotateCcw size={16} />
                  Reativar usuário
                </button>
              ) : !u.aprovado ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void reprovar(u)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-sm font-medium text-red-500"
                  >
                    <XCircle size={16} />
                    Reprovar
                  </button>

                  <button
                    type="button"
                    onClick={() => void aprovar(u)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white"
                  >
                    <CheckCircle size={16} />
                    Aprovar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void alternarPausa(u)}
                    className={
                      'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium ' +
                      (u.ativo
                        ? 'bg-yellow-50 text-yellow-600'
                        : 'bg-green-50 text-green-600')
                    }
                  >
                    {u.ativo ? (
                      <>
                        <Pause size={16} />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        Reativar
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(u)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-sm font-medium text-red-500"
                  >
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="flex w-full flex-col gap-4 rounded-t-3xl bg-white p-6">
            <h3 className="text-lg font-bold text-gray-900">
              Excluir usuário?
            </h3>

            <p className="text-sm text-gray-500">
              <span className="font-semibold">
                {confirmandoExclusao.nome}
              </span>{' '}
              será removido do sistema, mas poderá ser reativado a
              qualquer momento na aba "Excluídos".
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(null)}
                className="flex-1 rounded-2xl border border-gray-200 py-3 font-medium text-gray-600"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void excluirUsuario(confirmandoExclusao)}
                className="flex-1 rounded-2xl bg-red-500 py-3 font-medium text-white"
              >
                Confirmar exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}