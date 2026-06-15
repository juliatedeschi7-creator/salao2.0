'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, XCircle, Search, User } from 'lucide-react'

export default function AdminUsuariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'aprovados'>('pendentes')
  const [carregando, setCarregando] = useState(false)
  const [debug, setDebug] = useState('')

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
    .order('created_at', { ascending: false })

  if (error) {
    setDebug('ERRO: ' + JSON.stringify(error))
  } else {
    setDebug('Total: ' + (data?.length || 0) + ' | Sem admin: ' + (data?.filter((u: any) => u.role !== 'admin_geral').length || 0))
  }

  setUsuarios((data || []).filter((u: any) => u.role !== 'admin_geral'))
  setCarregando(false)
}


  async function aprovar(u: any) {
    await supabase.from('profiles').update({ aprovado: true, ativo: true }).eq('id', u.id)
    await supabase.from('notificacoes').insert({
      remetente_id: profile?.id, destinatario_id: u.id,
      titulo: 'Conta aprovada!', mensagem: 'Sua conta foi aprovada!', tipo: 'admin'
    })
    carregarUsuarios()
  }

  async function reprovar(u: any) {
    await supabase.from('profiles').update({ aprovado: false, ativo: false }).eq('id', u.id)
    carregarUsuarios()
  }

  const roleLabel: Record<string, string> = {
    dono_salao: 'Dono de Salao', funcionario: 'Funcionario', cliente: 'Cliente'
  }

  const filtrados = usuarios.filter(u => {
    const matchBusca =
      u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      u.email?.toLowerCase().includes(busca.toLowerCase())
    const matchFiltro =
      filtro === 'todos' ? true :
      filtro === 'pendentes' ? !u.aprovado : u.aprovado
    return matchBusca && matchFiltro
  })

  if (loading || !profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 px-4 py-5 flex items-center gap-3">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} className="text-white" />
        </button>
        <h1 className="font-bold text-white text-lg flex-1">Gerenciar Usuarios</h1>
        {usuarios.filter(u => !u.aprovado).length > 0 && (
          <span className="bg-yellow-400 text-gray-900 text-xs px-2 py-1 rounded-full font-bold">
            {usuarios.filter(u => !u.aprovado).length} pendentes
          </span>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {debug !== '' && (
          <div className="bg-gray-100 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-600 break-all">{debug}</p>
          </div>
        )}

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-11" placeholder="Buscar por nome ou email..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="flex gap-2">
          {(['pendentes', 'aprovados', 'todos'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={'px-4 py-2 rounded-full text-sm font-medium ' +
                (filtro === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-500')}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {carregando ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="card text-center py-10">
            <User size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum usuario encontrado</p>
          </div>
        ) : filtrados.map(u => (
          <div key={u.id} className="card flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <User size={20} className="text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900">{u.nome}</p>
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                    (u.aprovado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                    {u.aprovado ? 'Aprovado' : 'Pendente'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{u.email}</p>
                <p className="text-xs text-gray-400">
                  {roleLabel[u.role] || u.role}
                  {u.saloes?.nome && ' - ' + u.saloes.nome}
                </p>
                <p className="text-xs text-gray-400">
                  Cadastro: {new Date(u.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            {!u.aprovado && (
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
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
