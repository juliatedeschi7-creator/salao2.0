'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Search, Plus, Calendar, CheckCircle, Clock, X } from 'lucide-react'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

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
  const [erro, setErro] = useState('')

  // Vender Pacote (modelo atual)
  const [dataInicioVenda, setDataInicioVenda] = useState(hojeISO())
  const [sessoesJaRealizadasVenda, setSessoesJaRealizadasVenda] = useState('0')

  // Pacote Antigo (histórico manual)
  const [formAntigo, setFormAntigo] = useState({ nome: '', sessoes_total: '1', observacoes: '' })
  const [sessoesAntigo, setSessoesAntigo] = useState<{ data: string; descricao: string }[]>([])
  const [novaSessaoData, setNovaSessaoData] = useState(hojeISO())
  const [novaSessaoDescricao, setNovaSessaoDescricao] = useState('')

  // Adicionar sessão a um pacote já existente
  const [modalSessao, setModalSessao] = useState<any>(null)
  const [sessaoData, setSessaoData] = useState(hojeISO())
  const [sessaoDescricao, setSessaoDescricao] = useState('')
  const [erroSessao, setErroSessao] = useState('')

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    const { data: clis } = await supabase.from('clientes').select('*').eq('salao_id', profile!.salao_id!).order('nome')
    setClientes(clis || [])
    const { data: pacs } = await supabase.from('pacotes').select('*').eq('salao_id', profile!.salao_id!).eq('status', 'ativo')
    setPacotesModelo(pacs || [])
  }

  async function selecionarCliente(cliente: any) {
    setClienteSelecionado(cliente)
    const { data: pacs } = await supabase.from('cliente_pacotes')
      .select('*, pacotes(nome, descricao, regras), profiles!vendido_por(nome)')
      .eq('cliente_id', cliente.id)
      .order('data_compra', { ascending: false })
    setPacotesCliente(pacs || [])
    if (pacs && pacs.length > 0) {
      const ids = pacs.map((p: any) => p.id)
      const { data: sess } = await supabase.from('sessoes_pacote').select('*').in('cliente_pacote_id', ids).order('data_sessao', { ascending: false })
      setSessoes(sess || [])
    } else {
      setSessoes([])
    }
  }

  function abrirModalVenda() {
    setPacoteModeloId('')
    setDataInicioVenda(hojeISO())
    setSessoesJaRealizadasVenda('0')
    setErro('')
    setModalVenda(true)
  }

  function abrirModalAntigo() {
    setFormAntigo({ nome: '', sessoes_total: '1', observacoes: '' })
    setSessoesAntigo([])
    setNovaSessaoData(hojeISO())
    setNovaSessaoDescricao('')
    setErro('')
    setModalAntigo(true)
  }

  function adicionarSessaoAntiga() {
    if (!novaSessaoData || !novaSessaoDescricao.trim()) return
    setSessoesAntigo(prev => [...prev, { data: novaSessaoData, descricao: novaSessaoDescricao.trim() }])
    setNovaSessaoDescricao('')
  }

  function removerSessaoAntiga(i: number) {
    setSessoesAntigo(prev => prev.filter((_, idx) => idx !== i))
  }

  function abrirModalSessao(pacote: any) {
    setModalSessao(pacote)
    setSessaoData(hojeISO())
    setSessaoDescricao('')
    setErroSessao('')
  }

  async function adicionarSessaoAoPacote() {
    if (!modalSessao || !sessaoData || !sessaoDescricao.trim()) return
    setSalvando(true)
    setErroSessao('')

    const { error: errSess } = await supabase.from('sessoes_pacote').insert({
      cliente_pacote_id: modalSessao.id,
      data_sessao: sessaoData,
      servico_realizado: sessaoDescricao.trim(),
      profissional_id: profile!.id
    })
    if (errSess) {
      setErroSessao('Erro ao salvar sessão: ' + errSess.message)
      setSalvando(false)
      return
    }

    const novasUsadas = modalSessao.sessoes_usadas + 1
    const novoStatus = novasUsadas >= modalSessao.sessoes_total ? 'concluido' : 'ativo'
    const { error: errUp } = await supabase.from('cliente_pacotes')
      .update({ sessoes_usadas: novasUsadas, status: novoStatus })
      .eq('id', modalSessao.id)
    if (errUp) {
      setErroSessao('Sessão salva, mas houve erro ao atualizar o contador: ' + errUp.message)
      setSalvando(false)
      return
    }

    setModalSessao(null)
    setSalvando(false)
    selecionarCliente(clienteSelecionado)
  }

  async function removerSessaoRegistrada(pacote: any, sessao: any) {
    if (!confirm('Remover essa sessão do histórico? Isso vai devolver uma sessão para o pacote.')) return
    const { error: errDel } = await supabase.from('sessoes_pacote').delete().eq('id', sessao.id)
    if (errDel) { alert('Erro ao remover: ' + errDel.message); return }

    const novasUsadas = Math.max(0, pacote.sessoes_usadas - 1)
    const novoStatus = novasUsadas >= pacote.sessoes_total ? 'concluido' : 'ativo'
    const { error: errUp } = await supabase.from('cliente_pacotes')
      .update({ sessoes_usadas: novasUsadas, status: novoStatus })
      .eq('id', pacote.id)
    if (errUp) { alert('Sessão removida, mas houve erro ao atualizar o contador: ' + errUp.message) }

    selecionarCliente(clienteSelecionado)
  }

  async function venderPacote() {
    if (!pacoteModeloId || !clienteSelecionado) return
    setSalvando(true)
    setErro('')
    const modelo = pacotesModelo.find(p => p.id === pacoteModeloId)
    const dataCompra = dataInicioVenda ? new Date(dataInicioVenda + 'T12:00:00').toISOString() : new Date().toISOString()
    const dataExpiracao = modelo.validade_dias
      ? new Date(new Date(dataCompra).getTime() + modelo.validade_dias * 86400000).toISOString()
      : null
    const totalSessoes = modelo.sessoes_inclusas || modelo.sessoes || 0
    const jaRealizadas = Math.min(parseInt(sessoesJaRealizadasVenda) || 0, totalSessoes)

    const { error } = await supabase.from('cliente_pacotes').insert({
      cliente_id: clienteSelecionado.id,
      pacote_id: pacoteModeloId,
      sessoes_total: totalSessoes,
      sessoes_usadas: jaRealizadas,
      status: 'ativo',
      data_compra: dataCompra,
      data_expiracao: dataExpiracao,
      vendido_por: profile!.id
    })

    if (error) {
      setErro('Erro ao vender pacote: ' + error.message)
      setSalvando(false)
      return
    }

    setModalVenda(false)
    setSalvando(false)
    selecionarCliente(clienteSelecionado)
  }

  async function cadastrarAntigo() {
    if (!formAntigo.nome || !clienteSelecionado) return
    setSalvando(true)
    setErro('')

    const totalSessoes = parseInt(formAntigo.sessoes_total) || Math.max(1, sessoesAntigo.length)

    const { data: novo, error } = await supabase.from('cliente_pacotes').insert({
      cliente_id: clienteSelecionado.id,
      pacote_id: null,
      sessoes_total: totalSessoes,
      sessoes_usadas: sessoesAntigo.length,
      status: 'ativo',
      data_compra: new Date().toISOString(),
      historico_manual: true,
      observacoes: formAntigo.nome + (formAntigo.observacoes ? ' - ' + formAntigo.observacoes : ''),
      vendido_por: profile!.id
    }).select().single()

    if (error) {
      setErro('Erro ao cadastrar: ' + error.message)
      setSalvando(false)
      return
    }

    if (novo && sessoesAntigo.length > 0) {
      const { error: errSess } = await supabase.from('sessoes_pacote').insert(
        sessoesAntigo.map(s => ({
          cliente_pacote_id: novo.id,
          data_sessao: s.data,
          servico_realizado: s.descricao,
          profissional_id: profile!.id,
        }))
      )
      if (errSess) {
        setErro('Pacote cadastrado, mas houve erro ao salvar as sessões: ' + errSess.message)
        setSalvando(false)
        selecionarCliente(clienteSelecionado)
        return
      }
    }

    setModalAntigo(false)
    setSalvando(false)
    selecionarCliente(clienteSelecionado)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const clientesFiltrados = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))

  if (clienteSelecionado) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pb-8">
        <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <button onClick={() => setClienteSelecionado(null)}><ArrowLeft size={22} className="text-gray-700" /></button>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900">{clienteSelecionado.nome}</h1>
            <p className="text-xs text-gray-400">{clienteSelecionado.email}</p>
          </div>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="flex gap-2">
            <button onClick={abrirModalVenda}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: cor }}>
              <Plus size={16} />Vender Pacote
            </button>
            <button onClick={abrirModalAntigo}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold"
              style={{ borderColor: cor, color: cor }}>
              <Calendar size={16} />Pacote Antigo
            </button>
          </div>

          <p className="font-bold text-gray-900">Pacotes da cliente</p>
          {pacotesCliente.length === 0 ? (
            <div className="card text-center py-8"><p className="text-gray-400">Nenhum pacote ainda</p></div>
          ) : pacotesCliente.map(p => {
            const progresso = p.sessoes_total > 0 ? (p.sessoes_usadas / p.sessoes_total) * 100 : 0
            const sessoesDoPacote = sessoes.filter(s => s.cliente_pacote_id === p.id)
            const podeAdicionar = p.sessoes_usadas < p.sessoes_total
            return (
              <div key={p.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{p.pacotes?.nome || p.observacoes || 'Pacote'}</p>
                    {p.historico_manual && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Cadastro manual</span>}
                  </div>
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (p.status === 'ativo' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500')}>{p.status}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{p.sessoes_usadas} usadas</span>
                    <span>{p.sessoes_total - p.sessoes_usadas} restantes</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 rounded-full" style={{ width: progresso + '%', backgroundColor: cor }} /></div>
                </div>

                {sessoesDoPacote.length > 0 && (
                  <div className="border-t border-gray-100 pt-2">
                    <p className="text-xs font-medium text-gray-500 mb-2">Historico de sessoes</p>
                    {sessoesDoPacote.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs text-gray-500 py-1 gap-2">
                        <span className="shrink-0">{new Date(s.data_sessao + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        <span className="flex-1 truncate">{s.servico_realizado}</span>
                        <button onClick={() => removerSessaoRegistrada(p, s)} className="shrink-0">
                          <X size={12} className="text-gray-300" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {podeAdicionar && (
                  <button onClick={() => abrirModalSessao(p)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-semibold"
                    style={{ borderColor: cor, color: cor }}>
                    <Plus size={13} />Adicionar sessão realizada
                  </button>
                )}

                <p className="text-xs text-gray-400">Vendido por: {p.profiles?.nome || 'Nao informado'}</p>
                {p.pacotes?.regras && (
                  <div className={'flex items-center gap-2 px-3 py-2 rounded-xl ' + (p.regras_confirmadas ? 'bg-green-50' : 'bg-yellow-50')}>
                    {p.regras_confirmadas ? (
                      <>
                        <CheckCircle size={14} className="text-green-600" />
                        <p className="text-xs text-green-700">
                          Cliente confirmou as regras em {new Date(p.regras_confirmadas_em).toLocaleDateString('pt-BR')}
                        </p>
                      </>
                    ) : (
                      <>
                        <Clock size={14} className="text-yellow-600" />
                        <p className="text-xs text-yellow-700">Cliente ainda nao confirmou as regras</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Modal: Vender Pacote (modelo atual) */}
        {modalVenda && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-gray-900 text-lg">Vender Pacote</h3>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Pacote</label>
                <select className="input-field" value={pacoteModeloId} onChange={e => setPacoteModeloId(e.target.value)}>
                  <option value="">Selecione um pacote...</option>
                  {pacotesModelo.map(p => <option key={p.id} value={p.id}>{p.nome} - R$ {Number(p.preco).toFixed(2)}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Data de início</label>
                <input type="date" className="input-field" value={dataInicioVenda}
                  onChange={e => setDataInicioVenda(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Pode ser retroativa, se a cliente já começou o pacote antes de você cadastrar.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Sessões já realizadas (opcional)</label>
                <input type="number" min="0" className="input-field" value={sessoesJaRealizadasVenda}
                  onChange={e => setSessoesJaRealizadasVenda(e.target.value)} />
              </div>

              <p className="text-xs text-gray-400">
                As próximas sessões deste pacote poderão ser confirmadas a partir da agenda, conforme os atendimentos forem realizados.
              </p>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm">{erro}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setModalVenda(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
                <button onClick={venderPacote} disabled={!pacoteModeloId || salvando} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>{salvando ? '...' : 'Confirmar venda'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Pacote Antigo (histórico manual) */}
        {modalAntigo && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
              <h3 className="font-bold text-gray-900 text-lg">Cadastrar Pacote Antigo</h3>
              <p className="text-xs text-gray-400">Para controle histórico de pacotes vendidos antes do sistema</p>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nome/descrição</label>
                <input className="input-field" placeholder="Ex: Pacote 10 sessoes (vendido em papel)"
                  value={formAntigo.nome} onChange={e => setFormAntigo(p => ({ ...p, nome: e.target.value }))} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Total de sessões contratadas</label>
                <input className="input-field" type="number" min="1" value={formAntigo.sessoes_total}
                  onChange={e => setFormAntigo(p => ({ ...p, sessoes_total: e.target.value }))} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Sessões já realizadas</label>

                {sessoesAntigo.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhuma sessão registrada ainda</p>
                ) : sessoesAntigo.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    <span className="text-xs font-medium text-gray-500 shrink-0 w-20">
                      {new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-sm text-gray-800 flex-1 truncate">{s.descricao}</span>
                    <button onClick={() => removerSessaoAntiga(i)}><X size={14} className="text-gray-400" /></button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input type="date" className="input-field w-36 shrink-0" value={novaSessaoData}
                    onChange={e => setNovaSessaoData(e.target.value)} />
                  <input className="input-field flex-1" placeholder="O que foi feito"
                    value={novaSessaoDescricao} onChange={e => setNovaSessaoDescricao(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && adicionarSessaoAntiga()} />
                </div>
                <button onClick={adicionarSessaoAntiga}
                  className="py-2.5 rounded-xl border-2 text-sm font-medium"
                  style={{ borderColor: cor, color: cor }}>
                  + Adicionar sessão
                </button>

                <p className="text-xs text-gray-400">
                  {sessoesAntigo.length} de {formAntigo.sessoes_total || '?'} sessões registradas
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Observações gerais</label>
                <textarea className="input-field resize-none" rows={2} value={formAntigo.observacoes}
                  onChange={e => setFormAntigo(p => ({ ...p, observacoes: e.target.value }))} />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm">{erro}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setModalAntigo(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
                <button onClick={cadastrarAntigo} disabled={salvando || !formAntigo.nome} className="flex-1 py-3 rounded-2xl text-white font-medium" style={{ backgroundColor: cor }}>{salvando ? '...' : 'Cadastrar'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Adicionar sessão a um pacote já existente */}
        {modalSessao && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
              <h3 className="font-bold text-gray-900 text-lg">Adicionar sessão realizada</h3>
              <p className="text-sm text-gray-500">{modalSessao.pacotes?.nome || modalSessao.observacoes || 'Pacote'}</p>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Data</label>
                <input type="date" className="input-field" value={sessaoData}
                  onChange={e => setSessaoData(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">O que foi feito</label>
                <input className="input-field" placeholder="Ex: Manicure + Pedicure"
                  value={sessaoDescricao} onChange={e => setSessaoDescricao(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && adicionarSessaoAoPacote()} />
              </div>

              {erroSessao && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm">{erroSessao}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setModalSessao(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
                <button onClick={adicionarSessaoAoPacote} disabled={salvando || !sessaoDescricao.trim()}
                  className="flex-1 py-3 rounded-2xl text-white font-medium disabled:opacity-50" style={{ backgroundColor: cor }}>
                  {salvando ? '...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg">Pacotes por Cliente</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-11" placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        {clientesFiltrados.map(c => (
          <button key={c.id} onClick={() => selecionarCliente(c)} className="card flex items-center gap-3 active:scale-95 transition-all">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: cor }}>
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
