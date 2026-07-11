'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Trash2, Calendar, FileText, X, Save, Search, ChevronRight, ChevronLeft, Package } from 'lucide-react'

interface ClientePacote {
  id: string
  pacote_id: string | null
  sessoes_total: number
  sessoes_usadas: number
  status: string
  data_compra: string
  data_expiracao: string | null
  observacoes: string | null
  historico_manual: string | null
  vendido_por: string | null
  pacotes: { nome: string; descricao: string | null } | null
  profiles: { nome: string } | null
}

export default function PacotesClientesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null)
  const [pacotes, setPacotes] = useState<ClientePacote[]>([])
  const [modelosPacotes, setModelosPacotes] = useState<any[]>([])
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [carregandoPacotes, setCarregandoPacotes] = useState(false)

  const [modalVender, setModalVender] = useState(false)
  const [formVender, setFormVender] = useState({ pacote_id: '', sessoes_total: 1, data_expiracao: '', observacoes: '', vendido_por: '' })
  const [salvandoVender, setSalvandoVender] = useState(false)
  const [erroVender, setErroVender] = useState('')

  const [modalAntigo, setModalAntigo] = useState(false)
  const [formAntigo, setFormAntigo] = useState({ nome: '', sessoes_total: 1, sessoes_usadas: 0, data_compra: new Date().toISOString().split('T')[0], data_expiracao: '', observacoes: '' })
  const [salvandoAntigo, setSalvandoAntigo] = useState(false)

  const [modalEditar, setModalEditar] = useState(false)
  const [pacoteEditando, setPacoteEditando] = useState<ClientePacote | null>(null)
  const [formEditar, setFormEditar] = useState({ sessoes_total: 1, sessoes_usadas: 0, status: 'ativo', data_expiracao: '', observacoes: '' })
  const [salvandoEditar, setSalvandoEditar] = useState(false)
  const [erroEditar, setErroEditar] = useState('')

  const [modalRegras, setModalRegras] = useState<ClientePacote | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<ClientePacote | null>(null)

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    setCarregando(true)
    try {
      const [salRes, cliRes, modRes, funRes] = await Promise.all([
        supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
        supabase.from('clientes').select('id, nome, email, telefone').eq('salao_id', profile!.salao_id!).order('nome'),
        supabase.from('pacotes').select('*').eq('salao_id', profile!.salao_id!).eq('status', 'ativo'),
        supabase.from('profiles').select('id, nome').eq('salao_id', profile!.salao_id!).in('role', ['dono_salao', 'funcionario']),
      ])
      setSalao(salRes.data)
      setClientes(cliRes.data || [])
      setModelosPacotes(modRes.data || [])
      setFuncionarios(funRes.data || [])
    } catch (e) { console.error(e) }
    finally { setCarregando(false) }
  }

  async function selecionarCliente(cli: any) {
    setClienteSelecionado(cli)
    setCarregandoPacotes(true)
    const { data } = await supabase
      .from('cliente_pacotes')
      .select('*, pacotes(nome, descricao), profiles!cliente_pacotes_vendido_por_fkey(nome)')
      .eq('cliente_id', cli.id)
      .order('data_compra', { ascending: false })
    setPacotes(data || [])
    setCarregandoPacotes(false)
  }

  async function handleVender() {
    if (!formVender.pacote_id) { setErroVender('Selecione um pacote.'); return }
    setSalvandoVender(true); setErroVender('')
    const modelo = modelosPacotes.find(m => m.id === formVender.pacote_id)
    const { error } = await supabase.from('cliente_pacotes').insert({
      cliente_id: clienteSelecionado.id,
      pacote_id: formVender.pacote_id,
      sessoes_total: formVender.sessoes_total || modelo?.sessoes || 1,
      sessoes_usadas: 0, status: 'ativo',
      data_compra: new Date().toISOString(),
      data_expiracao: formVender.data_expiracao || null,
      observacoes: formVender.observacoes || null,
      vendido_por: formVender.vendido_por || profile!.id,
    })
    if (error) { setErroVender('Erro: ' + error.message); setSalvandoVender(false); return }
    setModalVender(false)
    setFormVender({ pacote_id: '', sessoes_total: 1, data_expiracao: '', observacoes: '', vendido_por: '' })
    setSalvandoVender(false)
    selecionarCliente(clienteSelecionado)
  }

  async function handleSalvarAntigo() {
    setSalvandoAntigo(true)
    await supabase.from('cliente_pacotes').insert({
      cliente_id: clienteSelecionado.id,
      pacote_id: null,
      sessoes_total: formAntigo.sessoes_total,
      sessoes_usadas: formAntigo.sessoes_usadas,
      status: formAntigo.sessoes_usadas >= formAntigo.sessoes_total ? 'concluido' : 'ativo',
      data_compra: new Date(formAntigo.data_compra).toISOString(),
      data_expiracao: formAntigo.data_expiracao || null,
      observacoes: (formAntigo.nome ? `[${formAntigo.nome}] ` : '') + (formAntigo.observacoes || ''),
      vendido_por: profile!.id,
      historico_manual: formAntigo.nome,
    })
    setModalAntigo(false)
    setFormAntigo({ nome: '', sessoes_total: 1, sessoes_usadas: 0, data_compra: new Date().toISOString().split('T')[0], data_expiracao: '', observacoes: '' })
    setSalvandoAntigo(false)
    selecionarCliente(clienteSelecionado)
  }

  function abrirEditar(p: ClientePacote) {
    setPacoteEditando(p)
    setFormEditar({ sessoes_total: p.sessoes_total, sessoes_usadas: p.sessoes_usadas, status: p.status, data_expiracao: p.data_expiracao ? p.data_expiracao.split('T')[0] : '', observacoes: p.observacoes || '' })
    setErroEditar(''); setModalEditar(true)
  }

  async function handleSalvarEdicao() {
    if (!pacoteEditando) return
    setSalvandoEditar(true); setErroEditar('')
    const { error } = await supabase.from('cliente_pacotes').update({
      sessoes_total: formEditar.sessoes_total,
      sessoes_usadas: formEditar.sessoes_usadas,
      status: formEditar.status,
      data_expiracao: formEditar.data_expiracao || null,
      observacoes: formEditar.observacoes || null,
    }).eq('id', pacoteEditando.id)
    if (error) { setErroEditar('Erro: ' + error.message); setSalvandoEditar(false); return }
    setModalEditar(false); setSalvandoEditar(false)
    selecionarCliente(clienteSelecionado)
  }

  async function excluirPacote(p: ClientePacote) {
    await supabase.from('cliente_pacotes').delete().eq('id', p.id)
    setConfirmandoExclusao(null)
    selecionarCliente(clienteSelecionado)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const clientesFiltrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())
  )

  const statusCor: Record<string, string> = { ativo: 'bg-green-100 text-green-700', expirado: 'bg-red-100 text-red-600', concluido: 'bg-gray-100 text-gray-500' }
  const statusLabel: Record<string, string> = { ativo: 'Ativo', expirado: 'Expirado', concluido: 'Concluído' }

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
    </div>
  )

  // TELA DE PACOTES DA CLIENTE SELECIONADA
  if (clienteSelecionado) return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white px-4 pt-12 pb-4 shadow-sm">
        <button onClick={() => setClienteSelecionado(null)} className="flex items-center gap-2 mb-3 text-gray-500">
          <ChevronLeft size={18} /><span className="text-sm">Todos os clientes</span>
        </button>
        <h1 className="font-bold text-gray-900 text-xl">{clienteSelecionado.nome}</h1>
        <p className="text-gray-400 text-sm">{clienteSelecionado.email}</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="flex gap-2">
          <button onClick={() => setModalVender(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-semibold text-sm"
            style={{ backgroundColor: cor }}>
            <Plus size={16} />Vender Pacote
          </button>
          <button onClick={() => setModalAntigo(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm border-2"
            style={{ borderColor: cor, color: cor }}>
            <Calendar size={16} />Pacote Antigo
          </button>
        </div>

        <p className="font-bold text-gray-900">Pacotes da cliente</p>

        {carregandoPacotes ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
          </div>
        ) : pacotes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
            <Package size={32} className="text-gray-200" />
            <p className="text-gray-400 text-sm">Nenhum pacote registrado</p>
          </div>
        ) : pacotes.map(p => {
          const progresso = p.sessoes_total > 0 ? (p.sessoes_usadas / p.sessoes_total) * 100 : 0
          const restantes = p.sessoes_total - p.sessoes_usadas
          const nomePacote = p.historico_manual || p.pacotes?.nome || 'Cadastro manual'
          const temRegras = !!p.pacotes?.descricao

          return (
            <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{nomePacote}</p>
                  {p.historico_manual && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Cadastro manual</span>}
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  {temRegras && (
                    <button onClick={() => setModalRegras(p)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-50">
                      <FileText size={14} className="text-blue-500" />
                    </button>
                  )}
                  <button onClick={() => abrirEditar(p)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Edit2 size={14} className="text-gray-500" />
                  </button>
                  <button onClick={() => setConfirmandoExclusao(p)} className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>

              <span className={`self-start text-xs px-2.5 py-1 rounded-full font-medium ${statusCor[p.status] || 'bg-gray-100 text-gray-400'}`}>
                {statusLabel[p.status] || p.status}
              </span>

              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>{p.sessoes_usadas} usadas</span>
                  <span className="font-semibold" style={{ color: p.status === 'ativo' ? cor : '#9ca3af' }}>
                    {restantes} restante{restantes !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${progresso}%`, backgroundColor: cor }} />
                </div>
                <p className="text-xs text-gray-300 mt-1 text-right">{p.sessoes_total} sessões no total</p>
              </div>

              {p.data_expiracao && <p className="text-xs text-gray-400">Expira: {new Date(p.data_expiracao).toLocaleDateString('pt-BR')}</p>}
              {p.observacoes && <p className="text-xs text-gray-400 italic">{p.observacoes}</p>}
              {p.profiles?.nome && <p className="text-xs text-gray-300">Vendido por: {p.profiles.nome}</p>}
            </div>
          )
        })}
      </div>

      {/* Modais */}
      {modalVender && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Vender Pacote</h3>
              <button onClick={() => setModalVender(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            {erroVender && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-red-600 text-sm">{erroVender}</p></div>}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Modelo de pacote *</label>
              <select className="input-field" value={formVender.pacote_id}
                onChange={e => { const m = modelosPacotes.find(m => m.id === e.target.value); setFormVender(p => ({ ...p, pacote_id: e.target.value, sessoes_total: m?.sessoes || 1 })) }}>
                <option value="">Selecione...</option>
                {modelosPacotes.map(m => <option key={m.id} value={m.id}>{m.nome} — R$ {Number(m.preco).toFixed(2).replace('.', ',')}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Nº de sessões</label>
                <input className="input-field" type="number" min="1" value={formVender.sessoes_total}
                  onChange={e => setFormVender(p => ({ ...p, sessoes_total: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Validade até</label>
                <input className="input-field" type="date" value={formVender.data_expiracao}
                  onChange={e => setFormVender(p => ({ ...p, data_expiracao: e.target.value }))} style={{ colorScheme: 'light' }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Vendido por</label>
              <select className="input-field" value={formVender.vendido_por}
                onChange={e => setFormVender(p => ({ ...p, vendido_por: e.target.value }))}>
                <option value="">Selecione...</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Observações</label>
              <input className="input-field" placeholder="Ex: Pago no Pix"
                value={formVender.observacoes} onChange={e => setFormVender(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalVender(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={handleVender} disabled={salvandoVender} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>
                {salvandoVender ? 'Salvando...' : 'Vender'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAntigo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Registrar Pacote Antigo</h3>
              <button onClick={() => setModalAntigo(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Nome do pacote</label>
              <input className="input-field" placeholder="Ex: 4 mãos e 2 pés" value={formAntigo.nome}
                onChange={e => setFormAntigo(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Total de sessões</label>
                <input className="input-field" type="number" min="1" value={formAntigo.sessoes_total}
                  onChange={e => setFormAntigo(p => ({ ...p, sessoes_total: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Sessões já usadas</label>
                <input className="input-field" type="number" min="0" value={formAntigo.sessoes_usadas}
                  onChange={e => setFormAntigo(p => ({ ...p, sessoes_usadas: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Data de compra</label>
                <input className="input-field" type="date" value={formAntigo.data_compra}
                  onChange={e => setFormAntigo(p => ({ ...p, data_compra: e.target.value }))} style={{ colorScheme: 'light' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Validade até</label>
                <input className="input-field" type="date" value={formAntigo.data_expiracao}
                  onChange={e => setFormAntigo(p => ({ ...p, data_expiracao: e.target.value }))} style={{ colorScheme: 'light' }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Observações</label>
              <input className="input-field" placeholder="Ex: Comprado antes do sistema"
                value={formAntigo.observacoes} onChange={e => setFormAntigo(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalAntigo(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={handleSalvarAntigo} disabled={salvandoAntigo} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>
                {salvandoAntigo ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEditar && pacoteEditando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Editar Pacote</h3>
              <button onClick={() => setModalEditar(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 font-medium">{pacoteEditando.historico_manual || pacoteEditando.pacotes?.nome}</p>
            {erroEditar && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-red-600 text-sm">{erroEditar}</p></div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Total de sessões</label>
                <input className="input-field" type="number" min="1" value={formEditar.sessoes_total}
                  onChange={e => setFormEditar(p => ({ ...p, sessoes_total: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Sessões usadas</label>
                <input className="input-field" type="number" min="0" value={formEditar.sessoes_usadas}
                  onChange={e => setFormEditar(p => ({ ...p, sessoes_usadas: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Status</label>
              <select className="input-field" value={formEditar.status}
                onChange={e => setFormEditar(p => ({ ...p, status: e.target.value }))}>
                <option value="ativo">Ativo</option>
                <option value="concluido">Concluído</option>
                <option value="expirado">Expirado</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Validade até</label>
              <input className="input-field" type="date" value={formEditar.data_expiracao}
                onChange={e => setFormEditar(p => ({ ...p, data_expiracao: e.target.value }))} style={{ colorScheme: 'light' }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Observações</label>
              <input className="input-field" value={formEditar.observacoes}
                onChange={e => setFormEditar(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalEditar(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={handleSalvarEdicao} disabled={salvandoEditar}
                className="flex-1 py-3 rounded-2xl text-white font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: cor }}>
                <Save size={16} />{salvandoEditar ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalRegras && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Regras do Pacote</h3>
              <button onClick={() => setModalRegras(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm font-semibold" style={{ color: cor }}>{modalRegras.historico_manual || modalRegras.pacotes?.nome}</p>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{modalRegras.pacotes?.descricao}</p>
            <button onClick={() => setModalRegras(null)} className="w-full py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>Fechar</button>
          </div>
        </div>
      )}

      {confirmandoExclusao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Excluir pacote?</h3>
            <p className="text-sm text-gray-500">
              O pacote <span className="font-semibold">{confirmandoExclusao.historico_manual || confirmandoExclusao.pacotes?.nome}</span> será removido permanentemente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoExclusao(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={() => excluirPacote(confirmandoExclusao)} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-medium">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // TELA DE LISTA DE CLIENTES
  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white px-4 pt-12 pb-4 shadow-sm flex items-center gap-3">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Pacotes por Cliente</h1>
          <p className="text-xs text-gray-400">Ver sessões, histórico e vender pacotes</p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="bg-white rounded-2xl flex items-center gap-3 px-4 py-3 shadow-sm">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            placeholder="Buscar cliente..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        {clientesFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <p className="text-gray-400 text-sm">Nenhuma cliente encontrada</p>
          </div>
        ) : clientesFiltrados.map(c => (
          <button key={c.id} onClick={() => selecionarCliente(c)}
            className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-all text-left w-full">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold shrink-0"
              style={{ background: `linear-gradient(135deg, ${cor}, ${cor}aa)` }}>
              {c.nome?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{c.nome}</p>
              <p className="text-xs text-gray-400 truncate">{c.email || c.telefone || 'Sem contato'}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}