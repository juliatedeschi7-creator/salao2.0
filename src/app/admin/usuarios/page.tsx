'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, XCircle, Search, User } from 'lucide-react'

interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  aprovado: boolean
  ativo: boolean
  created_at: string
  saloes?: { nome: string }
}

export default function AdminUsuariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'aprovados'>('pendentes')

  useEffect(() => {
    if (!loading && profile?.role !== 'admin_geral') router.push('/login')
    else if (!loading) carregarUsuarios()
  }, [loading])

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('profiles')
      .select('*, saloes(nome)')
      .neq('role', 'admin_geral')
      .order('created_at', { ascending: false })
    setUsuarios(data || [])
  }

  async function aprovarUsuario(id: string) {
    await supabase.from('profiles').update({ aprovado: true }).eq('id', id)

    const usuario = usuarios.find(u => u.id === id)
    if (usuario) {
      await supabase.from('notificacoes').insert({
        remetente_id: profile?.id,
        destinatario_id: id,
        titulo: 'Conta aprovada!',
        mensagem: 'Sua conta foi aprovada pelo administrador. Bem-vindo ao Organiza Salão!',
        tipo: 'admin'
      })
    }
    carregarUsuarios()
  }

  async function reprovarUsuario(id: string) {
    await supabase.from('profiles').update({ aprovado: false, ativo: false }).eq('id', id)
    carregarUsuarios()
  }

  const roleLabel: Record<string, string> = {
    dono_salao: 'Dono de Salão',
    funcionario: 'Funcionário',
    cliente: 'Cliente'
  }

  const usuariosFiltrados = usuarios.filter(u => {
    const matchBusca = u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase())
    const matchFiltro = filtro === 'todos' ? true :
      filtro === 'pendentes' ? !u.aprovado : u.aprovado
    return matchBusca && matchFiltro
  })

  return (
    <div className="min-h-screen bg-[#f8f4f6]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Gerenciar Usuários</h1>
        <span className="text-xs bg-pink-100 text-[#E91E8C] px-2 py-1 rounded-full font-medium">
          {usuarios.filter(u => !u.aprovado).length} pendentes
        </span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-11" placeholder="Buscar por nome ou email..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="flex gap-2">
          {(['pendentes', 'aprovados', 'todos'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filtro === f ? 'bg-[#E91E8C] text-white' : 'bg-white text-gray-500'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {usuariosFiltrados.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-gray-400">Nenhum usuário encontrado</p>
          </div>
        ) : (
          usuariosFiltrados.map(u => (
            <div key={u.id} className="card flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                  <User size={20} className="text-[#E91E8C]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{u.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.aprovado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {u.aprovado ? 'Aprovado' : 'Pendente'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{u.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {roleLabel[u.role] || u.role}
                    {u.saloes?.nome && ` • ${u.saloes.nome}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    Cadastro: {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {!u.aprovado && (
                <div className="flex gap-2">
                  <button onClick={() => reprovarUsuario(u.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-500 font-medium text-sm">
                    <XCircle size={16} />Reprovar
                  </button>
                  <button onClick={() => aprovarUsuario(u.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-600 font-medium text-sm">
                    <CheckCircle size={16} />Aprovar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
