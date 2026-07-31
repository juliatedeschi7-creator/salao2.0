'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Package, Edit2, Trash2, Users, X, Share2, Scissors, Sparkles, Heart, Star, Crown, Flower2, Gift, User } from 'lucide-react'

// Mapeamento de ícones disponíveis para as categorias
const ICONES_CATEGORIA: { [key: string]: any } = {
  Scissors,
  Sparkles,
  Heart,
  Star,
  Crown,
  Flower2,
  Gift,
  User,
  Package
}

export default function PacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({
    nome: '', descricao: '', preco: '', validade_dias: '', regras: '', categoria: '', icone: 'Package'
  })
  const [itens, setItens] = useState<{ servico_id: string; nome: string; quantidade: number }[]>([])
  const [servicoAdd, setServicoAdd] = useState('')
  const [qtdAdd, setQtdAdd] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }

    // Validação robusta liberando donos, sócios, administradores e funcionários com acesso total
    const cargoValido = ['dono_salao', 'funcionario', 'socio', 'admin'].includes(profile.role) || profile.acesso_total
    if (!cargoValido) { 
      router.push('/login')
      return 
    }

    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: pacs } = await supabase
      .from('pacotes')
      .select('*, pacote_itens(*, servicos(nome, preco))')
      .eq('salao_id', profile!.salao_id!)
      .eq('status', 'ativo')
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
        nome: p.nome, 
        descricao: p.descricao || '', 
        preco: p.preco.toString(),
        validade_dias: p.validade_dias?.toString() || '', 
        regras: p.regras || '', 
        categoria: p.categoria || '',
        icone: p.icone || 'Package'
      })
      setItens((p.pacote_itens || []).map((i: any) => ({
        servico_id: i.servico_id, nome: i.servicos?.nome || '', quantidade: i.quantidade
      })))
    } else {
      setEditando(null)
      setForm({ nome: '', descricao: '', preco: '', validade_dias: '', regras: '', categoria: '', icone: 'Package' })
      setItens([])
    }
    setServicoAdd('')
    setQtdAdd(1)
    setErro('')
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

  function compartilharPacote(p: any) {
    const precoFormatado = Number(p.preco).toFixed(2).replace('.', ',')
    let texto = `✨ Confira o pacote *${p.nome}*!\n`
    if (p.descricao) texto += `${p.descricao}\n`
    
    if (p.pacote_itens?.length > 0) {
      texto += `\n📋 *Incluso:*\n`
      p.pacote_itens.forEach((item: any) => {
        texto += `• ${item.quantidade}x ${item.servicos?.nome}\n`
      })
    }

    if (p.validade_dias) {
      texto += `\n⏳ Validade: ${p.validade_dias} dias`
    }

    texto += `\n\n💰 *Valor: R$ ${precoFormatado}*\nEntre em contato para garantir o seu!`

    if (navigator.share) {
      navigator.share({
        title: p.nome,
        text: texto,
        url: window.location.href,
      }).catch((err) => console.log('Erro ao compartilhar:', err))
    } else {
      navigator.clipboard.writeText(texto)
      alert('Informações do pacote copiadas para a área de transferência!')
    }
  }

  async function salvar() {
    if (!form.nome || !form.preco || itens.length === 0) return
    setSalvando(true)
    setErro('')

    const dados = {
      salao_id: profile!.salao_id,
      nome: form.nome,
      descricao: form.descricao || null,
      sessoes: itens.reduce((acc, i) => acc + i.quantidade, 0),
      preco: parseFloat(form.preco),
      validade_dias: form.validade_dias ? parseInt(form.validade_dias) : null,
      regras: form.regras || null,
      categoria: form.categoria || null,
      icone: form.icone || 'Package',
      status: 'ativo',
      criado_por: profile!.id,
    }

    let pacoteId = editando?.id
    if (editando) {
      const { error } = await supabase.from('pacotes').update(dados).eq('id', editando.id)
      if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return }
      await supabase.from('pacote_itens').delete().eq('pacote_id', editando.id)
    } else {
      const { data: novo, error } = await supabase.from('pacotes').insert(dados).select().single()
      if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return }
      pacoteId = novo?.id
    }

    if (pacoteId && itens.length > 0) {
      const { error: errItens } = await supabase.from('pacote_itens').insert(
        itens.map(i => ({ pacote_id: pacoteId, servico_id: i.servico_id, quantidade: i.quantidade }))
      )
      if (errItens) { setErro('Pacote salvo, mas houve erro nos itens: ' + errItens.message); setSalvando(false); return }
    }

    setModal(false)
    setSalvando(false)
    carregarDados()
  }

  async function excluir(id: string) {
    await supabase.from('pacotes').update({ status: 'inativo' }).eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'

  const listaIcones = [
    { id: 'Package', label: 'Pacote', icon: Package },
    { id: 'Scissors', label: 'Cabelo/Estética', icon: Scissors },
    { id: 'Sparkles', label: 'Brilho/Make', icon: Sparkles },
    { id: 'Heart', label: 'Especial', icon: Heart },
    { id: 'Star', label: 'Destaque', icon: Star },
    { id: 'Crown', label: 'VIP', icon: Crown },
    { id: 'Flower2', label: 'Spa/Relax', icon: Flower2 },
    { id: 'Gift', label: 'Presente', icon: Gift },
  ]

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Gerenciar Pacotes</h1>
        <button onClick={() => abrirModal()}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md"
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

        <p className="text-sm font-semibold text-gray-700 mt-2">Modelos de Pacotes Cadastrados</p>

        {pacotes.length === 0 ? (
          <div className="card text-center py-10">
            <Package size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum pacote criado</p>
            <p className="text-xs text-gray-300 mt-1">Crie pacotes promocionais com serviços mistos</p>
          </div>
        ) : pacotes.map(p => {
          const IconComponent = ICONES_CATEGORIA[p.icone || 'Package'] || Package
          return (
            <div key={p.id} className="card flex flex-col gap-3 relative border-2" style={{ borderColor: `${cor}33` }}>
              
              {/* Badge super destacada escrito PACOTE */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider text-white shadow-sm"
                  style={{ backgroundColor: cor }}>
                  <Package size={14} />
                  <span>PACOTE PROMOCIONAL</span>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => compartilharPacote(p)}
                    className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shadow-sm" title="Compartilhar Pacote">
                    <Share2 size={14} className="text-emerald-600" />
                  </button>
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

              {/* Informações principais com ícone personalizado */}
              <div className="flex items-start gap-3 mt-1">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"
                  style={{ backgroundColor: corSec }}>
                  <IconComponent size={24} style={{ color: cor }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-gray-900 text-base">{p.nome}</h3>
                  {p.descricao && <p className="text-sm text-gray-500 mt-0.5">{p.descricao}</p>}
                  {p.categoria && (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 mt-1">
                      {p.categoria}
                    </span>
                  )}
                </div>
              </div>

              {/* Itens do pacote */}
              {p.pacote_itens?.length > 0 && (
                <div className="flex flex-col gap-1.5 bg-gray-50/80 p-2.5 rounded-2xl">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Serviços Inclusos:</span>
                  {p.pacote_itens.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between px-1">
                      <p className="text-sm font-medium text-gray-700">• {item.servicos?.nome}</p>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: cor }}>
                        {item.quantidade}x
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {p.validade_dias && (
                    <span className="text-xs text-gray-400 font-medium">Validade: {p.validade_dias} dias</span>
                  )}
                </div>
                <p className="font-black text-xl" style={{ color: cor }}>
                  R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                {editando ? 'Editar Pacote' : 'Novo Pacote'}
              </h3>
              <button onClick={() => setModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do pacote</label>
              <input className="input-field" placeholder="Ex: Pacote Mimo — Mãos e Pés"
                value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>

            {/* Seletor de Ícone Estilo "Desenho" */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Escolha o ícone do pacote</label>
              <div className="grid grid-cols-4 gap-2">
                {listaIcones.map(item => {
                  const Icon = item.icon
                  const selecionado = form.icone === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, icone: item.id }))}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 ${
                        selecionado ? 'shadow-sm' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                      }`}
                      style={{
                        borderColor: selecionado ? cor : 'transparent',
                        backgroundColor: selecionado ? corSec : undefined
                      }}
                    >
                      <Icon size={22} style={{ color: selecionado ? cor : '#6b7280' }} />
                      <span className="text-[10px] font-semibold text-gray-600">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Categoria (opcional)</label>
                <input className="input-field" placeholder="Ex: Cabelo,Unhas"
                  value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Validade (dias)</label>
                <input className="input-field" type="number" placeholder="Ex: 90"
                  value={form.validade_dias}
                  onChange={e => setForm(p => ({ ...p, validade_dias: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descrição</label>
              <textarea className="input-field resize-none" rows={2} placeholder="Breve descrição dos benefícios..."
                value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>

            {/* Serviços do pacote */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Serviços inclusos no pacote</label>

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

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Preço do Pacote (R$)</label>
              <input className="input-field text-lg font-bold" type="number" placeholder="0,00" value={form.preco}
                onChange={e => setForm(p => ({ ...p, preco: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Regras (opcional)</label>
              <textarea className="input-field resize-none" rows={2}
                placeholder="Ex: Não acumula com outras promoções"
                value={form.regras} onChange={e => setForm(p => ({ ...p, regras: e.target.value }))} />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{erro}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando || itens.length === 0}
                className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-50 shadow-md"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar Pacote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
