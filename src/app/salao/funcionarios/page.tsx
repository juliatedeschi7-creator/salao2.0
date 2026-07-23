'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  ShieldCheck, Plus, Trash2, ArrowLeft, X, Copy, Check, UserCog 
} from 'lucide-react'

const CARGOS = [
  { id: 'dono', label: 'Dono / Acesso Total', corBg: 'bg-pink-100', corTexto: 'text-pink-700', corBorder: 'border-pink-300' },
  { id: 'gerente', label: 'Gerente', corBg: 'bg-purple-100', corTexto: 'text-purple-700', corBorder: 'border-purple-300' },
  { id: 'recepcionista', label: 'Recepcionista', corBg: 'bg-blue-100', corTexto: 'text-blue-700', corBorder: 'border-blue-300' },
  { id: 'profissional', label: 'Profissional / Atendente', corBg: 'bg-gray-800', corTexto: 'text-white', corBorder: 'border-gray-800' },
  { id: 'auxiliar', label: 'Auxiliar', corBg: 'bg-amber-100', corTexto: 'text-amber-700', corBorder: 'border-amber-300' }
]

export default function FuncionariosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  
  const [salao, setSalao] = useState<any>(null)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [convites, setConvites] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalCargo, setModalCargo] = useState<any | null>(null)
  const [cargoSelecionado, setCargoSelecionado] = useState<string>('')
  const [salvandoCargo, setSalvandoCargo] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  useEffect(() => {
    // Validação de segurança anti-trava: se passar de 4 segundos e o auth/loading travar, libera a tela
    const timerTimeout = setTimeout(() => {
      setCarregando(false)
    }, 4000)

    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    const roleUsuario = (profile.role || '').toLowerCase()
    const ehDonoOuAdmin = ['dono', 'admin', 'admin_geral'].includes(roleUsuario)

    // Se não for estritamente dono/admin, mandamos de volta para o painel geral do salão
    if (!ehDonoOuAdmin && profile.role) {
      router.push('/salao')
      return
    }

    if (profile.salao_id) {
      carregarDados(profile.salao_id)
    } else {
      setCarregando(false)
    }

    return () => clearTimeout(timerTimeout)
  }, [loading, profile])

  async function carregarDados(salaoId: string) {
    setCarregando(true)
    
    try {
      const [salRes, funcRes, convRes] = await Promise.all([
        supabase.from('saloes').select('*').eq('id', salaoId).single(),
        supabase
          .from('profiles')
          .select('*')
          .eq('salao_id', salaoId)
          .neq('role', 'cliente')
          .order('nome', { ascending: true }),
        supabase.from('convites_funcionarios').select('*').eq('salao_id', salaoId).eq('usado', false)
      ])

      setSalao(salRes.data)
      
      const apenasEquipe = (funcRes.data || []).filter((u: any) => u.role !== 'cliente' && u.tipo !== 'cliente')
      setFuncionarios(apenasEquipe)
      setConvites(convRes.data || [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function handleSalvarCargo() {
    if (!modalCargo || !cargoSelecionado) return
    setSalvandoCargo(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: cargoSelecionado, cargo: cargoSelecionado })
        .eq('id', modalCargo.id)

      if (error) throw error

      setModalCargo(null)
      if (profile?.salao_id) {
        carregarDados(profile.salao_id)
      }
    } catch (err: any) {
      alert('Erro ao atualizar cargo: ' + (err.message || 'Tente novamente.'))
    } finally {
      setSalvandoCargo(false)
    }
  }

  function copiarConvite(token: string) {
    const link = `${window.location.origin}/cadastro-funcionario?token=${token}`
    navigator.clipboard.writeText(link)
    setCopiado(token)
    setTimeout(() => setCopiado(null), 2000)
  }

  async function excluirConvite(id: string) {
    setExcluindo(id)
    await supabase.from('convites_funcionarios').delete().eq('id', id)
    setConvites(prev => prev.filter(c => c.id !== id))
    setExcluindo(null)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-pink-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-lg">Funcionários</h1>
        </div>

        <button
          onClick={() => router.push('/salao/funcionarios/novo')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-xs font-bold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Convidar
        </button>
      </div>

      <div className="p-4 space-y-5">

        {/* ATALHO PARA PERMISSÕES */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Permissões de Acesso</p>
              <p className="text-xs text-gray-400">Configure o acesso por cargo</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/salao/permissoes')}
            className="px-3 py-1.5 bg-pink-50 text-pink-600 rounded-xl text-xs font-bold hover:bg-pink-100 transition-colors">
            Permissões
          </button>
        </div>

        {/* LINKS DE CONVITE PENDENTES */}
        {convites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Links de convite pendentes</p>
            {convites.map(c => (
              <div key={c.id} className="bg-white p-3.5 rounded-2xl border border-gray-100 flex items-center justify-between gap-2 shadow-sm">
                <div>
                  <p className="text-xs font-bold text-gray-800">Funcionário comum</p>
                  <p className="text-[11px] text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => copiarConvite(c.token)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                    style={{ backgroundColor: cor }}>
                    {copiado === c.token ? <Check size={14} /> : <Copy size={14} />}
                    {copiado === c.token ? 'Copiado' : 'Copiar'}
                  </button>
                  <button 
                    onClick={() => excluirConvite(c.id)}
                    disabled={excluindo === c.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 border rounded-xl">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LISTA DE INTEGRANTES DA EQUIPE */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Funcionários ({funcionarios.length})
          </p>

          {funcionarios.map(f => {
            const ehUsuarioAtual = f.id === profile?.id
            return (
              <div key={f.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                    style={{ backgroundColor: cor }}>
                    {f.nome?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-sm truncate">{f.nome}</p>
                      {ehUsuarioAtual && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mb-1.5">{f.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setModalCargo(f)
                    setCargoSelecionado(f.role || f.cargo || 'profissional')
                  }}
                  className="px-3.5 py-2 rounded-full text-xs font-bold text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: cor }}>
                  {f.role === 'dono' || f.role === 'gerente' ? 'Acesso Total ✓' : 'Dar acesso'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* MODAL DE SELEÇÃO DE CARGO */}
      {modalCargo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <UserCog size={20} style={{ color: cor }} /> Definir Cargo do Funcionário
              </h3>
              <button onClick={() => setModalCargo(null)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Selecione o cargo para <strong>{modalCargo.nome}</strong>:
            </p>

            <div className="flex flex-col gap-2">
              {CARGOS.map(c => (
                <label 
                  key={c.id}
                  onClick={() => setCargoSelecionado(c.id)}
                  className={`border p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                    cargoSelecionado === c.id ? 'border-2 bg-pink-50/40' : 'border-gray-200'
                  }`}
                  style={{ borderColor: cargoSelecionado === c.id ? cor : undefined }}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${c.corBg} border ${c.corBorder}`} />
                    <span className="text-sm font-bold text-gray-800">{c.label}</span>
                  </div>
                  <input 
                    type="radio" 
                    name="cargoOpcao"
                    checked={cargoSelecionado === c.id} 
                    onChange={() => setCargoSelecionado(c.id)}
                    className="w-4 h-4"
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setModalCargo(null)} 
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium">
                Cancelar
              </button>
              <button 
                onClick={handleSalvarCargo} 
                disabled={salvandoCargo}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-medium" 
                style={{ backgroundColor: cor }}>
                {salvandoCargo ? 'Salvando...' : 'Confirmar Cargo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

