'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, ChevronDown, ChevronUp, AlertTriangle, Calendar, CheckCircle, Camera, X, Send } from 'lucide-react'

function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const mins = minutos % 60
  if (mins === 0) return horas === 1 ? '1 hora' : `${horas} horas`
  return `${horas} hora${horas > 1 ? 's' : ''} e ${mins} minutos`
}

function AvisoServicos({ cor, texto }: { cor: string; texto?: string | null }) {
  const linhas = texto ? texto.split('\n').map(l => l.trim()).filter(l => l.length > 0) : []
  if (linhas.length === 0) return null

  function renderLinha(linha: string) {
    return linha.split(' ').map((palavra, i) => {
      const limpa = palavra.replace(/[(),.]/g, '')
      const ehMaiuscula = limpa.length > 2 && limpa === limpa.toUpperCase() && /[A-Z]/.test(limpa)
      return <span key={i} className={ehMaiuscula ? 'font-bold' : ''}>{palavra} </span>
    })
  }

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: cor }}>
      <div className="text-black text-xs leading-relaxed flex flex-col gap-2">
        {linhas.map((linha, i) => <p key={i}>{renderLinha(linha)}</p>)}
      </div>
    </div>
  )
}

function DescricaoServico({ texto, cor }: { texto: string; cor: string }) {
  const [expandida, setExpandida] = useState(false)
  const longa = texto.length > 120
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1">Sobre este serviço</p>
      <p className={`text-sm text-gray-500 leading-relaxed ${!expandida && longa ? 'line-clamp-2' : ''}`}>
        {texto}
      </p>
      {longa && (
        <button onClick={() => setExpandida(!expandida)}
          className="text-sm font-semibold mt-1 underline" style={{ color: cor }}>
          {expandida ? 'Ler menos' : 'Ler mais'}
        </button>
      )}
    </div>
  )
}

