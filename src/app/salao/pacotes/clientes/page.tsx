'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Plus, Calendar, CheckCircle, Clock } from 'lucide-react'

export default function PacotesClientesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [pacotesModelo, setPacotesModelo] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null)
  const [pacotesCliente, setPacotesCliente] = useState<any[]>([])
  const [sessoes, setSessoes] = useState<any[]>([])
  const [modalVenda, setModalVenda] = useState(false)
  const [modalAntigo, setModalAntigo] = useState(false)
  const [pacoteModeloId, setPacoteModeloId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')
  const [formAntigo, setFormAntigo] = useState({
    nome: '', sessoes_total: 1, sessoes_usadas: 0, observacoes: ''
  })

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (profile.role !== 'dono_salao' && profile.role !== 'funcionario') {
      router.push('/login'); return
    }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: clis } = await supabase.from('clientes').select('*')
      .eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(clis || [])

    // ← CORRIGIDO: usa status em vez de ativo
    const { data: pacs } = await supabase.from('pacotes')
      .select('*, pacote_itens(*, servicos(nome))')
      .eq('salao_id', profile!.salao_id!)
      .eq('status', 'ativo')
    setPacotesModelo(pacs || [])
  }

  async function selecionarCliente(cliente: any) {
    setClienteSelecionado(cliente)
    const { data: pacs } = await supabase.from('cliente_pacotes')
      .select('*, pacotes(nome, descricao, regras), profiles(nome)')
      .eq('cliente_id', cliente.id)
      .order('data_compra', { ascending: false })
    setPacotesCliente(pacs || [])
    if (pacs && pacs.length > 0) {
      const ids = pacs.map((p: any) => p.id)
      const { data: sess } = await supabase.from('sessoes_pacote')
        .select('*').in('cliente_pacote_id', ids).order('data_sessao', { ascending: false })
      setSessoes(sess || [])
    } else {
      setSessoes([])
    }
  }

  async function venderPacote() {
    if (!pacoteModeloId || !clienteSelecionado) return
    setSalvando(true)
    setErroSalvar('')

    const modelo = pacotesModelo.find(p => p.id === pacoteModeloId)
    if (!modelo) { setSalvando(false); return }

    const dataExpiracao = modelo.validade_dias
      ? new Date(Date.now() + modelo.validade_dias * 86400000).toISOString()
      : null

    // ← CORRIGIDO: usa modelo.sessoes (nome real do campo na tabela)
    const { error } = await supabase.from('cliente_pacotes').insert({
      cliente_id: clienteSelecionado.id,
      pacote_id: pacoteModeloId,
      sessoes_total: modelo.sessoes,
      sessoes_usadas: 0,
      status: 'ativo',
      data_compra: new Date().toISOString(),
      data_expiracao: dataExpiracao,
      vendido_por: profile!.id
    })

    if (error) {
      setErroSalvar('Erro ao salvar: ' + error.message)
      setSalvando(false)
      return
    }

    setModalVenda(false)
    setSalvando(false)
    setPacoteModeloId('')
    selecionarCliente(clienteSelecionado)
  }

  async function cadastrarAntigo() {
    if (!formAntigo.nome || !clienteSelecionado) return
    setSalvando(true)
    setErroSalvar('')

    const { error } = await supabase.from('cliente_pacotes').insert({
      cliente_id: clienteSelecionado.id,
      pacote_id: null,
      sessoes_total: formAntigo.sessoes_total,
      sessoes_usadas: formAntigo.sessoes_usadas,
      status: formAntigo.sessoes_usadas >= formAntigo.sessoes_total ? 'concluido' : 'ativo',
      data_compra: new Date().toISOString(),
      historico_manual: true,
      observacoes: formAntigo.nome + (formAntigo.observacoes ? ' — ' + formAntigo.observacoes : ''),
      vendido_por: profile!.id
    })

    if (error) {
      setErroSalvar('Erro ao salvar: ' + error.message)
      setSalvando(false)
      return
    }

    setModalAntigo(false)
    setSalvando(false)
    setFormAntigo({ nome: '', sessoes_total: 1, sessoes_usadas: 0, observacoes: '' })
    selecionarCliente(clienteSelecionado)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  )

  // ─── Tela do cliente selecionado ────────────────────────────
  if (clienteSelecionado) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pb-8">
        <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <button onClick={() => { setClienteSelecionado(null); setErroSalvar('') }}>
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900">{clienteSelecionado.nome}</h1>
            <p className="text-xs text-gray-400">{clienteSelecionado.email}</p>
          </div>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="flex gap-2">
            <button onClick={() => { setErroSalvar(''); setModalVenda(true) }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: cor }}>
              <Plus size={16} />Vender Pacote
            </button>
            <button onClick={() => { setErroSalvar(''); setModalAntigo(true) }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold"
              style={{ borderColor: cor, color: cor }}>
              <Calendar size={16} />Pacote Antigo
            </button>
          </div>

          <p className="font-bold text-gray-900">Pacotes da cliente</p>

          {pacotesCliente.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-400">Nenhum pacote ainda</p>
            </div>
          ) : pacotesCliente.map(p => {
            const progresso = p.sessoes_total > 0 ? (p.sessoes_usadas / p.sessoes_total) * 100 : 0
            const sessoesDoPacote = sessoes.filter(s => s.cliente_pacote_id === p.id)
            const nomeExibido = p.pacotes?.nome || p.observacoes || 'Pacote manual'

            return (
              <div key={p.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{nomeExibido}</p>
                    {p.historico_manual && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Cadastro manual
                      </span>
                    )}
                  </div>
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                    (p.status === 'ativo' ? 'bg-green-50 text-green-600' :
                     p.status === 'concluido' ? 'bg-gray-100 text-gray-500' :
                     'bg-red-50 text-red-400')}>
                    {p.status === 'ativo' ? 'Ativo' : p.status === 'concluido' ? 'Concluído' : p.status}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{p.sessoes_usadas} usadas</span>
                    <span>{p.sessoes_total - p.sessoes_usadas} restantes</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(progresso, 100)}%`, backgroundColor: cor }} />
                  </div>
                </div>

                {p.data_expiracao && (
                  <p className="text-xs text-gray-400">
                    Expira: {new Date(p.data_expiracao).toLocaleDateString('pt-BR')}
                  </p>
                )}

                {sessoesDoPacote.length > 0 && (
                  <div className="border-t border-gray-100 pt-2">
                    <p className="text-xs font-medium text-gray-500 mb-2">Histórico de sessões</p>
                    {sessoesDoPacote.map(s => (
                      <div key={s.id} className="flex justify-between text-xs text-gray-500 py-1 border-b border-gray-50 last:border-0">
                        <span>{new Date(s.data_sessao).toLocaleDateString('pt-BR')}</span>
                        <span className="text-gray-400">{s.servico_realizado}</span>
                      </div>
                    ))}
                  </div>
                )}

                {p.profiles?.nome && (
                  <p className="text-xs text-gray-400">Vendido por: {p.profiles.nome}</p>
                )}

                {p.pacotes?.regras && (
                  <div className={'flex items-center gap-2 px-3 py-2 rounded-xl ' +
                    (p.regras_confirmadas ? 'bg-green-50' : 'bg-yellow-50')}>
                    {p.regras_confirmadas ? (
                      <>
                        <CheckCircle size={14} className="text-green-600" />
                        <p className="text-xs text-green-700">
                          Regras confirmadas em {new Date(p.regras_confirmadas_em).toLocaleDateString('pt-BR')}
                        </p>
                      </>
                    ) : (
                      <>
                        <Clock size={14} className="text-yellow-600" />
                        <p className="text-xs text-yellow-700">Cliente ainda não confirmou as regras</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Modal vender pacote */}
        {modalVenda && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
              <h3 className="font-bold text-gray-900 text-lg">Vender Pacote</h3>
              {pacotesModelo.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Nenhum pacote cadastrado. Crie pacotes primeiro em Catálogo → Pacotes.
                </p>
              ) : (
                <select className="input-field" value={pacoteModeloId}
                  onChange={e => setPacoteModeloId(e.target.value)}>
                  <option value="">Selecione um pacote...</option>
                  {pacotesModelo.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — R$ {Number(p.preco).toFixed(2).replace('.', ',')} ({p.sessoes} sessões)
                    </option>
                  ))}
                </select>
              )}

              {/* Itens do pacote selecionado */}
              {pacoteModeloId && (() => {
                const modelo = pacotesModelo.find(p => p.id === pacoteModeloId)
                return modelo?.pacote_itens?.length > 0 ? (
                  <div className="bg-gray-50 rounded-xl px-3 py-2 flex flex-col gap-1">
                    {modelo.pacote_itens.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.servicos?.nome}</span>
                        <span className="font-bold text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: cor }}>{item.quantidade}x</span>
                      </div>
                    ))}
                  </div>
                ) : null
              })()}

              {erroSalvar && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erroSalvar}</p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setModalVenda(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                  Cancelar
                </button>
                <button onClick={venderPacote}
                  disabled={!pacoteModeloId || salvando}
                  className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: cor }}>
                  {salvando ? 'Salvando...' : 'Confirmar venda'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal pacote antigo */}
        {modalAntigo && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
              <h3 className="font-bold text-gray-900 text-lg">Cadastrar Pacote Antigo</h3>
              <p className="text-xs text-gray-400">
                Para controle histórico de pacotes vendidos antes do sistema
              </p>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nome / descrição</label>
                <input className="input-field"
                  placeholder="Ex: Pacote 10 sessões limpeza de pele"
                  value={formAntigo.nome}
                  onChange={e => setFormAntigo(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Total de sessões</label>
                  <input className="input-field" type="number" min="1"
                    value={formAntigo.sessoes_total}
                    onChange={e => setFormAntigo(p => ({ ...p, sessoes_total: parseInt(e.target.value) || 1 }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Já usadas</label>
                  <input className="input-field" type="number" min="0"
                    value={formAntigo.sessoes_usadas}
                    onChange={e => setFormAntigo(p => ({ ...p, sessoes_usadas: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Observações (opcional)</label>
                <textarea className="input-field resize-none" rows={2}
                  placeholder="Ex: vendido em papel em março/2024"
                  value={formAntigo.observacoes}
                  onChange={e => setFormAntigo(p => ({ ...p, observacoes: e.target.value }))} />
              </div>

              {erroSalvar && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erroSalvar}</p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setModalAntigo(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                  Cancelar
                </button>
                <button onClick={cadastrarAntigo}
                  disabled={!formAntigo.nome || salvando}
                  className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: cor }}>
                  {salvando ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Lista de clientes ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg">Pacotes por Cliente</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-11" placeholder="Buscar cliente..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        {clientesFiltrados.map(c => (
          <button key={c.id} onClick={() => selecionarCliente(c)}
            className="card flex items-center gap-3 active:scale-95 transition-all">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
              style={{ backgroundColor: cor }}>
              {c.nome?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-900">{c.nome}</p>
              <p className="text-xs text-gray-400">{c.email}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}