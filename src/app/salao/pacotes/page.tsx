'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Edit2 } from 'lucide-react'

export default function PacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescription] = useState('')
  const [preco, setPreco] = useState('')
  const [sessoes, setSessoes] = useState('')
  const [validadeDias, setValidadeDias] = useState('')
  const [regras, setRegras] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }

    // Converte o profile para any para evitar erros de tipagem nas propriedades customizadas
    const p = profile as any

    // 1. Donos, sócios e admins têm acesso total nativo
    const ehAdminOuSocio = ['dono_salao', 'socio', 'admin'].includes(profile.role) || p.acesso_total

    // 2. Se for funcionário comum, verificamos se o dono marcou a permissão específica
    const temPermissaoFuncionario = profile.role === 'funcionario' && (
      p.pode_ver_combos || 
      p.pode_gerenciar_pacotes || 
      p.pode_ver_pacotes ||
      p.acesso_total
    )

    // Se não for nem admin/socio nem tiver a permissão específica liberada pelo dono, bloqueia
    if (!ehAdminOuSocio && !temPermissaoFuncionario) {
      alert('Você não tem permissão para acessar esta página.')
      router.push('/salao/dashboard')
      return
    }

    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: pacs } = await supabase.from('pacotes').select('*').eq('salao_id', profile!.salao_id!).order('nome')
    setPacotes(pacs || [])
  }

  function abrirNovo() {
    setEditando(null)
    setNome('')
    setDescription('')
    setPreco('')
    setSessoes('')
    setValidadeDias('')
    setRegras('')
    setErro('')
    setModal(true)
  }

  function abrirEditar(pacote: any) {
    setEditando(pacote)
    setNome(pacote.nome || '')
    setDescription(pacote.descricao || '')
    setPreco(pacote.preco?.toString() || '')
    setSessoes(pacote.sessoes_inclusas?.toString() || pacote.sessoes?.toString() || '')
    setValidadeDias(pacote.validade_dias?.toString() || '')
    setRegras(pacote.regras || '')
    setErro('')
    setModal(true)
  }

  async function salvar() {
    if (!nome.trim() || !preco || !sessoes) {
      setErro('Preencha os campos obrigatórios.')
      return
    }
    setSalvando(true)
    setErro('')

    const dados = {
      salao_id: profile!.salao_id!,
      nome: nome.trim(),
      descricao: descricao.trim(),
      preco: parseFloat(preco) || 0,
      sessoes_inclusas: parseInt(sessoes) || 1,
      validade_dias: validadeDias ? parseInt(validadeDias) : null,
      regras: regras.trim() || null,
      status: 'ativo'
    }

    let error = null
    if (editando) {
      const res = await supabase.from('pacotes').update(dados).eq('id', editando.id)
      error = res.error
    } else {
      const res = await supabase.from('pacotes').insert(dados)
      error = res.error
    }

    if (error) {
      setErro('Erro ao salvar pacote: ' + error.message)
      setSalvando(false)
      return
    }

    setModal(false)
    setSalvando(false)
    carregarDados()
  }

  async function excluir(id: string) {
    if (!confirm('Tem certeza que deseja excluir este pacote?')) return
    const { error } = await supabase.from('pacotes').delete().eq('id', id)
    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg">Modelos de Pacotes</h1>
        </div>
        <button onClick={abrirNovo} className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
          <Plus size={20} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {pacotes.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400">Nenhum pacote cadastrado ainda</p>
          </div>
        ) : pacotes.map(p => (
          <div key={p.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900">{p.nome}</p>
                <p className="text-xs text-gray-500">{p.descricao}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => abrirEditar(p)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                  <Edit2 size={14} className="text-gray-600" />
                </button>
                <button onClick={() => excluir(p.id)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-600">
                {p.sessoes_inclusas || p.sessoes || 0} sessões
              </span>
              <span className="font-bold text-gray-900">
                R$ {Number(p.preco || 0).toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">{editando ? 'Editar Pacote' : 'Novo Pacote'}</h3>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do Pacote *</label>
              <input className="input-field" placeholder="Ex: Pacote Depilação Completa" value={nome} onChange={e => setNome(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descrição</label>
              <textarea className="input-field resize-none" rows={2} placeholder="O que inclui..." value={descricao} onChange={e => setDescription(e.target.value)} />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Preço (R$) *</label>
                <input type="number" step="0.01" className="input-field" placeholder="0.00" value={preco} onChange={e => setPreco(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Qtd. Sessões *</label>
                <input type="number" className="input-field" placeholder="1" value={sessoes} onChange={e => setSessoes(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Validade em dias (opcional)</label>
              <input type="number" className="input-field" placeholder="Ex: 90 dias" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Regras do pacote (opcional)</label>
              <textarea className="input-field resize-none" rows={2} placeholder="Ex: Agendamento com antecedência..." value={regras} onChange={e => setRegras(e.target.value)} />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{erro}</p>
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={salvando ? undefined : salvar} disabled={salvando} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar Pacote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
