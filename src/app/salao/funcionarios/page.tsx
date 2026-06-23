'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserCheck, Copy, Check, Plus } from 'lucide-react'

export default function FuncionariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [convites, setConvites] = useState<any[]>([])
  const [copiado, setCopiado] = useState('')
  const [gerando, setGerando] = useState(false)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: funcs } = await supabase.from('profiles').select('*').eq('salao_id', profile!.salao_id!).eq('role', 'funcionario')
    setFuncionarios(funcs || [])
    const { data: convs } = await supabase.from('convites').select('*').eq('salao_id', profile!.salao_id!).eq('usado', false).order('created_at', { ascending: false })
    setConvites(convs || [])
  }

  async function gerarConvite() {
    setGerando(true)
    await supabase.from('convites').insert({ salao_id: profile!.salao_id, email: '', role: 'funcionario' })
    setGerando(false); carregarDados()
  }

async function alternarAcessoTotal(funcionario: any) {
  await supabase.from('profiles').update({ acesso_total: !funcionario.acesso_total }).eq('id', funcionario.id)
  carregarDados()
}

<button onClick={() => alternarAcessoTotal(f)}
  className={'text-xs px-3 py-1.5 rounded-full font-medium ' + (f.acesso_total ? 'text-white' : 'bg-gray-100 text-gray-500')}
  style={f.acesso_total ? { backgroundColor: cor } : {}}>
  {f.acesso_total ? 'Acesso Total ✓' : 'Dar acesso total'}
</button>

  function copiarLink(token: string) {
    const link = window.location.origin + '/cadastro?token=' + token
    navigator.clipboard.writeText(link)
    setCopiado(token)
    setTimeout(() => setCopiado(''), 2000)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Funcionarios</h1>
        <button onClick={gerarConvite} disabled={gerando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium"
          style={{ backgroundColor: cor }}>
          <Plus size={14} />{gerando ? '...' : 'Convidar'}
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {convites.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-700">Links de convite pendentes</p>
            {convites.map(c => (
              <div key={c.id} className="card flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-400">Token: {c.token?.substring(0, 16)}...</p>
                  <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => copiarLink(c.token)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: cor }}>
                  {copiado === c.token ? <><Check size={14} />Copiado</> : <><Copy size={14} />Copiar</>}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-sm font-semibold text-gray-700">Funcionarios ({funcionarios.length})</p>
        {funcionarios.length === 0 ? (
          <div className="card text-center py-10">
            <UserCheck size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum funcionario cadastrado</p>
            <p className="text-xs text-gray-400 mt-1">Gere um link de convite acima</p>
          </div>
        ) : funcionarios.map(f => (
          <div key={f.id} className="card flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
              style={{ backgroundColor: cor }}>
              {f.nome?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{f.nome}</p>
              <p className="text-sm text-gray-400">{f.email}</p>
            </div>
            <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (f.aprovado ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600')}>
              {f.aprovado ? 'Ativo' : 'Pendente'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
