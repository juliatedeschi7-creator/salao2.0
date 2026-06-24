'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Plus, FileText, Send, Edit2, Trash2, CheckCircle, Clock, Download } from 'lucide-react'

export default function ContratosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [aba, setAba] = useState<'modelos' | 'enviados'>('modelos')
  const [modelos, setModelos] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [modalModelo, setModalModelo] = useState(false)
  const [modalEnviar, setModalEnviar] = useState<any>(null)
  const [editandoModelo, setEditandoModelo] = useState<any>(null)
  const [formModelo, setFormModelo] = useState({ titulo: '', categoria: '', conteudo: '' })
  const [clienteId, setClienteId] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: mods } = await supabase.from('modelos_contrato').select('*').eq('salao_id', profile!.salao_id!).eq('ativo', true).order('created_at', { ascending: false })
    setModelos(mods || [])
    const { data: cnts } = await supabase.from('contratos').select('*, clientes(nome), profiles!criado_por(nome)').eq('salao_id', profile!.salao_id!).order('created_at', { ascending: false })
    setContratos(cnts || [])
    const { data: clis } = await supabase.from('clientes').select('id, nome, profile_id').eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(clis || [])
  }

  function abrirModalModelo(m?: any) {
    if (m) { setEditandoModelo(m); setFormModelo({ titulo: m.titulo, categoria: m.categoria || '', conteudo: m.conteudo }) }
    else { setEditandoModelo(null); setFormModelo({ titulo: '', categoria: '', conteudo: '' }) }
    setModalModelo(true)
  }

  async function salvarModelo() {
    if (!formModelo.titulo || !formModelo.conteudo) return
    setSalvando(true)
    const dados = { salao_id: profile!.salao_id, titulo: formModelo.titulo, categoria: formModelo.categoria || null, conteudo: formModelo.conteudo, criado_por: profile!.id }
    if (editandoModelo) await supabase.from('modelos_contrato').update(dados).eq('id', editandoModelo.id)
    else await supabase.from('modelos_contrato').insert(dados)
    setModalModelo(false); setSalvando(false); carregarDados()
  }

  async function excluirModelo(id: string) {
    await supabase.from('modelos_contrato').update({ ativo: false }).eq('id', id)
    carregarDados()
  }

  async function enviarContrato() {
    if (!modalEnviar || !clienteId) return
    setSalvando(true)
    const cliente = clientes.find(c => c.id === clienteId)
    const conteudoPersonalizado = modalEnviar.conteudo
      .replace(/\{cliente\}/g, cliente?.nome || '')
      .replace(/\{salao\}/g, salao?.nome || '')
      .replace(/\{data\}/g, new Date().toLocaleDateString('pt-BR'))

    const { data: contrato } = await supabase.from('contratos').insert({
      salao_id: profile!.salao_id,
      modelo_id: modalEnviar.id,
      cliente_id: clienteId,
      titulo: modalEnviar.titulo,
      conteudo: conteudoPersonalizado,
      status: 'pendente',
      criado_por: profile!.id
    }).select().single()

    if (cliente?.profile_id) {
      await supabase.from('notificacoes').insert({
        salao_id: profile!.salao_id,
        remetente_id: profile!.id,
        destinatario_id: cliente.profile_id,
        titulo: 'Novo contrato para assinar',
        mensagem: modalEnviar.titulo + ' - ' + salao?.nome + ' enviou um documento que precisa da sua assinatura.',
        tipo: 'contrato'
      })
    }

    setModalEnviar(null); setClienteId(''); setSalvando(false); carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Contratos</h1>
        {aba === 'modelos' && (
          <button onClick={() => abrirModalModelo()} className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cor }}>
            <Plus size={18} />
          </button>
        )}
      </div>

      <div className="flex bg-white border-b border-gray-100">
        {[{ key: 'modelos', label: 'Modelos' }, { key: 'enviados', label: 'Enviados' }].map(t => (
          <button key={t.key} onClick={() => setAba(t.key as any)}
            className={'flex-1 py-3 text-sm font-medium transition-all ' + (aba === t.key ? 'border-b-2' : 'text-gray-400')}
            style={aba === t.key ? { color: cor, borderColor: cor } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {aba === 'modelos' && (
          modelos.length === 0 ? (
            <div className="card text-center py-10">
              <FileText size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhum modelo criado</p>
              <p className="text-xs text-gray-400 mt-1">Crie modelos como "Termo de Responsabilidade" ou "Contrato de Noiva"</p>
            </div>
          ) : modelos.map(m => (
            <div key={m.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{m.titulo}</p>
                  {m.categoria && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{m.categoria}</span>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => abrirModalModelo(m)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Edit2 size={14} className="text-gray-500" /></button>
                  <button onClick={() => excluirModelo(m.id)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
              <p className="text-xs text-gray-400 line-clamp-2">{m.conteudo}</p>
              <button onClick={() => setModalEnviar(m)}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                style={{ backgroundColor: cor }}>
                <Send size={14} />Enviar para cliente
              </button>
            </div>
          ))
        )}

        {aba === 'enviados' && (
          contratos.length === 0 ? (
            <div className="card text-center py-10"><FileText size={36} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhum contrato enviado</p></div>
          ) : contratos.map(c => (
            <div key={c.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{c.titulo}</p>
                  <p className="text-sm text-gray-500">{c.clientes?.nome}</p>
                </div>
                <span className={'text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ' +
                  (c.status === 'assinado' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600')}>
                  {c.status === 'assinado' ? <><CheckCircle size={10} />Assinado</> : <><Clock size={10} />Pendente</>}
                </span>
              </div>
              <p className="text-xs text-gray-400">Enviado: {new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
              <p className="text-xs text-gray-400">Enviado por: {c.profiles?.nome || 'Desconhecido'}</p>
              {c.status === 'assinado' && (
                <button onClick={() => router.push('/salao/contratos/' + c.id)}
                  className="w-full py-2.5 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2"
                  style={{ borderColor: cor, color: cor }}>
                  <Download size={14} />Ver/baixar PDF
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {modalModelo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">{editandoModelo ? 'Editar Modelo' : 'Novo Modelo de Contrato'}</h3>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Titulo</label><input className="input-field" placeholder="Ex: Termo de Responsabilidade - Luzes" value={formModelo.titulo} onChange={e => setFormModelo(p => ({ ...p, titulo: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Categoria</label><input className="input-field" placeholder="Ex: Quimica, Noiva, Geral" value={formModelo.categoria} onChange={e => setFormModelo(p => ({ ...p, categoria: e.target.value }))} /></div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Conteudo do contrato</label>
              <p className="text-xs text-gray-400 mb-2">Use {'{cliente}'}, {'{salao}'} e {'{data}'} para preencher automaticamente</p>
              <textarea className="input-field resize-none" rows={10}
                placeholder="Eu, {cliente}, declaro estar ciente dos riscos do procedimento..."
                value={formModelo.conteudo} onChange={e => setFormModelo(p => ({ ...p, conteudo: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalModelo(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={salvarModelo} disabled={salvando} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>{salvando ? '...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalEnviar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Enviar Contrato</h3>
            <p className="text-sm text-gray-500">{modalEnviar.titulo}</p>
            <select className="input-field" value={clienteId} onChange={e => setClienteId(e.target.value)}>
              <option value="">Selecione a cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setModalEnviar(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={enviarContrato} disabled={!clienteId || salvando} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>{salvando ? 'Enviando...' : 'Enviar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
