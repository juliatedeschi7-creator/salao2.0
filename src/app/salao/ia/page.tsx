'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Send, ChevronRight, Users, Calendar, TrendingUp, Gift, Package, Loader2, RefreshCw } from 'lucide-react'

type Sugestao = {
  icone: any
  titulo: string
  descricao: string
  acao?: string
  aacaoLabel?: string
  dadosCliente?: any
}

type Mensagem = {
  role: 'user' | 'assistant'
  content: string
}

export default function IAPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(true)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [pergunta, setPergunta] = useState('')
  const [respondendo, setRespondendo] = useState(false)
  const [contexto, setContexto] = useState<any>(null)
  const [copiado, setCopiado] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && profile?.salao_id) inicializar()
  }, [loading])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function inicializar() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    await Promise.all([gerarSugestoes(sal), carregarContexto()])
  }

  async function carregarContexto() {
    const sid = profile!.salao_id!
    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString()

    const [clientes, agendamentos, servicos, financeiro] = await Promise.all([
      supabase.from('clientes').select('id, nome, email, telefone, data_nascimento').eq('salao_id', sid),
      supabase.from('agendamentos').select('*, servicos(nome, preco)').eq('salao_id', sid).gte('data', inicioMes),
      supabase.from('servicos').select('*').eq('salao_id', sid).eq('ativo', true),
      supabase.from('financeiro').select('*').eq('salao_id', sid).gte('data', inicioMes)
    ])

    setContexto({
      clientes: clientes.data || [],
      agendamentos: agendamentos.data || [],
      servicos: servicos.data || [],
      financeiro: financeiro.data || []
    })
  }

  async function gerarSugestoes(sal: any) {
    setCarregandoSugestoes(true)
    const sid = profile!.salao_id!
    const hoje = new Date()
    const novas: Sugestao[] = []

    // 1 — Clientes inativos 30+ dias
    const { data: clientesAg } = await supabase
      .from('clientes')
      .select('id, nome, agendamentos(data)')
      .eq('salao_id', sid)

    const inativos = (clientesAg || []).filter(c => {
      const ags = (c as any).agendamentos || []
      if (!ags.length) return true
      const ultima = new Date(Math.max(...ags.map((a: any) => new Date(a.data).getTime())))
      return (hoje.getTime() - ultima.getTime()) / 86400000 >= 30
    })

    if (inativos.length > 0) {
      const nomes = inativos.slice(0, 3).map((c: any) => c.nome).join(', ')
      const extra = inativos.length > 3 ? ` e mais ${inativos.length - 3}` : ''
      novas.push({
        icone: Users,
        titulo: `${inativos.length} cliente${inativos.length > 1 ? 's' : ''} sem visita há 30+ dias`,
        descricao: `${nomes}${extra} podem estar indo para a concorrência. Que tal um lembrete carinhoso?`,
        acao: `Oi {nome}! Saudades de você aqui no ${sal?.nome} 💕 Temos novidades esperando por você! Que tal agendar um horário?`,
        aacaoLabel: 'Copiar mensagem WhatsApp',
        dadosCliente: inativos[0]
      })
    }

    // 2 — Aniversariantes da semana
    const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay())
    const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6)

    const { data: todos } = await supabase.from('clientes').select('id, nome, data_nascimento').eq('salao_id', sid)
    const aniv = (todos || []).filter(c => {
      if (!(c as any).data_nascimento) return false
      const nasc = new Date((c as any).data_nascimento)
      const esteAno = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate())
      return esteAno >= inicioSemana && esteAno <= fimSemana
    })

    if (aniv.length > 0) {
      novas.push({
        icone: Gift,
        titulo: `🎂 ${aniv.length} aniversariante${aniv.length > 1 ? 's' : ''} essa semana`,
        descricao: aniv.map((c: any) => c.nome).join(', '),
        acao: `Feliz aniversário, {nome}! 🎉 O ${sal?.nome} deseja um dia incrível pra você! Que tal comemorar com um mimo especial? Me chama! 💅`,
        aacaoLabel: 'Copiar mensagem WhatsApp',
        dadosCliente: aniv[0]
      })
    }

    // 3 — Horários vazios nos próximos 7 dias
    const daqui7 = new Date(hoje.getTime() + 7 * 86400000).toISOString().split('T')[0]
    const { data: ags } = await supabase
      .from('agendamentos')
      .select('data, hora')
      .eq('salao_id', sid)
      .gte('data', hoje.toISOString().split('T')[0])
      .lte('data', daqui7)

    const ocupados = new Set((ags || []).map((a: any) => `${a.data}-${a.hora}`))
    const horariosPico = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']
    let vazios = 0
    for (let i = 1; i <= 7; i++) {
      const d = new Date(hoje); d.setDate(hoje.getDate() + i)
      if (d.getDay() === 0) continue // pula domingo
      const ds = d.toISOString().split('T')[0]
      for (const h of horariosPico) {
        if (!ocupados.has(`${ds}-${h}`)) vazios++
      }
    }

    if (vazios >= 6) {
      novas.push({
        icone: Calendar,
        titulo: `${vazios} horários livres nos próximos 7 dias`,
        descricao: 'Vários horários nobres disponíveis. Uma promoção relâmpago pode preencher a agenda rapidinho.',
        acao: `⚡ Promoção relâmpago no ${sal?.nome}! Temos horários especiais disponíveis essa semana. Preços imperdíveis pra você que é nossa cliente 💕 Chama no WhatsApp!`,
        aacaoLabel: 'Copiar promoção'
      })
    }

    // 4 — Serviço mais rentável do mês
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
    const { data: agMes } = await supabase
      .from('agendamentos')
      .select('servico_id, servicos(nome, preco)')
      .eq('salao_id', sid)
      .eq('status', 'concluido')
      .gte('data', inicioMes)

    if (agMes && agMes.length > 0) {
      const mapa: Record<string, { nome: string; total: number; count: number }> = {}
      for (const a of agMes) {
        const s = (a as any).servicos
        if (!s) continue
        if (!mapa[a.servico_id]) mapa[a.servico_id] = { nome: s.nome, total: 0, count: 0 }
        mapa[a.servico_id].total += s.preco || 0
        mapa[a.servico_id].count++
      }
      const top = Object.values(mapa).sort((a, b) => b.total - a.total)[0]
      if (top) {
        novas.push({
          icone: TrendingUp,
          titulo: `"${top.nome}" é o serviço campeão do mês`,
          descricao: `Realizado ${top.count}x, gerando R$${top.total.toFixed(2)} este mês. Vale divulgar mais nas redes!`,
          acao: `✨ Nosso serviço mais amado esse mês: ${top.nome}! Agende o seu no ${sal?.nome} e se cuide com quem mais entende de você 💕`,
          aacaoLabel: 'Copiar para divulgação'
        })
      }
    }

    // 5 — Pacotes próximos do vencimento
    const daqui15 = new Date(hoje.getTime() + 15 * 86400000).toISOString().split('T')[0]
    const { data: pacotes } = await supabase
      .from('pacotes_cliente')
      .select('*, clientes(nome)')
      .eq('salao_id', sid)
      .gte('validade', hoje.toISOString().split('T')[0])
      .lte('validade', daqui15)

    if (pacotes && pacotes.length > 0) {
      const nomesPac = (pacotes as any[]).slice(0, 3).map((p: any) => p.clientes?.nome).filter(Boolean).join(', ')
      novas.push({
        icone: Package,
        titulo: `${pacotes.length} pacote${pacotes.length > 1 ? 's' : ''} vencem em até 15 dias`,
        descricao: `${nomesPac} estão com pacotes prestes a expirar. Um lembrete evita que percam.`,
        acao: `Oi {nome}! Passando pra lembrar que seu pacote aqui no ${sal?.nome} está perto de vencer 💕 Vamos agendar antes que expire?`,
        aacaoLabel: 'Copiar lembrete',
        dadosCliente: (pacotes[0] as any).clientes
      })
    }

    setSugestoes(novas)
    setCarregandoSugestoes(false)
  }

  async function enviarPergunta(e: React.FormEvent) {
    e.preventDefault()
    if (!pergunta.trim() || respondendo || !contexto) return

    const texto = pergunta.trim()
    setMensagens(prev => [...prev, { role: 'user', content: texto }])
    setPergunta('')
    setRespondendo(true)

    try {
      const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

      // Monta resumo de agendamentos por serviço
      const porServico: Record<string, { nome: string; count: number; total: number }> = {}
      for (const a of contexto.agendamentos) {
        const s = a.servicos
        if (!s || !a.servico_id) continue
        if (!porServico[a.servico_id]) porServico[a.servico_id] = { nome: s.nome, count: 0, total: 0 }
        porServico[a.servico_id].count++
        porServico[a.servico_id].total += s.preco || 0
      }

      const resumoServicos = Object.values(porServico)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(s => `${s.nome}: ${s.count}x (R$${s.total.toFixed(2)})`)
        .join('\n')

      const faturamentoTotal = contexto.financeiro
        .filter((f: any) => f.tipo === 'entrada' || f.valor > 0)
        .reduce((acc: number, f: any) => acc + (f.valor || 0), 0)

      const clientesFrequentes = contexto.clientes
        .map((c: any) => ({
          nome: c.nome,
          visitas: contexto.agendamentos.filter((a: any) => a.cliente_id === c.id).length
        }))
        .sort((a: any, b: any) => b.visitas - a.visitas)
        .slice(0, 5)
        .map((c: any) => `${c.nome} (${c.visitas} visitas)`)
        .join(', ')

      const ctx = `
Salão: ${salao?.nome}
Mês de referência: ${mesAtual}
Total de clientes cadastrados: ${contexto.clientes.length}
Agendamentos nos últimos 2 meses: ${contexto.agendamentos.length}
Faturamento registrado nos últimos 2 meses: R$${faturamentoTotal.toFixed(2)}
Serviços oferecidos: ${contexto.servicos.map((s: any) => `${s.nome} (R$${s.preco})`).join(', ')}
Desempenho por serviço (últimos 2 meses):
${resumoServicos}
Clientes mais frequentes: ${clientesFrequentes || 'sem dados suficientes'}
      `.trim()

      const historico = mensagens.map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: `Você é uma assistente de negócios especializada em salões de beleza brasileiros. A dona do salão vai te fazer perguntas sobre o próprio negócio. Você tem acesso aos dados reais do salão dela. Responda de forma direta, calorosa e prática, em português brasileiro. Use os dados fornecidos para dar respostas precisas com números reais. Se algum dado não estiver disponível, diga com naturalidade. Nunca invente números ou clientes. Seja objetiva — responda em no máximo 3 parágrafos curtos.`,
          messages: [
            ...historico,
            {
              role: 'user',
              content: `Dados do meu salão:\n${ctx}\n\nMinha pergunta: ${texto}`
            }
          ]
        })
      })

      const data = await response.json()
      const resposta = data.content?.map((b: any) => b.text || '').join('') || 'Não consegui processar sua pergunta. Tente novamente.'
      setMensagens(prev => [...prev, { role: 'assistant', content: resposta }])
    } catch {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar com o assistente. Verifique sua conexão e tente novamente.' }])
    }

    setRespondendo(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function copiarTexto(texto: string, cliente?: any, id?: string) {
    const msg = cliente?.nome ? texto.replace('{nome}', cliente.nome) : texto
    navigator.clipboard.writeText(msg)
    setCopiado(id || texto.slice(0, 20))
    setTimeout(() => setCopiado(''), 2000)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <div className="flex items-center gap-2 flex-1">
          <Sparkles size={20} style={{ color: cor }} />
          <h1 className="font-bold text-gray-900 text-lg">Assistente IA</h1>
        </div>
        <button onClick={() => { setSugestoes([]); setCarregandoSugestoes(true); gerarSugestoes(salao) }}
          className="p-2 rounded-full" style={{ backgroundColor: corSec }}>
          <RefreshCw size={16} style={{ color: cor }} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-6">

        {/* PARTE 1 — Sugestões automáticas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Detectado agora no seu salão</p>
            <p className="text-xs text-gray-400">Atualiza ao abrir</p>
          </div>

          {carregandoSugestoes ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gray-100 shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : sugestoes.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <Sparkles size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-sm font-medium">Tudo em dia!</p>
              <p className="text-gray-400 text-xs mt-1">Nenhuma sugestão no momento. Volte amanhã.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sugestoes.map((s, i) => {
                const Icone = s.icone
                const uid = `s-${i}`
                return (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: corSec }}>
                        <Icone size={18} style={{ color: cor }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{s.titulo}</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.descricao}</p>
                      </div>
                    </div>
                    {s.acao && (
                      <button onClick={() => copiarTexto(s.acao!, s.dadosCliente, uid)}
                        className="w-full py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                        style={{ backgroundColor: cor }}>
                        {copiado === uid ? '✓ Copiado!' : <>{s.aacaoLabel} <ChevronRight size={14} /></>}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* PARTE 2 — Chat com a IA */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Pergunte sobre seu negócio</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

            {/* Área de mensagens */}
            <div className="p-4 flex flex-col gap-3 min-h-[160px] max-h-[340px] overflow-y-auto">
              {mensagens.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: corSec }}>
                    <Sparkles size={22} style={{ color: cor }} />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">O que você quer saber?</p>
                  <div className="flex flex-col gap-1.5 mt-3 w-full">
                    {[
                      'Qual minha cliente mais fiel?',
                      'Que serviço devo promover esse mês?',
                      'Quanto faturei este mês?'
                    ].map(ex => (
                      <button key={ex} onClick={() => setPergunta(ex)}
                        className="text-xs px-3 py-2 rounded-xl border border-gray-100 text-gray-500 text-left hover:border-gray-200 transition-colors">
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {mensagens.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`} style={m.role === 'user' ? { backgroundColor: cor } : {}}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {respondendo && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 px-3.5 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-2">
                        <Loader2 size={13} className="animate-spin text-gray-400" />
                        <span className="text-xs text-gray-400">Analisando seus dados...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 p-3">
              <form onSubmit={enviarPergunta} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={pergunta}
                  onChange={e => setPergunta(e.target.value)}
                  placeholder={contexto ? 'Faça uma pergunta...' : 'Carregando dados...'}
                  disabled={!contexto}
                  className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 text-sm outline-none border border-transparent focus:border-gray-200 transition-colors"
                />
                <button type="submit" disabled={!pergunta.trim() || respondendo || !contexto}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: cor }}>
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}