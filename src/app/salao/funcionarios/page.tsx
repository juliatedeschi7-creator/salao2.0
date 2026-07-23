'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ShieldCheck, Plus, Edit2, Trash2, UserCheck, 
  ArrowLeft, Search, X, Mail, Phone, Key, Lock, User
} from 'lucide-react'

export default function FuncionariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [convites, setConvites] = useState<any[]>([])
  const [copiado, setCopiado] = useState('')
  const [gerando, setGerando] = useState(false)
  const [excluindo, setExcluindo] = useState('')
  const [modalConvite, setModalConvite] = useState(false)
  const [tipoConvite, setTipoConvite] = useState<'comum' | 'total'>('comum')

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
    const token = crypto.randomUUID()
    const { error } = await supabase.from('convites').insert({
      salao_id: profile!.salao_id,
      email: '',
      role: 'funcionario',
      acesso_total: tipoConvite === 'total',
      token: token
    })
    if (error) {
      console.error('Erro ao gerar convite:', error)
      alert('Erro ao gerar link: ' + error.message)
    }
    setGerando(false)
    setModalConvite(false)
    carregarDados()
  }

  async function excluirConvite(id: string) {
    setExcluindo(id)
    const { error } = await supabase.from('convites').delete().eq('id', id)
    if (error) {
      console.error('Erro ao excluir convite:', error)
      alert('Erro ao excluir: ' + error.message)
    }
    setExcluindo('')
    carregarDados()
  }

  async function alternarAcessoTotal(funcionario: any) {
    await supabase.from('profiles').update({ acesso_total: !funcionario.acesso_total }).eq('id', funcionario.id)
    carregarDados()
  }

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
        <button onClick={() => setModalConvite(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium"
          style={{ backgroundColor: cor }}>
          <Plus size={14} />Convidar
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {convites.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-700">Links de convite pendentes</p>
            {convites.map(c => (
              <div key={c.id} className="card flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">
                    {c.acesso_total ? 'Acesso total (co-gestora)' : 'Funcionario comum'}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => copiarLink(c.token)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: cor }}>
                  {copiado === c.token ? <><Check size={14} />Copiado</> : <><Copy size={14} />Copiar</>}
                </button>
                <button onClick={() => excluirConvite(c.id)} disabled={excluindo === c.id}
                  className="p-2.5 rounded-xl border border-red-200 text-red-500 disabled:opacity-50">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
<button
  onClick={() => router.push('/salao/funcionarios/permissoes')}
  className="px-3 py-1.5 bg-pink-50 text-pink-600 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-pink-100 transition-colors"
>
  <ShieldCheck size={16} />
  Permissões
</button>
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
            <div className="flex flex-col items-end gap-1.5">
              <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (f.aprovado ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600')}>
                {f.aprovado ? 'Ativo' : 'Pendente'}
              </span>
              <button onClick={() => alternarAcessoTotal(f)}
                className={'text-xs px-3 py-1 rounded-full font-medium ' + (f.acesso_total ? 'text-white' : 'bg-gray-100 text-gray-500')}
                style={f.acesso_total ? { backgroundColor: cor } : {}}>
                {f.acesso_total ? 'Acesso Total ✓' : 'Dar acesso total'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalConvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Novo convite</h3>
            <p className="text-sm text-gray-500">Escolha o tipo de acesso para quem usar este link</p>

            <button onClick={() => setTipoConvite('comum')}
              className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
              style={tipoConvite === 'comum' ? { borderColor: cor, backgroundColor: salao?.cor_secundaria || '#FCE4F3' } : { borderColor: '#e5e7eb' }}>
              <p className="font-semibold text-gray-900 text-sm">Funcionario comum</p>
              <p className="text-xs text-gray-500 mt-0.5">Acesso a agenda, clientes e servicos. Sem acesso a configuracoes ou financeiro completo.</p>
            </button>

            <button onClick={() => setTipoConvite('total')}
              className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
              style={tipoConvite === 'total' ? { borderColor: cor, backgroundColor: salao?.cor_secundaria || '#FCE4F3' } : { borderColor: '#e5e7eb' }}>
              <p className="font-semibold text-gray-900 text-sm">Acesso total (co-gestora)</p>
              <p className="text-xs text-gray-500 mt-0.5">Mesmo acesso do dono: financeiro, configuracoes, contratos e gestao completa. Ideal para socias ou familiares.</p>
            </button>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setModalConvite(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={gerarConvite} disabled={gerando} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>{gerando ? '...' : 'Gerar link'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
