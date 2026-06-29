'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, ChevronDown, ChevronUp, AlertTriangle, Search, Calendar } from 'lucide-react'

export default function ClienteServicosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [pacotes, setPacotes] = useState<any[]>([])
  const [combos, setCombos] = useState<any[]>([])
  const [depoimentos, setDepoimentos] = useState<any[]>([])
  const [fotos, setFotos] = useState<any[]>([])
  const [aba, setAba] = useState<'avulsos' | 'pacotes' | 'combos'>('avulsos')
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setCliente(cli); setSalao(cli?.saloes)
    const { data: srvs } = await supabase.from('servicos').select('*').eq('salao_id', cli?.saloes?.id).eq('ativo', true).order('categoria')
    setServicos(srvs || [])
    const { data: pacs } = await supabase.from('pacotes').select('*').eq('salao_id', cli?.saloes?.id).eq('ativo', true)
    setPacotes(pacs || [])
    const { data: cmbs } = await supabase.from('combos').select('*').eq('salao_id', cli?.saloes?.id).eq('ativo', true)
    setCombos(cmbs || [])
    const { data: deps } = await supabase.from('depoimentos').select('*, clientes(nome)').eq('salao_id', cli?.saloes?.id).eq('publico', true).order('created_at', { ascending: false })
    setDepoimentos(deps || [])
    const { data: fts } = await supabase.from('fotos_servicos').select('*').eq('salao_id', cli?.saloes?.id)
    setFotos(fts || [])
  }

function AvisoServicos({ cor }: { cor: string }) {
  const texto = `Os tempos exibidos são estimativas e podem variar para mais ou para menos.
Cada procedimento é realizado respeitando as CARACTERISTICAS INDIVIDUAIS de cada cliente.
Diferenciais como CONDICAO DAS UNHAS ou dos cabelos, QUANTIDADE DE CABELO, necessidade de maior preparo das CUTICULAS, MOVIMENTACAO DURANTE O ATENDIMENTO (uso de celular, postura), entre outros fatores, podem alterar o tempo de atendimento.
Nosso foco é a QUALIDADE DO ATENDIMENTO E DO RESULTADO FINAL.`

  function renderLinha(linha: string) {
    const palavras = linha.split(' ')
    return palavras.map((palavra, i) => {
      const ehMaiuscula = palavra === palavra.toUpperCase() && palavra.length > 2 && /[A-Z]/.test(palavra)
      return (
        <span key={i} className={ehMaiuscula ? 'font-bold uppercase' : ''}>
          {palavra}{' '}
        </span>
      )
    })
  }

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: cor }}>
      <div className="text-black text-xs leading-relaxed flex flex-col gap-2">
        {texto.split('\n').map((linha, i) => (
          <p key={i}>{renderLinha(linha)}</p>
        ))}
      </div>
    </div>
  )
}
  async function solicitarAgendamento(servicoId: string) {
    await supabase.from('solicitacoes_agendamento').insert({
      salao_id: salao.id, cliente_id: cliente.id, servico_id: servicoId, status: 'pendente'
    })
    const servico = servicos.find(s => s.id === servicoId)
    await supabase.from('notificacoes').insert({
      salao_id: salao.id,
      remetente_id: profile!.id,
      destinatario_id: salao.dono_id,
      titulo: 'Nova solicitacao de agendamento',
      mensagem: cliente.nome + ' quer agendar: ' + servico?.nome,
      tipo: 'solicitacao'
    })
    alert('Solicitacao enviada! O salao vai sugerir horarios em breve.')
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'
  const ALERTAS = ['diabetes', 'fungo', 'micose', 'alergia', 'pressao', 'gestante', 'gravida', 'hipertensao', 'cancer', 'quimio']

  function temAlerta(descricao: string) {
    if (!descricao) return false
    return ALERTAS.some(a => descricao.toLowerCase().includes(a))
  }

  const servicosFiltrados = servicos.filter(s => s.nome.toLowerCase().includes(busca.toLowerCase()))
  const pacotesFiltrados = pacotes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))
  const combosFiltrados = combos.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Catalogo do Salao</h1>
      </div>

      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm outline-none"
            placeholder="Buscar servico, pacote ou combo..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>
