'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { temAcessoTotal } from '@/lib/permissoes'
import { notificar } from '@/lib/notificar'
import { ArrowLeft, Search, Plus, User, Phone, ChevronRight, MessageSquare } from 'lucide-react'

export default function ClientesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  // Modal Novo Cliente
  const [modalAberto, setModalAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [aniversario, setAniversario] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) { router.push('/login'); return }
    if (profile.salao_id) {
      carregarDados()
    }
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    const { data: sal } = await supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single()
    setSalao(sal)

    const { data: cls } = await supabase.from('clientes')
      .select('*')
      .eq('salao_id', profile!.salao_id!)
      .order('nome', { ascending: true })
    
    setClientes(cls || [])
    setCarregando(false)
  }

  async function cadastrarCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      notificar({
        salaoId: profile!.salao_id!,
        remetenteId: profile!.id,
        destinatarioId: profile!.id,
        titulo: 'Atenção',
        mensagem: 'O nome do cliente é obrigatório.',
        tipo: 'sistema'
      })
      return
    }

    setSalvando(true)
    const { error } = await supabase.from('clientes').insert({
      salao_id: profile!.salao_id,
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      aniversario: aniversario || null,
      observacoes: observacoes.trim() || null
    })

    if (error) {
      console.error(error)
      notificar({
        salaoId: profile!.salao_id!,
        remetenteId: profile!.id,
        destinatarioId: profile!.id,
        titulo: 'Erro',
        mensagem: 'Não foi possível cadastrar o cliente.',
        tipo: 'sistema'
      })
    } else {
      setModalAberto(false)
      setNome('')
      setTelefone('')
      setEmail('')
      setAniversario('')
      setObservacoes('')
      carregarDados()
    }
    setSalvando(false)
  }

  const clientesFiltrados = clientes.filter(c => 
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  )

  const cor = salao?.cor_primaria || '#E91E8C'

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* Cabeçalho */}
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg">Clientes</h1>
        </div>
        {/* BOTÃO RESTAURADO PARA CADASTRAR/INCLUIR CLIENTE */}
        <button 
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Barra de Pesquisa */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou telefone..." 
            className="input-field pl-10 text-sm bg-white"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* Lista de Clientes */}
        {carregando ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="card text-center py-12">
            <User size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {clientesFiltrados.map(cliente => (
              <div 
                key={cliente.id} 
                onClick={() => router.push(`/clientes/${cliente.id}`)}
                className="card bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-gray-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center font-bold text-white text-sm justify-center shrink-0" style={{ backgroundColor: cor }}>
                    {cliente.nome?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{cliente.nome}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Phone size={12} /> {cliente.telefone || 'Sem telefone'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cliente.telefone && (
                    <a 
                      href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                      <MessageSquare size={14} />
                    </a>
                  )}
                  <ChevronRight size={18} className="text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para Adicionar Novo Cliente */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Cadastrar Novo Cliente</h3>
              <button onClick={() => setModalAberto(false)}><span className="text-gray-400 text-xl font-bold">×</span></button>
            </div>

            <form onSubmit={cadastrarCliente} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome completo *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Maria Silva" 
                  className="input-field text-sm"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  placeholder="Ex: (11) 99999-9999" 
                  className="input-field text-sm"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">E-mail</label>
                <input 
                  type="email" 
                  placeholder="Ex: maria@email.com" 
                  className="input-field text-sm"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Data de Aniversário</label>
                <input 
                  type="date" 
                  className="input-field text-sm"
                  value={aniversario}
                  onChange={e => setAniversario(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
                <textarea 
                  placeholder="Preferências, alagias, anotações..." 
                  className="input-field text-sm h-20 resize-none"
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button 
                  type="button" 
                  onClick={() => setModalAberto(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={salvando}
                  className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: cor }}>
                  {salvando ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
