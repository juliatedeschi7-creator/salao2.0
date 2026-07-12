'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { ArrowLeft, Search, UserPlus, Copy, Check, Users, QrCode, X, CheckCircle, XCircle, Clock, Share } from 'lucide-react'

export default function ClientesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [pendentes, setPendentes] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<'ativos' | 'pendentes'>('ativos')
  const [copiado, setCopiado] = useState('')
  const [modalQR, setModalQR] = useState(false)
  const [modalIOS, setModalIOS] = useState(false)
  const [aprovando, setAprovando] = useState<string | null>(null)
  // Fallback fixo pro build/SSR, onde "window" não existe. É substituído
  // pela origem real assim que o componente monta no navegador.
  const [origem, setOrigem] = useState('https://organize-seusalao.vercel.app')

  useEffect(() => {
    // Só roda no navegador — aqui "window" já existe com segurança
    setOrigem(window.location.origin)
  }, [])

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!temAcessoTotal(profile)) { router.push('/login'); return }
    if (profile.salao_id) carregarDados()

    // Detecta se é iOS e se ainda não foi instalado como PWA
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    const isStandalone = (window.navigator as any).standalone === true
    const jaViu = localStorage.getItem('ios_install_banner_visto')
    if (isIOS && !isStandalone && !jaViu) {
      setTimeout(() => setModalIOS(true), 2000)
    }
  }, [loading, profile])

  async function carregarDados() {
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: clis } = await supabase.from('clientes')
      .select('*, profiles!clientes_profile_id_fkey(aprovado, ativo, role)')
      .eq('salao_id', profile!.salao_id!)
      .order('nome')
    
    const ativos = (clis || []).filter((c: any) => c.profiles?.aprovado !== false)
    const pends = (clis || []).filter((c: any) => c.profiles?.aprovado === false && c.profile_id)
    setClientes(ativos)
    setPendentes(pends)
  }

  async function aprovarCliente(cliente: any) {
    setAprovando(cliente.id)
    const { error } = await supabase.from('profiles').update({ aprovado: true }).eq('id', cliente.profile_id)
    if (error) {
      alert('Erro ao aprovar: ' + error.message)
      setAprovando(null)
      return
    }
    await supabase.from('notificacoes').insert({
      salao_id: profile!.salao_id,
      remetente_id: profile!.id,
      destinatario_id: cliente.profile_id,
      titulo: '✅ Cadastro aprovado!',
      mensagem: `Seu cadastro no ${salao?.nome} foi aprovado! Já pode acessar sua área de cliente.`,
      tipo: 'sistema'
    })
    setAprovando(null)
    carregarDados()
  }

  async function rejeitarCliente(cliente: any) {
    setAprovando(cliente.id)
    const { error } = await supabase.from('profiles').update({ aprovado: false, ativo: false }).eq('id', cliente.profile_id)
    if (error) {
      alert('Erro ao recusar: ' + error.message)
      setAprovando(null)
      return
    }
    await supabase.from('clientes').update({ profile_id: null }).eq('id', cliente.id)
    setAprovando(null)
    carregarDados()
  }

  function copiarLink(tipo: 'cadastro' | 'login') {
    const slug = salao?.slug
    const link = tipo === 'cadastro'
      ? `${origem}/cadastro?salao=${slug}`
      : `${origem}/login?salao=${slug}`
    navigator.clipboard.writeText(link)
    setCopiado(tipo)
    setTimeout(() => setCopiado(''), 2000)
  }

  function fecharBannerIOS() {
    localStorage.setItem('ios_install_banner_visto', '1')
    setModalIOS(false)
  }

  const cor = salao?.cor_primaria || '#E91E8C'
  const slug = salao?.slug || ''
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${origem}/cadastro?salao=${slug}`)}`

  const clientesFiltrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-8">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-900 text-lg flex-1">Clientes</h1>
        <button onClick={() => setModalQR(true)}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <QrCode size={18} className="text-gray-600" />
        </button>
      </div>

      {pendentes.length > 0 && (
        <div className="mx-4 mt-4 bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 flex items-center gap-2">
          <Clock size={16} className="text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-700 font-medium">
            {pendentes.length} cliente{pendentes.length > 1 ? 's' : ''} aguardando aprovação
          </p>
          <button onClick={() => setAba('pendentes')} className="ml-auto text-xs font-bold text-yellow-700 underline">Ver</button>
        </div>
      )}

      <div className="px-4 mt-4 flex gap-2">
        <button onClick={() => setAba('ativos')}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={aba === 'ativos' ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#9ca3af' }}>
          Ativas ({clientes.length})
        </button>
        <button onClick={() => setAba('pendentes')}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all relative"
          style={aba === 'pendentes' ? { backgroundColor: cor, color: 'white' } : { backgroundColor: 'white', color: '#9ca3af' }}>
          Pendentes
          {pendentes.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
              {pendentes.length}
            </span>
          )}
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {aba === 'ativos' && (
          <>
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input-field pl-11" placeholder="Buscar cliente..."
                value={busca} onChange={e => setBusca(e.target.value)} />
            </div>

            <div className="card flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">Links de acesso</p>
              <button onClick={() => copiarLink('cadastro')}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-dashed border-gray-200 active:scale-95 transition-all">
                <UserPlus size={16} style={{ color: cor }} />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-700">Link de cadastro</p>
                  <p className="text-xs text-gray-400">Para novas clientes criarem conta</p>
                </div>
                {copiado === 'cadastro'
                  ? <Check size={16} className="text-green-500" />
                  : <Copy size={16} className="text-gray-400" />}
              </button>
              <button onClick={() => copiarLink('login')}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-dashed border-gray-200 active:scale-95 transition-all">
                <Users size={16} style={{ color: cor }} />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-700">Link de acesso</p>
                  <p className="text-xs text-gray-400">Para clientes que já têm conta entrar</p>
                </div>
                {copiado === 'login'
                  ? <Check size={16} className="text-green-500" />
                  : <Copy size={16} className="text-gray-400" />}
              </button>
            </div>

            {clientesFiltrados.length === 0 ? (
              <div className="card text-center py-10">
                <Users size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400">Nenhuma cliente encontrada</p>
              </div>
            ) : clientesFiltrados.map(c => (
              <button key={c.id}
                onClick={() => router.push('/salao/clientes/' + c.id)}
                className="card flex items-center gap-3 active:scale-95 transition-all text-left">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0 text-lg"
                  style={{ backgroundColor: cor }}>
                  {c.nome?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{c.nome}</p>
                  <p className="text-xs text-gray-400 truncate">{c.email}</p>
                  {c.data_nascimento && (
                    <p className="text-xs text-gray-400">
                      Nasc: {new Date(c.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </>
        )}

        {aba === 'pendentes' && (
          <>
            {pendentes.length === 0 ? (
              <div className="card text-center py-10">
                <CheckCircle size={36} className="text-green-300 mx-auto mb-2" />
                <p className="text-gray-400">Nenhuma cliente pendente</p>
              </div>
            ) : pendentes.map(c => (
              <div key={c.id} className="card flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: cor }}>
                    {c.nome?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{c.nome}</p>
                    <p className="text-xs text-gray-400 truncate">{c.email}</p>
                    {c.data_nascimento && (
                      <p className="text-xs text-gray-400">
                        Nasc: {new Date(c.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 font-medium shrink-0">
                    Pendente
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => rejeitarCliente(c)} disabled={aprovando === c.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium">
                    <XCircle size={15} />Recusar
                  </button>
                  <button onClick={() => aprovarCliente(c)} disabled={aprovando === c.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-sm font-medium"
                    style={{ backgroundColor: cor }}>
                    {aprovando === c.id
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><CheckCircle size={15} />Aprovar</>}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Modal QR Code */}
      {modalQR && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col items-center gap-4">
            <div className="flex items-center justify-between w-full">
              <h3 className="font-bold text-gray-900 text-lg">QR Code de cadastro</h3>
              <button onClick={() => setModalQR(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Imprima e deixe na recepção. A cliente aponta a câmera e já vai direto para o cadastro do seu salão.
            </p>
            <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl">
              <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
            </div>
            <p className="text-xs text-gray-400 text-center px-4">
              Aponte a câmera do celular para o QR Code para acessar o link de cadastro
            </p>
            <button onClick={() => copiarLink('cadastro')}
              className="w-full py-3 rounded-2xl text-white font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: cor }}>
              {copiado === 'cadastro' ? <><Check size={16} />Copiado!</> : <><Copy size={16} />Copiar link</>}
            </button>
          </div>
        </div>
      )}

      {/* Banner iOS - Instalar app */}
      {modalIOS && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">📲 Instalar aplicativo</h3>
              <button onClick={fecharBannerIOS}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Adicione o Organiza Salão à sua tela inicial para acessar mais rápido, como um app de verdade!
            </p>
            <div className="flex flex-col gap-3 bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                  <span className="text-sm">1️⃣</span>
                </div>
                <p className="text-sm text-gray-700">Toque no ícone <Share size={14} className="inline mb-0.5" /> de compartilhar na barra do Safari</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                  <span className="text-sm">2️⃣</span>
                </div>
                <p className="text-sm text-gray-700">Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                  <span className="text-sm">3️⃣</span>
                </div>
                <p className="text-sm text-gray-700">Toque em <strong>"Adicionar"</strong> no canto superior direito</p>
              </div>
            </div>
            <button onClick={fecharBannerIOS}
              className="w-full py-3 rounded-2xl text-white font-semibold"
              style={{ backgroundColor: cor }}>
              Entendi!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