<div className="px-4 py-4 flex flex-col gap-4">
  <AvisoServicos cor={cor} />
  {/* resto do código de filtros e lista de serviços continua aqui */}
      <div className="flex bg-white border-b border-gray-100">
        {[
          { key: 'avulsos', label: 'Servicos Avulsos' },
          { key: 'pacotes', label: 'Pacotes' },
          { key: 'combos', label: 'Combos' },
        ].map(t => (
          <button key={t.key} onClick={() => setAba(t.key as any)}
            className={'flex-1 py-3 text-xs font-medium transition-all ' + (aba === t.key ? 'border-b-2' : 'text-gray-400')}
            style={aba === t.key ? { color: cor, borderColor: cor } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {aba === 'avulsos' && (
          servicosFiltrados.length === 0 ? (
            <div className="card text-center py-10"><p className="text-gray-400">Nenhum servico encontrado</p></div>
          ) : servicosFiltrados.map(s => {
            const fotosServico = fotos.filter(f => f.servico_id === s.id)
            const deps = depoimentos.filter(d => d.servico_id === s.id)
            const aberto = expandido === s.id
            const alerta = temAlerta(s.descricao)
            return (
              <div key={s.id} className="card flex flex-col gap-3">
                {fotosServico.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                    {fotosServico.map(f => <img key={f.id} src={f.url} alt={s.nome} className="w-24 h-24 rounded-xl object-cover shrink-0" />)}
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{s.nome}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.categoria}</span>
                      {alerta && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1"><AlertTriangle size={10} />Atencao</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="font-bold text-sm" style={{ color: cor }}>R$ {s.preco.toFixed(2).replace('.', ',')}</p>
                      <div className="flex items-center gap-1 text-gray-400"><Clock size={12} /><p className="text-xs">{s.duracao_minutos} min</p></div>
                    </div>
                  </div>
                  <button onClick={() => setExpandido(aberto ? null : s.id)} className="text-gray-400">
                    {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {aberto && (
                  <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                    {s.descricao && <p className="text-sm text-gray-500">{s.descricao}</p>}
                    {alerta && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2">
                        <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-600">Informe ao profissional sobre condicoes de saude antes do procedimento.</p>
                      </div>
                    )}
                    {deps.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Avaliacoes ({deps.length})</p>
                        {deps.map(d => (
                          <div key={d.id} className="bg-gray-50 rounded-xl p-3 mb-2">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: cor }}>
                                {d.clientes?.nome?.charAt(0).toUpperCase()}
                              </div>
                              <p className="text-xs font-medium text-gray-700">{d.clientes?.nome}</p>
                            </div>
                            <p className="text-sm text-gray-600">{d.texto}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => solicitarAgendamento(s.id)}
                      className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                      style={{ backgroundColor: cor }}>
                      <Calendar size={16} />Quero agendar este servico
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}

        {aba === 'pacotes' && (
          pacotesFiltrados.length === 0 ? (
            <div className="card text-center py-10"><p className="text-gray-400">Nenhum pacote disponivel</p></div>
          ) : pacotesFiltrados.map(p => (
            <div key={p.id} className="card flex flex-col gap-2">
              <p className="font-bold text-gray-900">{p.nome}</p>
              {p.descricao && <p className="text-sm text-gray-500">{p.descricao}</p>}
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: corSec, color: cor }}>{p.sessoes_inclusas} sessoes</span>
                <p className="font-bold" style={{ color: cor }}>R$ {p.preco.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>
          ))
        )}

        {aba === 'combos' && (
          combosFiltrados.length === 0 ? (
            <div className="card text-center py-10"><p className="text-gray-400">Nenhum combo disponivel</p></div>
          ) : combosFiltrados.map(c => (
            <div key={c.id} className="card flex flex-col gap-2">
              <p className="font-bold text-gray-900">{c.nome}</p>
              {c.descricao && <p className="text-sm text-gray-500">{c.descricao}</p>}
              <p className="font-bold mt-1" style={{ color: cor }}>R$ {c.preco.toFixed(2).replace('.', ',')}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
