'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Plus, Edit2, Trash2, Clock, DollarSign, Image, Tag, X } from 'lucide-react'

export default function ServicosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [fotos, setFotos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')
  const [modal, setModal] = useState(false)
  const [modalCategorias, setModalCategorias] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [editandoCategoria, setEditandoCategoria] = useState<any>(null)
  const [form, setForm] = useState({
    nome: '', descricao: '', categoria: '', duracao_minutos: 60,
    sessoes: 1, preco: '', custo_material: '', comissao_percentual: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [uploadando, setUploadando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: srvs, error: errSrv } = await supabase.from('servicos').select('*').eq('salao_id', profile!.salao_id!).eq('ativo', true).order('categoria')
    if (errSrv) console.error('Erro ao carregar servicos:', errSrv)
    setServicos(srvs || [])
    const { data: fts } = await supabase.from('fotos_servicos').select('*').eq('salao_id', profile!.salao_id!)
    setFotos(fts || [])
    const { data: cats } = await supabase.from('categorias_servicos').select('*').eq('salao_id', profile!.salao_id!).order('nome')
    setCategorias(cats || [])
    if (cats && cats.length > 0 && !form.categoria) setForm(p => ({ ...p, categoria: cats[0].nome }))
  }

  function abrirModal(s?: any) {
    setErroSalvar('')
    if (s) {
      setEditando(s)
      setForm({
        nome: s.nome, descricao: s.descricao || '', categoria: s.categoria,
        duracao_minutos: s.duracao_minutos, sessoes: s.sessoes || 1,
        preco: s.preco.toString(), custo_material: s.custo_material?.toString() || '',
        comissao_percentual: s.comissao_percentual?.toString() || '',
      })
    } else {
      setEditando(null)
      setForm({ nome: '', descricao: '', categoria: categorias[0]?.nome || '', duracao_minutos: 60, sessoes: 1, preco: '', custo_material: '', comissao_percentual: '' })
    }
    setModal(true)
  }

  async function handleSalvar() {
    setErroSalvar('')
    if (!form.nome) { setErroSalvar('Preencha o nome do servico.'); return }
    if (!form.preco) { setErroSalvar('Preencha o preco do servico.'); return }
    if (!form.categoria) { setErroSalvar('Selecione uma categoria.'); return }

    setSalvando(true)
    const dados = {
      salao_id: profile!.salao_id,
      nome: form.nome,
      descricao: form.descricao || null,
      categoria: form.categoria,
      duracao_minutos: form.duracao_minutos,
      sessoes: form.sessoes,
      preco: parseFloat(form.preco),
      custo_material: parseFloat(form.custo_material || '0'),
      comissao_percentual: parseFloat(form.comissao_percentual || '0'),
      criado_por: profile!.id,
    }

    let resultado
    if (editando) {
      resultado = await supabase.from('servicos').update(dados).eq('id', editando.id).select()
    } else {
      resultado = await supabase.from('servicos').insert(dados).select()
    }

    if (resultado.error) {
      setErroSalvar('Erro ao salvar: ' + resultado.error.message)
      setSalvando(false)
      return
    }

    if (!resultado.data || resultado.data.length === 0) {
      setErroSalvar('O servico nao foi salvo. Verifique as permissoes do salao.')
      setSalvando(false)
      return
    }

    setModal(false)
    setSalvando(false)
    carregarDados()
  }

  async function excluir(id: string) {
    await supabase.from('servicos').update({ ativo: false }).eq('id', id)
    carregarDados()
  }

  async function uploadFoto(servicoId: string, file: File) {
    setUploadando(true)
    const ext = file.name.split('.').pop()
    const path = profile!.salao_id + '/' + servicoId + '/' + Date.now() + '.' + ext
    const { error: upErr } = await supabase.storage.from('fotos-servicos').upload(path, file)
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('fotos-servicos').getPublicUrl(path)
      await supabase.from('fotos_servicos').insert({
        salao_id: profile!.salao_id, servico_id: servicoId, url: urlData.publicUrl, adicionado_por: profile!.id
      })
      carregarDados()
    }
    setUploadando(false)
  }

  async function removerFoto(fotoId: string) {
    await supabase.from('fotos_servicos').delete().eq('id', fotoId)
    carregarDados()
  }

  async function adicionarCategoria() {
    if (!novaCategoria) return
    await supabase.from('categorias_servicos').insert({ salao_id: profile!.salao_id, nome: novaCategoria })
    setNovaCategoria(''); carregarDados()
  }

  async function editarCategoria(cat: any, novoNome: string) {
    if (!novoNome) return
    await supabase.from('categorias_servicos').update({ nome: novoNome }).eq('id', cat.id)
    await supabase.from('servicos').update({ categoria: novoNome }).eq('categoria', cat.nome).eq('salao_id', profile!.salao_id!)
    setEditandoCategoria(null); carregarDados()
  }

  async function excluirCategoria(cat: any) {
    const emUso = servicos.some(s => s.categoria === cat.nome)
    if (emUso) { alert('Esta categoria tem servicos cadastrados. Mude a categoria deles antes de excluir.'); return }
    await supabase.from('categorias_servicos').delete().eq('id', cat.id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const nomesCategorias = ['Todos', ...categorias.map(c => c.nome)]
  const filtrados = servicos.filter(s => categoriaFiltro === 'Todos' || s.categoria === categoriaFiltro)

  return (
    <div className="min-h-screen pb-8 bg-[#f8f9fa]">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Catalogo de Servicos</h1>
        <button onClick={() => setModalCategorias(true)}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <Tag size={16} className="text-gray-600" />
        </button>
        <button onClick={() => abrirModal()}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {categorias.length === 0 && (
          <div className="card bg-yellow-50 border border-yellow-200">
            <p className="text-sm text-yellow-700">Crie uma categoria antes de adicionar servicos. Toque no icone de etiqueta no topo.</p>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {nomesCategorias.map(c => (
            <button key={c} onClick={() => setCategoriaFiltro(c)}
              className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
              style={categoriaFiltro === c ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#6b7280' }}>
              {c}
            </button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-gray-400">Nenhum servico cadastrado</p>
            <button onClick={() => abrirModal()}
              className="mt-3 px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: cor }}>
              + Adicionar servico
            </button>
          </div>
        ) : filtrados.map(s => {
          const fotosServico = fotos.filter(f => f.servico_id === s.id)
          const aberto = expandido === s.id

          return (
            <div key={s.id} className="card flex flex-col gap-3">
              {fotosServico.length > 0 && (
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                  {fotosServico.map(f => (
                    <div key={f.id} className="relative shrink-0">
                      <img src={f.url} alt={s.nome} className="w-28 h-28 rounded-2xl object-cover" />
                      <button onClick={() => removerFoto(f.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{s.nome}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.categoria}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <DollarSign size={14} style={{ color: cor }} />
                      <span className="text-sm font-bold" style={{ color: cor }}>R$ {s.preco.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock size={13} /><span className="text-xs">{s.duracao_minutos} min</span>
                    </div>
                    {s.sessoes > 1 && (
                      <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: cor }}>{s.sessoes} sessoes</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 ml-2">
                  <label className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer">
                    <Image size={14} className="text-gray-500" />
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) uploadFoto(s.id, e.target.files[0]) }} />
                  </label>
                  <button onClick={() => abrirModal(s)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Edit2 size={14} className="text-gray-500" /></button>
                  <button onClick={() => excluir(s.id)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>

              {s.descricao && (
                <div>
                  <button onClick={() => setExpandido(aberto ? null : s.id)} className="text-sm font-medium" style={{ color: cor }}>
                    {aberto ? 'Ocultar descricao' : 'Ver descricao'}
                  </button>
                  {aberto && <p className="text-sm text-gray-500 mt-2 leading-relaxed">{s.descricao}</p>}
                </div>
              )}

              {s.comissao_percentual > 0 && <p className="text-xs text-gray-400">Comissao: {s.comissao_percentual}%</p>}
              {uploadando && <p className="text-xs text-center" style={{ color: cor }}>Enviando foto...</p>}
            </div>
          )
        })}
      </div>

      {modalCategorias && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Categorias</h3>
              <button onClick={() => setModalCategorias(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="flex gap-2">
              <input className="input-field flex-1" placeholder="Nova categoria"
                value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} />
              <button onClick={adicionarCategoria}
                className="px-4 rounded-xl text-white font-medium" style={{ backgroundColor: cor }}>
                <Plus size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {categorias.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  {editandoCategoria?.id === cat.id ? (
                    <input
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                      defaultValue={cat.nome}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') editarCategoria(cat, (e.target as HTMLInputElement).value) }}
                      onBlur={e => editarCategoria(cat, e.target.value)}
                    />
                  ) : (
                    <p className="flex-1 text-sm text-gray-700">{cat.nome}</p>
                  )}
                  <button onClick={() => setEditandoCategoria(cat)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                    <Edit2 size={12} className="text-gray-500" />
                  </button>
                  <button onClick={() => excluirCategoria(cat)} className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">{editando ? 'Editar Servico' : 'Novo Servico'}</h3>

            {erroSalvar && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{erroSalvar}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do servico *</label>
              <input className="input-field" placeholder="Ex: Corte Feminino" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Categoria</label>
              {categorias.length === 0 ? (
                <p className="text-xs text-red-500">Nenhuma categoria cadastrada. Crie uma categoria primeiro.</p>
              ) : (
                <select className="input-field" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                  {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descricao do servico</label>
              <textarea className="input-field resize-none" rows={4} placeholder="Descreva o servico, cuidados necessarios, contraindicacoes..." value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Preco (R$) *</label><input className="input-field" type="number" placeholder="0,00" value={form.preco} onChange={e => setForm(p => ({ ...p, preco: e.target.value }))} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Duracao (min)</label><input className="input-field" type="number" value={form.duracao_minutos} onChange={e => setForm(p => ({ ...p, duracao_minutos: parseInt(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Sessoes</label><input className="input-field" type="number" min="1" value={form.sessoes} onChange={e => setForm(p => ({ ...p, sessoes: parseInt(e.target.value) }))} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Comissao %</label><input className="input-field" type="number" placeholder="0" value={form.comissao_percentual} onChange={e => setForm(p => ({ ...p, comissao_percentual: e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Custo material (R$)</label><input className="input-field" type="number" placeholder="0,00" value={form.custo_material} onChange={e => setForm(p => ({ ...p, custo_material: e.target.value }))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}