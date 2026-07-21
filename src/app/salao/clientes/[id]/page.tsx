'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useParams } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Mail, Calendar, Package, ClipboardList, Camera, Edit2, Check, X, Lock } from 'lucide-react'

export default function ClientePerfilPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string

  const [salao, setSalao] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [pacotes, setPacotes] = useState<any[]>([])
  const [anamneses, setAnamneses] = useState<any[]>([])
  const [aba, setAba] = useState<'resumo' | 'pacotes' | 'historico' | 'anamnese'>('resumo')
  const [carregando, setCarregando] = useState(true)
  const [editandoObs, setEditandoObs] = useState(false)
  const [obsText, setObsText] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    carregarDados()
  }, [loading, profile, clienteId])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: cli } = await supabase.from('clientes').select('*').eq('id', clienteId).single()
    setCliente(cli)
    setObsText(cli?.observacoes_internas || '')

    const { data: ags } = await supabase.from('agendamentos')
      .select('*, servicos(nome, preco), profiles!agendamentos_profissional_id_fkey(nome)')
      .eq('cliente_id', clienteId).order('data_hora', { ascending: false })
    setAgendamentos(ags || [])

    const { data: pacs } = await supabase.from('cliente_pacotes')
      .select('*, pacotes(nome, sessoes_inclusas), profiles!vendido_por(nome)')
      .eq('cliente_id', clienteId).order('data_compra', { ascending: false })
    setPacotes(pacs || [])

    const { data: ans } = await supabase.from('respostas_anamnese')
      .select('*, fichas_anamnese(titulo)')
      .eq('cliente_id', clienteId).order('created_at', { ascending: false })
    setAnamneses(ans || [])

    setCarregando(false)
  }

  async function salvarObservacoes() {
    setSalvandoObs(true
