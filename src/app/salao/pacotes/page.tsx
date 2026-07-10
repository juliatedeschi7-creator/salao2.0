'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Package, Edit2, Trash2, Users, X } from 'lucide-react'

export default function PacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({
    nome: '', descricao: '', preco: '', validade_dias: '', regras: '', categoria: ''
  })
  const [itens, setItens] = useState<{ servico_id: string; nome: string; quantidade: number }[]>([])
  const [servicoAdd, setServicoAdd] = useState('')
  const [qtdAdd, setQtdAdd] = useState(1)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (profile.role !== 'dono_salao' && profile.role !== 'funcionario') { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    // Corrigido: filtra por "ativo" (boolean), mesma coluna que a tela do
    // cliente usa. Antes filtrava por "status" = 'ativo', que é uma coluna
    // diferente e nunca era preenchida ao salvar — por isso os pacotes
    // nunca apareciam pras clientes.
    const { data: pacs } = await supabase
      .from('pacotes')
      .select('*, pacote_itens(*, servicos(nome, preco))')
      .eq('salao_id', profile!.salao_id!)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
    setPacotes(pacs || [])

    const { data: srvs } = await supabase
      .from('servicos').select('id, nome, preco, duracao_minutos')
      .eq('salao_id', profile!.salao_id!).eq('ativo', true).order('nome')
    setServicos(srvs || [])
  }

  function abrirModal(p?: any) {
    if (p) {
      setEditando(p)
      setForm({
        nome: p.nome, descricao: p.descricao || '', preco: p.preco.toString(),
        validade_dias: p.validade_dias?.toString() || '', regras: p.regras || '', categoria: p.categoria || ''
      })
      setItens((p.pacote_itens || []).map((i: any) => ({
        servico_id: i.servico_id, nome: i.servicos?.nome || '', quantidade: i.quantidade
      })))
    } else {
      setEditando(null)
      setForm({ nome: '', descricao: '', preco: '', validade_dias: '', regras: '', categoria: '' })
      setItens([])
    }
    setServicoAdd('')
    setQtdAdd(1)
    setModal(true)
  }

  function adicionarItem() {
    if (!servicoAdd) return
    const srv = servicos.find(s => s.id === servicoAdd)
    if (!srv) return
    const existe = itens.find(i => i.servico_id === servicoAdd)
    if (existe) {
      setItens(prev => prev.map(i => i.servico_id === servicoAdd
        ? { ...i, quantidade: i.quantidade + qtdAdd } : i))
    } else {
      setItens(prev => [...prev, { servico_id: servicoAdd, nome: srv.nome, quantidade: qtdAdd }])
    }
    setServicoAdd('')
    setQtdAdd(1)
  }

  function removerItem(servicoId: string) {
    setItens(prev => prev.filter(i => i.servico_id !== servicoId))
  }

  async function salvar() {
    if (!form.nome || !form.preco || itens.length === 0) return
    setSalvando(true)

    const totalSessoes = itens.reduce((acc, i) => acc + i.quantidade, 0)

    const dados = {
      salao_id: profile!.salao_id,
      nome: form.nome,
      descricao: form.descricao || null,
      // Renomeado de "sessoes" para "sessoes_inclusas" — é o nome de coluna
      // que a tela do cliente lê para mostrar "X sessões" no card do pacote.
      sessoes_inclusas: totalSessoes,
      preco: parseFloat(form.preco),
      validade_dias: form.validade_dias ? parseInt(form.validade_dias) : null,
      regras: form.regras || null,
      categoria: form.categoria || null,
      // Corrigido: "ativo" boolean em vez de "status" texto, para bater
      // com a coluna que a tela do cliente filtra.
      ativo: true,
      criado_por: profile!.id,
    }

    let pacoteId = editando?.id
    if (editando) {
      await supabase.from('pacotes').update(dados).eq('id', editando.id)
      await supabase.from('pacote_itens').delete().eq('pacote_id', editando.id)
    } else {
      const { data: novo } = await supabase.from('pacotes').insert(dados).select().single()
      pacoteId = novo?.id
    }

    if (pacoteId && itens.length > 0) {
      await supabase.from('pacote_itens').insert(
        itens.map(i => ({ pacote_id: pacoteId, servico_id: i.servico_id, quantidade: i.quantidade }))
      )
    }

    setModal(false)
    setSalvando(false)
    carregarDados()
  }

  async function excluir(id: string) {
    // Corrigido: desativa via "ativo: false" (mesma coluna usada na listagem)
    await supabase.from('pacotes').update({ ativo: false }).eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Pacotes</h1>
        <button onClick={() => abrirModal()}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <button onClick={() => router.push('/salao/pacotes/clientes')}
          className="card flex items-center gap-3 active:scale-95 transition-all">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: corSec }}>
            <Users size={20} style={{ color: cor }} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-gray-900">Pacotes por Cliente</p>
            <p className="text-xs text-gray-400">Ver sessões, histórico e vender pacotes</p>
          </div>
        </button>

        <p className="text-sm font-semibold text-gray-700 mt-2">Modelos de Pacotes</p>

        {pacotes.length === 0 ? (
          <div className="card text-center py-10">
            <Package size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum pacote criado</p>
            <p className="text-xs text-gray-300 mt-1">Crie pacotes com serviços mistos</p>
          </div>
        ) : pacotes.map(p => (
          <div key={p.id} className="card flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-bold text-gray-900">{p.nome}</p>
                {p.descricao && <p className="text-sm text-gray-500 mt-0.5">{p.descricao}</p>}
              </div>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <button onClick={() => abrirModal(p)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Edit2 size={14} className="text-gray-500" />
                </button>
                <button onClick={() => excluir(p.id)}
                  className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>

            {/* Itens do pacote */}
            {p.pacote_itens?.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {p.pacote_itens.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-sm text-gray-700">{item.servicos?.nome}</p>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: cor }}>
                      {item.quantidade}x
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {p.validade_dias && (
                  <span className="text-xs text-gray-400">Validade: {p.validade_dias} dias</span>
                )}
              </div>
              <p className="font-bold text-lg" style={{ color: cor }}>
                R$ {Number(p.preco).toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">
              {editando ? 'Editar Pacote' : 'Novo Pacote'}
            </h3>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do pacote</label>
              <input className="input-field" placeholder="Ex: Pacote Mimo — Mãos e Pés"
                value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descrição</label>
              <textarea className="input-field resize-none" rows={2}
                value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>

            {/* Serviços do pacote */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Serviços inclusos</label>

              {itens.map(item => (
                <div key={item.servico_id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-sm text-gray-800 flex-1">{item.nome}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setItens(prev => prev.map(i =>
                      i.servico_id === item.servico_id && i.quantidade > 1
                        ? { ...i, quantidade: i.quantidade - 1 } : i))}
                      className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center">
                      −
                    </button>
                    <span className="text-sm font-bold text-gray-900 w-5 text-center">{item.quantidade}</span>
                    <button onClick={() => setItens(prev => prev.map(i =>
                      i.servico_id === item.servico_id ? { ...i, quantidade: i.quantidade + 1 } : i))}
                      className="w-6 h-6 rounded-full text-white text-sm font-bold flex items-center justify-center"
                      style={{ backgroundColor: cor }}>
                      +
                    </button>
                    <button onClick={() => removerItem(item.servico_id)} className="ml-1">
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <select className="input-field flex-1 text-sm" value={servicoAdd}
                  onChange={e => setServicoAdd(e.target.value)}>
                  <option value="">+ Adicionar serviço...</option>
                  {servicos.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
                <button onClick={adicionarItem}
                  className="px-4 py-2 rounded-2xl text-white text-sm font-medium shrink-0"
                  style={{ backgroundColor: servicoAdd ? cor : '#d1d5db' }}>
                  Adicionar
                </button>
              </div>

              {itens.length === 0 && (
                <p className="text-xs text-red-400">Adicione pelo menos um serviço ao pacote</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Preço (R$)</label>
                <input className="input-field" type="number" value={form.preco}
                  onChange={e => setForm(p => ({ ...p, preco: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Validade (dias)</label>
                <input className="input-field" type="number" placeholder="Ex: 90"
                  value={form.validade_dias}
                  onChange={e => setForm(p => ({ ...p, validade_dias: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Regras (opcional)</label>
              <textarea className="input-field resize-none" rows={2}
                placeholder="Ex: Não acumula com outras promoções"
                value={form.regras} onChange={e => setForm(p => ({ ...p, regras: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando || itens.length === 0}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
