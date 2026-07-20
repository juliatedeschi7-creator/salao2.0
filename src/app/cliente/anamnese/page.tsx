'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, FileText, CheckCircle, AlertTriangle } from 'lucide-react'

export default function ClienteAnamnesePage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [fichas, setFichas] = useState<any[]>([])
  const [respostas, setRespostas] = useState<any[]>([])
  const [fichaAberta, setFichaAberta] = useState<any>(null)
  const [respostasForm, setRespostasForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setCliente(cli); setSalao(cli?.saloes)
    const { data: fs } = await supabase.from('fichas_anamnese').select('*').eq('salao_id', cli?.saloes?.id).eq('ativa', true)
    setFichas(fs || [])
    const { data: rs } = await supabase.from('respostas_anamnese').select('*').eq('cliente_id', cli?.id)
    setRespostas(rs || [])
  }

  function jaRespondeu(fichaId: string) {
    return respostas.some(r => r.ficha_id === fichaId)
  }

  function abrirFicha(ficha: any) {
    setFichaAberta(ficha)
    const resp = respostas.find(r => r.ficha_id === ficha.id)
    setRespostasForm(resp?.respostas || {})
  }

  async function salvarRespostas() {
    if (!fichaAberta) return
    setSalvando(true)
    const jaResp = respostas.find(r => r.ficha_id === fichaAberta.id)
    if (jaResp) {
await supabase.from('respostas_anamnese').update({ respostas: respostasForm, versao: fichaAberta.versao }).eq('id', jaResp.id)

const { data: dono } = await supabase.from('profiles').select('id')
  .eq('salao_id', salao.id).eq('role', 'dono_salao').single()

if (dono) {
  await notificar({
    salaoId: salao.id,
    remetenteId: profile!.id,
    destinatarioId: dono.id,
    titulo: 'Anamnese atualizada',
    mensagem: cliente?.nome + ' atualizou a ficha: ' + fichaAberta.titulo,
    tipo: 'sistema',
    url: '/salao/clientes'
  })
}
    } else {
      await supabase.from('respostas_anamnese').insert({
        ficha_id: fichaAberta.id, cliente_id: cliente.id,
        versao: fichaAberta.versao, respostas: respostasForm
      })
    }
    setSalvando(false); setSucesso(true); setFichaAberta(null)
    carregarDados()
    setTimeout(() => setSucesso(false), 3000)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const ALERTAS = ['diabetes', 'fungo', 'micose', 'alergia', 'pressao', 'gestante', 'gravida', 'hipertensao']

  function temAlertaResposta(resps: Record<string, string>) {
    return Object.values(resps).some(v => ALERTAS.some(a => v.toLowerCase().includes(a)))
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Fichas de Anamnese</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {sucesso && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3"><p className="text-green-600 text-sm text-center">Respostas salvas!</p></div>}

        {fichas.length === 0 ? (
          <div className="card text-center py-10">
            <FileText size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhuma ficha disponivel</p>
          </div>
        ) : fichas.map(f => {
          const respondida = jaRespondeu(f.id)
          const respostaAtual = respostas.find(r => r.ficha_id === f.id)
          const alerta = respondida && temAlertaResposta(respostaAtual?.respostas || {})
          return (
            <div key={f.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{f.titulo}</p>
                    {respondida && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 flex items-center gap-1"><CheckCircle size={10} />Respondida</span>}
                    {alerta && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 flex items-center gap-1"><AlertTriangle size={10} />Alerta</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{f.categoria}</p>
                </div>
              </div>
              <button onClick={() => abrirFicha(f)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: cor }}>
                {respondida ? 'Editar respostas' : 'Responder ficha'}
              </button>
            </div>
          )
        })}
      </div>

      {fichaAberta && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg">{fichaAberta.titulo}</h3>
            {(fichaAberta.perguntas || []).map((p: any, i: number) => (
              <div key={i}>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{p.pergunta}</label>
                {p.tipo === 'select' ? (
                  <select className="input-field" value={respostasForm[p.id] || ''}
                    onChange={e => setRespostasForm(prev => ({ ...prev, [p.id]: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {p.opcoes?.map((op: string) => <option key={op} value={op}>{op}</option>)}
                  </select>
                ) : p.tipo === 'boolean' ? (
                  <div className="flex gap-3">
                    {['Sim', 'Nao'].map(op => (
                      <button key={op} onClick={() => setRespostasForm(prev => ({ ...prev, [p.id]: op }))}
                        className={'flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ' +
                          (respostasForm[p.id] === op ? 'text-white border-transparent' : 'border-gray-200 text-gray-500')}
                        style={respostasForm[p.id] === op ? { backgroundColor: cor, borderColor: cor } : {}}>
                        {op}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea className="input-field resize-none" rows={3}
                    placeholder="Sua resposta..."
                    value={respostasForm[p.id] || ''}
                    onChange={e => setRespostasForm(prev => ({ ...prev, [p.id]: e.target.value }))} />
                )}
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setFichaAberta(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium">Cancelar</button>
              <button onClick={salvarRespostas} disabled={salvando}
                className="flex-1 py-3 rounded-2xl text-white font-medium"
                style={{ backgroundColor: cor }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
