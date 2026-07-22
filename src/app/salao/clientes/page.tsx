'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Users, Search, Plus, ArrowLeft, Phone, Mail, 
  Calendar, CheckCircle2, XCircle, AlertTriangle, 
  X, Merge, ChevronRight, UserCheck
} from 'lucide-react'

function ClientesContent() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mesclarParam = searchParams.get('mesclar')

  // Estados de Dados
  const [clientes, setClientes] = useState<any[]>([])
  const [pendentes, setPendentes] = useState<any[]>([])
  const [carregandoDados, setCarregandoDados] = useState(true)

  // Estados de Interface
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<'ativos' | 'pendentes'>('ativos')

  // Estados de Mesclagem
  const [modalMesclarAberto, setModalMesclarAberto] = useState(false)
  const [clienteOrigem, setClienteOrigem] = useState<any | null>(null)
  const [clienteDestinoId, setClienteDestinoId] = useState<string>('')
  const [mesclando, setMesclando] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) {
      router.push('/login')
      return
    }
    if (profile.salao_id) {
      carregarDados()
    }
  }, [loading, profile])

  async function carregarDados() {
    setCarregandoDados(true)
    try {
      const { data: clis, error } = await supabase
        .from('clientes')
        .select('*, profiles!clientes_profile_id_fkey(aprovado, ativo, role)')
        .eq('salao_id', profile!.salao_id)
        .order('nome')

      if (error) throw error

      const listaCompleta = clis || []
      const ativos = listaCompleta.filter((c: any) => c.profiles?.aprovado !== false)
      const pends = listaCompleta.filter((c: any) => c.profiles?.aprovado === false && c.profile_id)

      setClientes(ativos)
      setPendentes(pends)

      // Se veio parâmetro de mesclagem na URL (?mesclar=ID)
      if (mesclarParam) {
        const origem = listaCompleta.find((c: any) => c.id === mesclarParam)
        if (origem) {
          abrirModalMesclagem(origem, listaCompleta)
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar clientes:', err)
    } finally {
      setCarregandoDados(false)
    }
  }

  function abrirModalMesclagem(origem: any, listaCompleta = clientes) {
    setClienteOrigem(origem)

    // Tenta encontrar um candidato principal correspondente pelo mesmo e-mail ou nome
    const candidato = listaCompleta.find(
      c => c.id !== origem.id && 
      ((c.email && origem.email && c.email.toLowerCase() === origem.email.toLowerCase()) ||
       c.nome.toLowerCase() === origem.nome.toLowerCase())
    )

    if (candidato) {
      setClienteDestinoId(candidato.id)
    } else {
      const primeiroOutro = listaCompleta.find(c => c.id !== origem.id)
      setClienteDestinoId(primeiroOutro ? primeiroOutro.id : '')
    }

    setModalMesclarAberto(true)
  }

  async function executarMesclagem() {
    if (!clienteOrigem || !clienteDestinoId) return
    setMesclando(true)

    try {
      const { error } = await supabase.rpc('mesclar_clientes', {
        id_origem: clienteOrigem.id,
        id_destino: clienteDestinoId
      })

      if (error) throw error

      alert('Cadastros mesclados com sucesso!')
      setModalMesclarAberto(false)
      setClienteOrigem(null)
      
      // Limpa parâmetro de URL e recarrega
      router.replace('/salao/clientes')
      carregarDados()
    } catch (err: any) {
      alert('Erro ao mesclar clientes: ' + err.message)
    } finally {
      setMesclando(false)
    }
  }

  // Filtragem de Busca
  const listaExibida = aba === 'ativos' ? clientes : pendentes
  const clientesFiltrados = listaExibida.filter(c => {
    const termo = busca.toLowerCase()
    return (
      c.nome?.toLowerCase().includes(termo) ||
      c.email?.toLowerCase().includes(termo) ||
      c.telefone?.includes(termo)
    )
  })

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* Topbar */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-lg">Clientes</h1>
        </div>
        <button
          onClick={() => router.push('/salao/clientes/novo')}
          className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Campo de Busca */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        {/* Abas */}
        <div className="flex gap-2">
          <button
            onClick={() => setAba('ativos')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              aba === 'ativos' ? 'bg-pink-500 text-white shadow-sm' : 'bg-white text-gray-500'
            }`}
          >
            <Users size={16} />
            Ativos {carregandoDados ? '' : `(${clientes.length})`}
          </button>
          {pendentes.length > 0 && (
            <button
              onClick={() => setAba('pendentes')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                aba === 'pendentes' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-gray-500'
              }`}
            >
              <UserCheck size={16} />
              Pendentes ({pendentes.length})
            </button>
          )}
        </div>

        {/* Lista / Carregamento */}
        {carregandoDados ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <Users size={40} className="text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">Nenhum cliente encontrado</p>
            <p className="text-xs text-gray-400 mt-1">Tente ajustar a busca ou adicione um novo cadastro.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {clientesFiltrados.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`/salao/clientes/${c.id}`)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-pink-100 text-pink-600 font-bold flex items-center justify-center text-base shrink-0">
                    {c.nome?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{c.nome}</p>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {c.email && (
                        <span className="text-xs text-gray-400 flex items-center gap-1 truncate">
                          <Mail size={12} /> {c.email}
                        </span>
                      )}
                      {c.telefone && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone size={12} /> {c.telefone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Mesclagem */}
      {modalMesclarAberto && clienteOrigem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-pink-600 font-bold">
                <Merge size={20} />
                <h3>Mesclar Cadastros Duplicados</h3>
              </div>
              <button onClick={() => setModalMesclarAberto(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Foi identificado um possível cadastro duplicado. Escolha qual perfil será o <b>principal</b> (mantido) e as informações e histórico do perfil duplicado serão transferidos automaticamente.
            </p>

            {/* Perfil Duplicado (Sera Removido) */}
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block mb-1">
                ❌ Cadastro Duplicado (Será removido)
              </span>
              <p className="font-bold text-gray-900 text-sm">{clienteOrigem.nome}</p>
              <p className="text-xs text-gray-500">{clienteOrigem.email || 'Sem e-mail registrado'}</p>
            </div>

            {/* Perfil Principal (Sera Mantido) */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-2">
                ✅ Cadastro Principal (Manterá todos os dados)
              </span>
              <select
                value={clienteDestinoId}
                onChange={e => setClienteDestinoId(e.target.value)}
                className="w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" disabled>Selecione o perfil principal...</option>
                {clientes
                  .filter(c => c.id !== clienteOrigem.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Ações do Modal */}
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setModalMesclarAberto(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 font-semibold rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!clienteDestinoId || mesclando}
                onClick={executarMesclagem}
                className="flex-1 py-3 bg-pink-500 text-white font-semibold rounded-xl text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {mesclando ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Confirmar Mesclagem'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClientesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ClientesContent />
    </Suspense>
  )
}
