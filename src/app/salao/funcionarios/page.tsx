'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { 
  ShieldCheck, Plus, Edit2, Trash2, UserCheck, 
  ArrowLeft, Search, X, Mail, Phone, Key, Lock, User,
  Check, Copy, UserCog, Sparkles
} from 'lucide-react'

// Opções de cargos disponíveis
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

  // Estados de ações
  const [modalCargo, setModalCargo] = useState<any | null>(null)
  const [cargoSelecionado, setCargoSelecionado] = useState<string>('')
  const [salvandoCargo, setSalvandoCargo] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    const [salRes, funcRes, convRes] = await Promise.all([
      supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
      supabase.from('profiles').select('*').eq('salao_id', profile!.salao_id!).order('nome', { ascending: true }),
      supabase.from('convites_funcionarios').select('*').eq('salao_id', profile!.salao_id!).eq('usado', false)
    ])

    setSalao(salRes.data)
    setFuncionarios(funcRes.data || [])
    setConvites(convRes.data || [])
    setCarregando(false)
  }

  // ─── SALVAR NOVO CARGO DO FUNCIONÁRIO ──────────────────────────────
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
      carregarDados()
    } catch (err: any) {
      alert('Erro ao atualizar cargo: ' + (err.message || 'Tente novamente.'))
    } finally {
      setSalvandoCargo(false)
    }
  }

  // Copiar link de convite
  function copiarConvite(token: string) {
    const link = `${window.location.origin}/cadastro-funcionario?token=${token}`
    navigator.clipboard.writeText(link)
    setCopiado(token)
    setTimeout(() => setCopiado(null), 2000)
  }

  // Excluir convite
  async function excluirConvite(id: string) {
    setExcluindo(id)
    await supabase.from('convites_funcionarios').delete().eq('id', id)
    setConvites(prev => prev.filter(c => c.id !== id))
    setExcluindo(null)
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  function getBadgeCargo(role: string) {
    const cargoObj = CARGOS.find(c => c.id === role?.toLowerCase()) || {
      label: role || 'Sem Cargo',
      corBg: 'bg-gray-100',
      corTexto: 'text-gray-700',
      corBorder: 'border-gray-200'
    }

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cargoObj.corBg} ${cargoObj.corTexto} ${cargoObj.corBorder}`}>
        {cargoObj.label}
      </span>
    )
  }

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pb-8">
        <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg">Equipe e Cargos</h1>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-4 rounded-2xl animate-pulse h-20" />
          ))}
        </div>
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
          <h1 className="font-bold text-gray-900 text-lg">Equipe & Cargos</h1>
        </div>

        <button
          onClick={() => router.push('/salao/funcionarios/novo')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-xs font-bold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Convida
        </button>
      </div>

      <div className="p-4 space-y-5">

        {/* ATALHO PARA PERMISSÕES DETALHADAS */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Matriz de Permissões</p>
              <p className="text-xs text-gray-400">Configure o que cada cargo pode ver ou editar</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/salao/permissoes')}
            className="px-3 py-1.5 bg-pink-50 text-pink-600 rounded-xl text-xs font-bold hover:bg-pink-100 transition-colors">
            Ajustar Telas
          </button>
        </div>

        {/* LINKS DE CONVITE PENDENTES */}
        {convites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Convites Pendentes</p>
            {convites.map(c => (
              <div key={c.id} className="bg-white p-3.5 rounded-2xl border border-amber-200/60 bg-amber-50/30 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-gray-800">Link de Acesso Criado</p>
                  <p className="text-[11px] text-gray-400">Criado em: {new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
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
                    className="p-1.5 text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LISTA DE INTEGRANTES DA EQUIPE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Integrantes da Equipe ({funcionarios.length})
            </p>
          </div>

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
                        <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mb-1.5">{f.email}</p>
                    {getBadgeCargo(f.role || f.cargo)}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setModalCargo(f)
                    setCargoSelecionado(f.role || f.cargo || 'profissional')
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 shrink-0">
                  <UserCog size={14} className="text-gray-500" /> Alterar Cargo
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── MODAL DE SELEÇÃO DE CARGO ──────────────────────────────── */}
      {modalCargo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <UserCog size={20} style={{ color: cor }} /> Definir Função / Cargo
              </h3>
              <button onClick={() => setModalCargo(null)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Selecione o cargo oficial para <strong>{modalCargo.nome}</strong> no salão:
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
