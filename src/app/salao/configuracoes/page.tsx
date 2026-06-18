'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Link, Copy, Check, LogOut, Palette } from 'lucide-react'

const CORES = [
  { primaria: '#E91E8C', secundaria: '#FCE4F3', nome: 'Rosa' },
  { primaria: '#9C27B0', secundaria: '#F3E5F5', nome: 'Roxo' },
  { primaria: '#E91E63', secundaria: '#FCE4EC', nome: 'Pink' },
  { primaria: '#FF5722', secundaria: '#FBE9E7', nome: 'Laranja' },
  { primaria: '#009688', secundaria: '#E0F2F1', nome: 'Verde' },
  { primaria: '#1976D2', secundaria: '#E3F2FD', nome: 'Azul' },
  { primaria: '#5D4037', secundaria: '#EFEBE9', nome: 'Marrom' },
  { primaria: '#455A64', secundaria: '#ECEFF1', nome: 'Grafite' },
]

export default function ConfiguracoesPage() {
  const { profile, loading, logout } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [copiado, setCopiado] = useState(false)
  const [testando, setTestando] = useState(false)
  const [testeEnviado, setTesteEnviado] = useState(false)
  const [salvandoCor, setSalvandoCor] = useState(false)
  const [corSelecionada, setCorSelecionada] = useState('')

  useEffect(() => {
    if (!loading && profile?.salao_id) carregarDados()
  }, [loading])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)
    setCorSelecionada(sal?.cor_primaria || '#E91E8C')
  }

  function copiarLink() {
    const link = `${window.location.origin}/cadastro?salao=${salao?.slug}`
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function enviarTesteNotificacao() {
    setTestando(true)
    await supabase.from('notificacoes').insert({
      salao_id: profile!.salao_id,
      remetente_id: profile!.id,
      destinatario_id: profile!.id,
      titulo: 'Notificacao de teste',
      mensagem: 'As notificacoes estao funcionando perfeitamente!',
      tipo: 'teste', lida: false
    })
    setTestando(false)
    setTesteEnviado(true)
    setTimeout(() => setTesteEnviado(false), 3000)
  }

  async function salvarCor() {
    const paleta = CORES.find(c => c.primaria === corSelecionada)
    if (!paleta) return
    setSalvandoCor(true)
    await supabase.from('saloes').update({
      cor_primaria: paleta.primaria,
      cor_secundaria: paleta.secundaria
    }).eq('id', profile!.salao_id!)
    setSalvandoCor(false)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg">Configuracoes</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="card flex flex-col gap-3">
          <p className="font-bold text-gray-900">Informacoes do Salao</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Nome</span>
            <span className="font-medium text-gray-900">{salao?.nome}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Cidade</span>
            <span className="font-medium text-gray-900">{salao?.cidade}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Telefone</span>
            <span className="font-medium text-gray-900">{salao?.telefone}</span>
          </div>
          {salao?.instagram && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Instagram</span>
              <span className="font-medium text-gray-900">{salao.instagram}</span>
            </div>
          )}
        </div>

        <div className="card flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Palette size={18} />Paleta de Cores</p>
          <div className="grid grid-cols-4 gap-3">
            {CORES.map(c => (
              <button key={c.primaria} onClick={() => setCorSelecionada(c.primaria)}
                className="flex flex-col items-center gap-1">
                <div className={'w-12 h-12 rounded-full border-4 transition-all ' + (corSelecionada === c.primaria ? 'border-gray-900 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c.primaria }} />
                <span className="text-xs text-gray-500">{c.nome}</span>
              </button>
            ))}
          </div>
          {corSelecionada !== salao?.cor_primaria && (
            <button onClick={salvarCor} disabled={salvandoCor}
              className="w-full py-3 rounded-2xl text-white font-medium"
              style={{ backgroundColor: corSelecionada }}>
              {salvandoCor ? 'Salvando...' : 'Salvar nova cor'}
            </button>
          )}
        </div>

        <div className="card flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Link size={18} />Link de Cadastro de Clientes</p>
          <p className="text-xs text-gray-400">Compartilhe este link para suas clientes se cadastrarem com as cores do seu salao</p>
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-500 break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/cadastro?salao={salao?.slug}</p>
          </div>
          <button onClick={copiarLink}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-medium"
            style={{ backgroundColor: cor }}>
            {copiado ? <><Check size={16} />Copiado!</> : <><Copy size={16} />Copiar link</>}
          </button>
        </div>

        <div className="card flex flex-col gap-3">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Bell size={18} />Notificacoes</p>
          <p className="text-xs text-gray-400">Teste se as notificacoes estao funcionando corretamente</p>
          {testeEnviado && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <p className="text-green-600 text-sm text-center">Notificacao de teste enviada! Verifique o sino no topo.</p>
            </div>
          )}
          <button onClick={enviarTesteNotificacao} disabled={testando}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium"
            style={{ borderColor: cor, color: cor }}>
            <Bell size={16} />{testando ? 'Enviando...' : 'Enviar notificacao de teste'}
          </button>
        </div>

        <button onClick={logout}
          className="flex items-center justify-center gap-2 text-gray-400 text-sm py-4">
          <LogOut size={16} />Sair da conta
        </button>
      </div>
    </div>
  )
}