export default function ClienteServicosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [depoimentos, setDepoimentos] = useState<any[]>([])
  const [fotos, setFotos] = useState<any[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [solicitados, setSolicitados] = useState<Set<string>>(new Set())
  const [solicitando, setSolicitando] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [modalOrcamento, setModalOrcamento] = useState<any>(null)
  const [fotoOrcamento, setFotoOrcamento] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [mensagemOrcamento, setMensagemOrcamento] = useState('')
  const [enviandoOrcamento, setEnviandoOrcamento] = useState(false)
  const [orcamentosEnviados, setOrcamentosEnviados] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    const cliRes = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    const cli = cliRes.data
    if (!cli) { setCarregando(false); return }
    setCliente(cli); setSalao(cli.saloes)
    const salaoId = cli.saloes?.id
    const [srvsRes, depsRes, ftsRes] = await Promise.all([
      supabase.from('servicos').select('*').eq('salao_id', salaoId).eq('ativo', true).order('categoria'),
      supabase.from('depoimentos').select('*, clientes(nome)').eq('salao_id', salaoId).eq('publico', true).order('created_at', { ascending: false }),
      supabase.from('fotos_servicos').select('*').eq('salao_id', salaoId),
    ])
    setServicos(srvsRes.data || [])
    setDepoimentos(depsRes.data || [])
    setFotos(ftsRes.data || [])
    setCarregando(false)
  }

  async function solicitarAgendamento(servicoId: string) {
    if (solicitados.has(servicoId) || solicitando === servicoId) return
    setSolicitando(servicoId)
    await supabase.from('solicitacoes_agendamento').insert({
      salao_id: salao.id, cliente_id: cliente.id, servico_id: servicoId, status: 'pendente'
    })
    const servico = servicos.find(s => s.id === servicoId)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile!.id, destinatario_id: salao.dono_id,
      titulo: 'Nova solicitação de agendamento',
      mensagem: `${cliente.nome} quer agendar: ${servico?.nome}`, tipo: 'solicitacao'
    })
    setSolicitados(prev => new Set(Array.from(prev).concat(servicoId)))
    setSolicitando(null)
  }

  async function enviarOrcamento() {
    if (!modalOrcamento) return
    setEnviandoOrcamento(true)
    let urlFoto = null

    if (fotoOrcamento) {
      const ext = fotoOrcamento.name.split('.').pop()
      const path = `orcamentos/${salao.id}/${cliente.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('fotos-servicos').upload(path, fotoOrcamento)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('fotos-servicos').getPublicUrl(path)
        urlFoto = urlData.publicUrl
      }
    }

    await supabase.from('solicitacoes_agendamento').insert({
      salao_id: salao.id, cliente_id: cliente.id, servico_id: modalOrcamento.id,
      status: 'pendente', tipo: 'orcamento',
      foto_orcamento: urlFoto, mensagem_orcamento: mensagemOrcamento || null
    })

    await supabase.from('notificacoes').insert({
      salao_id: salao.id, remetente_id: profile!.id, destinatario_id: salao.dono_id,
      titulo: `Pedido de orçamento: ${modalOrcamento.nome}`,
      mensagem: `${cliente.nome} pediu orçamento para ${modalOrcamento.nome}.${mensagemOrcamento ? ' Mensagem: ' + mensagemOrcamento : ''}`,
      tipo: 'solicitacao'
    })

    setOrcamentosEnviados(prev => new Set(Array.from(prev).concat(modalOrcamento.id)))
    setModalOrcamento(null); setFotoOrcamento(null); setFotoPreview(null); setMensagemOrcamento('')
    setEnviandoOrcamento(false)
  }

  function selecionarFoto(file: File) {
    setFotoOrcamento(file)
    const reader = new FileReader()
    reader.onload = e => setFotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const categorias = ['Todos', ...Array.from(new Set(servicos.map(s => s.categoria)))]
  const filtrados = servicos.filter(s => categoriaFiltro === 'Todos' || s.categoria === categoriaFiltro)
  const ALERTAS = ['diabetes', 'fungo', 'micose', 'alergia', 'pressao', 'gestante', 'gravida', 'hipertensao', 'cancer', 'quimio']
  function temAlerta(descricao: string) {
    if (!descricao) return false
    return ALERTAS.some(a => descricao.toLowerCase().includes(a))
  }

  if (loading || carregando) return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Serviços disponíveis</h1>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Serviços disponíveis</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {categoriaFiltro === 'Todos' && salao?.aviso_servicos && (
          <AvisoServicos cor={cor} texto={salao.aviso_servicos} />
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {categorias.map(c => (
            <button key={c} onClick={() => setCategoriaFiltro(c)}
              className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
              style={categoriaFiltro === c ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#6b7280' }}>
              {c}
            </button>
          ))}
        </div>

        {filtrados.map(s => {
          const fotosServico = fotos.filter(f => f.servico_id === s.id)
          const deps = depoimentos.filter(d => d.servico_id === s.id)
          const aberto = expandido === s.id
          const alerta = temAlerta(s.descricao)
          const jaSolicitado = solicitados.has(s.id)
          const enviando = solicitando === s.id
          const jaOrcamento = orcamentosEnviados.has(s.id)
          const precoVariavel = s.tipo_preco === 'variavel'

          return (
            <div key={s.id} className="card flex flex-col gap-3">
              {fotosServico.length > 0 && (
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                  {fotosServico.map(f => (
                    <img key={f.id} src={f.url} alt={s.nome}
                      className="w-24 h-24 rounded-xl object-cover shrink-0" />
                  ))}
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{s.nome}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.categoria}</span>
                    {alerta && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                        <AlertTriangle size={10} />Leia atenções
                      </span>
                    )}
                    {precoVariavel && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                        Preço sob consulta
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="font-bold text-sm" style={{ color: cor }}>
                      {precoVariavel
                        ? `A partir de R$ ${(s.preco_minimo || s.preco).toFixed(2).replace('.', ',')}`
                        : `R$ ${s.preco.toFixed(2).replace('.', ',')}`}
                    </p>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock size={12} />
                      <p className="text-xs">{formatarDuracao(s.duracao_minutos)}</p>
                    </div>
                  </div>
                </div>

                <button onClick={() => setExpandido(aberto ? null : s.id)} className="text-gray-400 ml-2">
                  {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {aberto && (
                <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                  {s.descricao && <DescricaoServico texto={s.descricao} cor={cor} />}

                  {alerta && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2">
                      <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-700">Atenção importante</p>
                        <p className="text-xs text-yellow-600 mt-0.5">
                          Este serviço pode ter restrições para certas condições de saúde. Informe ao profissional sobre diabetes, alergias, gestação ou outras condições antes do procedimento.
                        </p>
                      </div>
                    </div>
                  )}

                  {deps.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Avaliações ({deps.length})</p>
                      {deps.map(d => (
                        <div key={d.id} className="bg-gray-50 rounded-xl p-3 mb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: cor }}>
                              {d.clientes?.nome?.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-xs font-medium text-gray-700">{d.clientes?.nome}</p>
                            <p className="text-xs text-gray-400 ml-auto">{new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <p className="text-sm text-gray-600">{d.texto}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {precoVariavel ? (
                    <button
                      onClick={() => setModalOrcamento(s)}
                      disabled={jaOrcamento}
                      className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                      style={{ backgroundColor: jaOrcamento ? '#22c55e' : cor, color: 'white' }}>
                      {jaOrcamento ? (
                        <><CheckCircle size={16} />Orçamento enviado!</>
                      ) : (
                        <><Camera size={16} />Pedir orçamento</>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => solicitarAgendamento(s.id)}
                      disabled={jaSolicitado || enviando}
                      className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                      style={{ backgroundColor: jaSolicitado ? '#22c55e' : cor, color: 'white', opacity: enviando ? 0.7 : 1 }}>
                      {enviando ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : jaSolicitado ? (
                        <><CheckCircle size={16} />Pedido feito, aguarde as sugestões de horários</>
                      ) : (
                        <><Calendar size={16} />Quero agendar este serviço</>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {modalOrcamento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Pedir orçamento</h3>
              <button onClick={() => { setModalOrcamento(null); setFotoOrcamento(null); setFotoPreview(null); setMensagemOrcamento('') }}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-500">{modalOrcamento.nome}</p>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">
                Foto (opcional) — envie uma foto do seu cabelo/unhas para avaliação
              </label>
              {fotoPreview ? (
                <div className="relative">
                  <img src={fotoPreview} alt="preview" className="w-full h-48 object-cover rounded-2xl" />
                  <button onClick={() => { setFotoOrcamento(null); setFotoPreview(null) }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer gap-2">
                  <Camera size={28} className="text-gray-300" />
                  <p className="text-xs text-gray-400">Toque para adicionar foto</p>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) selecionarFoto(e.target.files[0]) }} />
                </label>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">
                Mensagem (opcional)
              </label>
              <textarea
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                rows={3}
                placeholder="Descreva o que deseja, se tem alguma preferência de cor, comprimento, etc..."
                value={mensagemOrcamento}
                onChange={e => setMensagemOrcamento(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setModalOrcamento(null); setFotoOrcamento(null); setFotoPreview(null); setMensagemOrcamento('') }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">
                Cancelar
              </button>
              <button onClick={enviarOrcamento} disabled={enviandoOrcamento}
                className="flex-1 py-3 rounded-2xl text-white font-semibold flex items-center justify-center gap-2"
                style={{ backgroundColor: cor }}>
                {enviandoOrcamento
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Send size={16} />Enviar pedido</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
