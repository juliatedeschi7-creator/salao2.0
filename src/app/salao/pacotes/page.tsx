'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Edit3, Check, X } from 'lucide-react'

export default function PacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    preco: '',
    sessoes_inclusas: '1',
    validade_dias: '30',
    regras: ''
  })

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }

    const p = profile as any
    // 1. Donos, sócios e admins têm acesso total nativo
    const ehAdminOuSocio = ['dono_salao', 'socio', 'admin'].includes(profile.tipo) || p.acesso_total

    // 2. Se for funcionário comum, verificamos se o dono marcou a permissão específica
    const temPermissaoFuncionario = profile.tipo === 'funcionario' && (
      p.acesso_total === true ||
      p.pode_ver_combos === true ||
      p.pode_gerenciar_pacotes === true ||
      p.pode_ver_pacotes === true
    )

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
    setForm({
      nome: '',
      descricao: '',
      preco: '',
      sessoes_inclusas: '5',
      validade_dias: '60',
      regras: 'O pacote é pessoal e intransferível.\nValidade impressa deve ser respeitada.\nCancelamentos com menos de 24h implicam em perda da sessão.'
    })
    setErro('')
    setModal(true)
  }

  function abrirEditar(pacote: any) {
    setEditando(pacote)
    setForm({
      nome: pacote.nome || '',
      descricao: pacote.descricao || '',
      preco: pacote.preco ? String(pacote.preco) : '',
      sessoes_inclusas: String(pacote.sessoes_inclusas || 1),
      validade_dias: pacote.validade_dias ? String(pacote.validade_dias) : '30',
      regras: pacote.regras || ''
    })
    setErro('')
    setModal(true)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.preco) {
      setErro('Preencha o nome e o preço do pacote.')
      return
    }
    setSalvando(true)
    setErro('')

    const dados = {
      salao_id: profile!.salao_id,
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      preco: parseFloat(form.preco) || 0,
      sessoes_inclusas: parseInt(form.sessoes_inclusas) || 1,
      validade_dias: parseInt(form.validade_dias) || 30,
      regras: form.regras.trim(),
      status: 'ativo'
    }

    let erroSupabase = null
    if (editando) {
      const { error } = await supabase.from('pacotes').update(dados).eq('id', editando.id)
      erroSupabase = error
    } else {
      const { error } = await supabase.from('pacotes').insert(dados)
      erroSupabase = error
    }

    if (erroSupabase) {
      setErro('Erro ao salvar: ' + erroSupabase.message)
      setSalvando(false)
      return
    }

    setModal(false)
    setSalvando(false)
    carregarDados()
  }

  async function alternarStatus(pacote: any) {
    const novoStatus = pacote.status === 'ativo' ? 'inativo' : 'ativo'
    const { error } = await supabase.from('pacotes').update({ status: novoStatus }).eq('id', pacote.id)
    if (error) {
      alert('Erro ao alterar status: ' + error.message)
      return
    }
    carregarDados()
  }

  async function excluir(id: string) {
    if (!confirm('Deseja realmente excluir este pacote?')) return
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
          <h1 className="font-bold text-gray-900 text-lg">Gerenciar Pacotes</h1>
        </div>
        <button onClick={abrirNovo} className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
          <Plus size={20} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {pacotes.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400 text-sm">Nenhum pacote cadastrado ainda</p>
          </div>
        ) : (
          pacotes.map(p => (
            <div key={p.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-base">{p.nome}</p>
                  {p.descricao && <p className="text-xs text-gray-500 mt-0.5">{p.descricao}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-base" style={{ color: cor }}>
                    R$ {Number(p.preco).toFixed(2)}
                  </p>
                  <span className={'text-[10px] px-2 py-0.5 rounded-full font-medium inline-block mt-1 ' + (p.status === 'ativo' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500')}>
                    {p.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-2 mt-1">
                <span>📦 {p.sessoes_inclusas} sessões</span>
                <span>⏳ {p.validade_dias} dias de validade</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => alternarStatus(p)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 font-medium">
                  {p.status === 'ativo' ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => abrirEditar(p)} className="p-1.5 rounded-lg bg-gray-50 text-gray-600">
                  <Edit3 size={15} />
                </button>
                <button onClick={() => excluir(p.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">{editando ? 'Editar Pacote' : 'Novo Pacote'}</h3>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do Pacote</label>
              <input className="input-field" placeholder="Ex: Pacote 10 Sessões de Massagem"
                value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descrição (opcional)</label>
              <input className="input-field" placeholder="Ex: Válido para massagem relaxante ou modeladora"
                value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Preço (R$)</label>
                <input className="input-field" type="number" step="0.01" placeholder="0.00"
                  value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} />
              </div>
              <div className="w-28">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Sessões</label>
                <input className="input-field" type="number" min="1"
                  value={form.sessoes_inclusas} onChange={e => setForm(f => ({ ...f, sessoes_inclusas: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Validade em dias</label>
              <input className="input-field" type="number" min="1" placeholder="Ex: 60"
                value={form.validade_dias} onChange={e => setForm(f => ({ ...f, validade_dias: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Regras do Pacote (exibidas para a cliente)</label>
              <textarea className="input-field resize-none" rows={3} placeholder="Descreva as regras de uso..."
                value={form.regras} onChange={e => setForm(f => ({ ...f, regras: e.target.value }))} />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{erro}</p>
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={salvando ? undefined : salvar} disabled={salvando} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
