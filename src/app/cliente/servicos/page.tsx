'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Star, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'

export default function ClienteServicosPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [depoimentos, setDepoimentos] = useState<any[]>([])
  const [fotos, setFotos] = useState<any[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && profile) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: cli } = await supabase.from('clientes').select('*, saloes(*)').eq('profile_id', profile!.id).single()
    setSalao(cli?.saloes)
    const { data: srvs } = await supabase.from('servicos').select('*').eq('salao_id', cli?.saloes?.id).eq('ativo', true).order('categoria')
    setServicos(srvs || [])
    const { data: deps } = await supabase.from('depoimentos').select('*, clientes(nome)').eq('salao_id', cli?.saloes?.id).eq('publico', true).order('created_at', { ascending: false })
    setDepoimentos(deps || [])
    const { data: fts } = await supabase.from('fotos_servicos').select('*').eq('salao_id', cli?.saloes?.id)
    setFotos(fts || [])
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const corSec = salao?.cor_secundaria || '#FCE4F3'
  const categorias = ['Todos', ...Array.from(new Set(servicos.map(s => s.categoria)))]
  const filtrados = servicos.filter(s => categoriaFiltro === 'Todos' || s.categoria === categoriaFiltro)

  const ALERTAS = ['diabetes', 'fungo', 'micose', 'alergia', 'pressao', 'gestante', 'gravida', 'hipertensao', 'cancer', 'quimio']

  function temAlerta(descricao: string) {
    if (!descricao) return false
    return ALERTAS.some(a => descricao.toLowerCase().includes(a))
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-12 pb-6 flex items-center gap-3" style={{ backgroundColor: cor }}>
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-white" /></button>
        <h1 className="font-bold text-white text-lg">Servicos do Salao</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
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
                        <AlertTriangle size={10} />Leia atencoes
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="font-bold text-sm" style={{ color: cor }}>R$ {s.preco.toFixed(2).replace('.', ',')}</p>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock size={12} />
                      <p className="text-xs">{s.duracao_minutos} min</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setExpandido(aberto ? null : s.id)} className="text-gray-400">
                  {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {aberto && (
                <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                  {s.descricao && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Sobre este servico</p>
                      <p className="text-sm text-gray-500">{s.descricao}</p>
                    </div>
                  )}

                  {alerta && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2">
                      <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-700">Atencao importante</p>
                        <p className="text-xs text-yellow-600 mt-0.5">
                          Este servico pode ter restricoes para certas condicoes de saude. Informe ao profissional sobre diabetes, alergias, gestacao ou outras condicoes antes do procedimento.
                        </p>
                      </div>
                    </div>
                  )}

                  {deps.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Avaliacoes ({deps.length})</p>
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
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
