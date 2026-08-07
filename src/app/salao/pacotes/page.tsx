// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Edit3, Check, X, Share2, MessageSquare, Copy, Sparkles, HelpCircle } from 'lucide-react'

const CATEGORIAS_SERVICOS = [
  { id: 'todos', label: '🌟 Todos' },
  { id: 'cabelo', label: '💇‍♀️ Cabelo' },
  { id: 'unhas', label: '💅 Unhas' },
  { id: 'estetica', label: '✨ Estética' },
  { id: 'sobrancelha', label: '👁️ Sobrancelhas' },
]

export default function PacotesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // ── Modal de Compartilhamento Personalizado ──
  const [modalCompartilhar, setModalCompartilhar] = useState(false)
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos')
  const [mostrarTermos, setMostrarTermos] = useState(true)
  const [estiloMsg, setEstiloMsg] = useState({
    emojiTopo: '✨',
    emojiPacote: '📦',
    emojiPreco: '💰',
    emojiRodape: '📲',
    tituloPersonalizado: 'Nossos Pacotes Especiais',
    textoChamada: 'Garanta já o seu pacote conosco!'
  })
  const [copiadoMsg, setCopiadoMsg] = useState(false)

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    preco: '',
    sessoes_inclusas: '1',
    validade_dias: '30',
    regras: '',
    categoria: 'cabelo'
  })

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }

    const p = profile as any
    const ehAdminOuSocio = ['dono_salao', 'socio', 'admin'].includes(profile.tipo) || p.acesso_total
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
      regras: 'O pacote é pessoal e intransferível.\nValidade impressa deve ser respeitada.\nCancelamentos com menos de 24h implicam em perda da sessão.',
      categoria: 'cabelo'
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
      regras: pacote.regras || '',
      categoria: pacote.categoria || 'cabelo'
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
      categoria: form.categoria,
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

  // ── Função auxiliar para formatar a sintaxe [[termo | explicação]] ──
  function processarTermos(texto: string) {
    if (!texto) return ''
    if (!mostrarTermos) {
      // Remove o bloco [[termo | explicação]] e deixa apenas o termo se quiser, ou limpa
      return texto.replace(/\[\[\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]\]/g, '$1')
    }
    // Converte para um formato legível no WhatsApp, ex: *termo* (_explicação_)
    return texto.replace(/\[\[\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]\]/g, '*$1* (_$2_)')
  }

  // ── Gerador de Texto Customizado com Filtro, Emojis e Termos ──
  function gerarTextoCompartilhamento() {
    const ativos = pacotes.filter(p => p.status === 'ativo')
    const filtrados = categoriaFiltro === 'todos' 
      ? ativos 
      : ativos.filter(p => p.categoria === categoriaFiltro)

    const nomeSalao = salao?.nome || 'Nosso Salão'
    let texto = `${estiloMsg.emojiTopo} *${estiloMsg.tituloPersonalizado} - ${nomeSalao}* ${estiloMsg.emojiTopo}\n\n`

    if (filtrados.length === 0) {
      texto += `No momento não temos pacotes ativos nesta categoria.\n\n`
    } else {
      filtrados.forEach((p, idx) => {
        const precoFmt = Number(p.preco).toFixed(2).replace('.', ',')
        texto += `${estiloMsg.emojiPacote} *${idx + 1}. ${p.nome}*\n`
        if (p.descricao) texto += `_${processarTermos(p.descricao)}_\n`
        texto += `${estiloMsg.emojiPreco} R$ ${precoFmt} | 📦 ${p.sessoes_inclusas} sessões | ⏳ ${p.validade_dias} dias\n`
        
        if (p.regras) {
          texto += `📋 _Regras:_ ${processarTermos(p.regras)}\n`
        }
        texto += `\n`
      })
    }

    texto += `${estiloMsg.emojiRodape} *${estiloMsg.textoChamada}*\nEntre em contato para adquirir o seu!`
    return texto
  }

  function copiarTextoCompartilhado() {
    navigator.clipboard.writeText(gerarTextoCompartilhamento())
    setCopiadoMsg(true)
    setTimeout(() => setCopiadoMsg(false), 2000)
  }

  function enviarWhatsAppCompartilhado() {
    const texto = encodeURIComponent(gerarTextoCompartilhamento())
    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank')
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg">Gerenciar Pacotes</h1>
        </div>
        <div className="flex items-center gap-2">
          {pacotes.length > 0 && (
            <button onClick={() => setModalCompartilhar(true)} title="Compartilhar Pacotes Personalizados" className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
              <Share2 size={18} />
            </button>
          )}
          <button onClick={abrirNovo} className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cor }}>
            <Plus size={20} />
          </button>
        </div>
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
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-base">{p.nome}</p>
                    {p.categoria && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium uppercase">
                        {p.categoria}
                      </span>
                    )}
                  </div>
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

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
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

      {/* ── MODAL DE COMPARTILHAMENTO CUSTOMIZADO ── */}
      {modalCompartilhar && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} style={{ color: cor }} />
                <h3 className="font-bold text-gray-900 text-base">Compartilhar Pacotes Personalizados</h3>
              </div>
              <button onClick={() => setModalCompartilhar(false)} className="text-gray-400 font-bold">✕</button>
            </div>

            {/* Filtro por Categoria */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Filtrar por Categoria:</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIAS_SERVICOS.map(cat => (
                  <button key={cat.id} onClick={() => setCategoriaFiltro(cat.id)}
                    className={'px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ' +
                      (categoriaFiltro === cat.id ? 'border-2 shadow-sm font-bold' : 'border-gray-200 text-gray-600 bg-white')}
                    style={categoriaFiltro === cat.id ? { borderColor: cor, color: cor, backgroundColor: `${cor}10` } : {}}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opção de Mostrar/Ocultar Explicação de Termos */}
            <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HelpCircle size={18} className="text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-blue-900">Exibir explicações de termos?</p>
                  <p className="text-[10px] text-blue-600">Usa o formato [[termo | explicação]] nas descrições</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={mostrarTermos} 
                onChange={e => setMostrarTermos(e.target.checked)}
                className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
              />
            </div>

            {/* Configuração de Emojis e Estilo */}
            <div className="bg-gray-50 p-3 rounded-2xl flex flex-col gap-2.5">
              <p className="text-xs font-bold text-gray-700">🎨 Customizar Estilo & Emojis</p>

              <div>
                <label className="text-[11px] text-gray-500 block mb-0.5">Título do Cabeçalho</label>
                <input className="input-field text-xs py-1.5"
                  value={estiloMsg.tituloPersonalizado}
                  onChange={e => setEstiloMsg(p => ({ ...p, tituloPersonalizado: e.target.value }))} />
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Topo</label>
                  <input className="input-field text-xs py-1.5 text-center"
                    value={estiloMsg.emojiTopo}
                    onChange={e => setEstiloMsg(p => ({ ...p, emojiTopo: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Pacote</label>
                  <input className="input-field text-xs py-1.5 text-center"
                    value={estiloMsg.emojiPacote}
                    onChange={e => setEstiloMsg(p => ({ ...p, emojiPacote: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Preço</label>
                  <input className="input-field text-xs py-1.5 text-center"
                    value={estiloMsg.emojiPreco}
                    onChange={e => setEstiloMsg(p => ({ ...p, emojiPreco: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Rodapé</label>
                  <input className="input-field text-xs py-1.5 text-center"
                    value={estiloMsg.emojiRodape}
                    onChange={e => setEstiloMsg(p => ({ ...p, emojiRodape: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-500 block mb-0.5">Chamada para Ação (Rodapé)</label>
                <input className="input-field text-xs py-1.5"
                  value={estiloMsg.textoChamada}
                  onChange={e => setEstiloMsg(p => ({ ...p, textoChamada: e.target.value }))} />
              </div>
            </div>

            {/* Pré-visualização do Texto */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Pré-visualização:</label>
              <div className="bg-zinc-900 text-zinc-100 p-3.5 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed shadow-inner max-h-40 overflow-y-auto">
                {gerarTextoCompartilhamento()}
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-1">
              <button onClick={copiarTextoCompartilhado}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-xs bg-gray-50">
                <Copy size={15} /> {copiadoMsg ? '✓ Copiado!' : 'Copiar Texto'}
              </button>
              <button onClick={enviarWhatsAppCompartilhado}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-white font-semibold text-xs shadow-md"
                style={{ backgroundColor: '#25D366' }}>
                <Share2 size={15} /> Enviar no WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CADASTRO / EDIÇÃO DE PACOTE ── */}
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Categoria</label>
              <select className="input-field text-sm" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                <option value="cabelo">Cabelo</option>
                <option value="unhas">Unhas</option>
                <option value="estetica">Estética</option>
                <option value="sobrancelha">Sobrancelhas</option>
                <option value="geral">Geral</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descrição (opcional)</label>
              <input className="input-field" placeholder="Ex: Válido para [[termo | explicação]] no salão"
                value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              <span className="text-[11px] text-gray-400 mt-1 block">Dica: Você pode usar a marcação [[termo | explicação]]</span>
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Regras do Pacote</label>
              <textarea className="input-field resize-none" rows={3} placeholder="Descreva as regras..."
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
