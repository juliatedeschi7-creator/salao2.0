'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Plus, Edit2, Trash2, Search, GitMerge, 
  AlertTriangle, X, Check, User, Phone, Mail 
} from 'lucide-react'

export default function ClientesPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [salao, setSalao] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [duplicados, setDuplicados] = useState<any[][]>([])
  const [termoBusca, setTermoBusca] = useState('')
  
  // Modais
  const [modal, setModal] = useState(false)
  const [modalMesclar, setModalMesclar] = useState<any[] | null>(null)
  const [manterId, setManterId] = useState<string>('')
  
  // Edição e Form
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    observacoes: ''
  })
  
  const [salvando, setSalvando] = useState(false)
  const [mesclando, setMesclando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // Válvula de segurança para não travar no login se o auth demorar
    const timer = setTimeout(() => {
      if (loading) setCarregando(false)
    }, 3000)

    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    // Verificação de permissão individual para a página de 'clientes'
    if (profile.permissoes_paginas && profile.permissoes_paginas['clientes'] === false) {
      alert('Você não tem permissão para acessar a página de Clientes.')
      router.push('/salao')
      return
    }

    if (profile.salao_id) {
      carregarDados()
    } else {
      setCarregando(false)
    }

    return () => clearTimeout(timer)
  }, [loading, profile])

  async function carregarDados() {
    setCarregando(true)
    try {
      const [salRes, cliRes] = await Promise.all([
        supabase.from('saloes').select('*').eq('id', profile!.salao_id!).single(),
        supabase.from('clientes').select('*').eq('salao_id', profile!.salao_id!).order('nome', { ascending: true })
      ])

      setSalao(salRes.data)
      const listaClientes = cliRes.data || []
      setClientes(listaClientes)
      detectarDuplicadosPorNome(listaClientes)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setCarregando(false)
    }
  }

  function detectarDuplicadosPorNome(lista: any[]) {
    const mapaNomes: Record<string, any[]> = {}

    lista.forEach(cliente => {
      if (!cliente.nome) return
      const nomeNormalizado = cliente.nome.trim().toLowerCase().replace(/\s+/g, ' ')

      if (!mapaNomes[nomeNormalizado]) {
        mapaNomes[nomeNormalizado] = []
      }
      mapaNomes[nomeNormalizado].push(cliente)
    })

    const gruposDuplicados = Object.values(mapaNomes).filter(grupo => grupo.length >= 2)
    setDuplicados(gruposDuplicados)
  }

  async function executarMesclagem() {
    if (!modalMesclar || !manterId) return
    setMesclando(true)

    const idsDescartados = modalMesclar.map(c => c.id).filter(id => id !== manterId)

    try {
      for (const idDescartado of idsDescartados) {
        await supabase.from('agendamentos').update({ cliente_id: manterId }).eq('cliente_id', idDescartado)
        await supabase.from('pacotes_cliente').update({ cliente_id: manterId }).eq('cliente_id', idDescartado)
        await supabase.from('fichas_anamnese').update({ cliente_id: manterId }).eq('cliente_id', idDescartado)
        await supabase.from('clientes').delete().eq('id', idDescartado)
      }

      setModalMesclar(null)
      carregarDados()
    } catch (err: any) {
      alert('Erro ao mesclar contatos: ' + (err.message || 'Tente novamente.'))
    } finally {
      setMesclando(false)
    }
  }

  function abrirModal(c?: any) {
    setErroSalvar('')
    if (c) {
      setEditando(c)
      setForm({
        nome: c.nome || '',
        telefone: c.telefone || '',
        email: c.email || '',
        observacoes: c.observacoes || ''
      })
    } else {
      setEditando(null)
      setForm({ nome: '', telefone: '', email: '', observacoes: '' })
    }
    setModal(true)
  }

  async function handleSalvar() {
    setErroSalvar('')
    if (!form.nome.trim()) {
      setErroSalvar('Digite ao menos o nome do cliente.')
      return
    }

    setSalvando(true)
    const dados = {
      salao_id: profile!.salao_id,
      nome: form.nome.trim(),
      telefone: form.telefone ? form.telefone.trim() : null,
      email: form.email ? form.email.trim() : null,
      observacoes: form.observacoes ? form.observacoes.trim() : null
    }

    let res
    if (editando) {
      res = await supabase.from('clientes').update(dados).eq('id', editando.id)
    } else {
      res = await supabase.from('clientes').insert(dados)
    }

    if (res.error) {
      setErroSalvar('Erro: ' + res.error.message)
      setSalvando(false)
      return
    }

    setModal(false)
    setSalvando(false)
    carregarDados()
  }

  async function excluirCliente(id: string) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    carregarDados()
  }

  const cor = salao?.cor_primaria || '#E91E8C'

  const clientesFiltrados = clientes.filter(c => {
    const termo = termoBusca.toLowerCase()
    return (
      c.nome?.toLowerCase().includes(termo) ||
      c.telefone?.includes(termo)
    )
  })

  if (loading || carregando) {
    return (
      <div className="min-h-screen pb-8 bg-[#f8f9fa]">
        <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <button onClick={() => router.back()}><ArrowLeft size={22} className="text-gray-700" /></button>
          <h1 className="font-bold text-gray-900 text-lg flex-1">Clientes</h1>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse flex flex-col gap-2">
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-8 bg-[#f8f9fa]">
      {/* HEADER DA PÁGINA */}
      <div className="bg-white px-4 py-4 flex items-center gap-2 shadow-sm sticky top-0 z-10">
        <button onClick={() => router.push('/salao')}>
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg flex-1 truncate">Clientes</h1>
        
        <button 
          onClick={() => abrirModal()}
          title="Novo cliente"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm"
          style={{ backgroundColor: cor }}>
          <Plus size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* BARRA DE BUSCA */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-3 text-gray-400" />
          <input 
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={termoBusca}
            onChange={e => setTermoBusca(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none shadow-sm focus:border-pink-500"
          />
        </div>

        {/* PAINEL DE ALERTA PARA NOMES DUPLICADOS */}
        {duplicados.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{duplicados.length} nome(s) com cadastro duplicado encontrado(s)</span>
            </div>

            <div className="flex flex-col gap-2">
              {duplicados.map((grupo, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between gap-2">
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-gray-800 truncate">{grupo[0].nome}</p>
                    <p className="text-[11px] text-gray-500">{grupo.length} cadastros com este nome</p>
                  </div>
                  <button 
                    onClick={() => {
                      setModalMesclar(grupo)
                      setManterId(grupo[0].id)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold shrink-0"
                    style={{ backgroundColor: cor }}>
                    <GitMerge size={14} /> Mesclar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LISTA DE CLIENTES */}
        {clientesFiltrados.length === 0 ? (
          <div className="bg-white text-center py-10 rounded-2xl border border-gray-100 shadow-sm">
            <User size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-400 text-sm">Nenhum cliente encontrado</p>
            <button 
              onClick={() => abrirModal()} 
              className="mt-3 px-4 py-2 rounded-full text-sm font-medium text-white shadow-sm" 
              style={{ backgroundColor: cor }}>
              + Cadastrar cliente
            </button>
          </div>
        ) : (
          clientesFiltrados.map(c => (
            <div key={c.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex-1 overflow-hidden">
                <p className="font-bold text-gray-900 text-sm truncate">{c.nome}</p>
                
                <div className="flex flex-col gap-0.5 mt-1">
                  {c.telefone && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone size={12} className="text-gray-400" /> {c.telefone}
                    </p>
                  )}
                  {c.email && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                      <Mail size={12} className="text-gray-400" /> {c.email}
                    </p>
                  )}
                  {c.observacoes && (
                    <p className="text-xs text-gray-400 italic mt-1 truncate">
                      "{c.observacoes}"
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={() => abrirModal(c)} 
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Edit2 size={14} className="text-gray-600" />
                </button>
                <button 
                  onClick={() => excluirCliente(c.id)} 
                  className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE MESCLAGEM */}
      {modalMesclar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <GitMerge size={18} style={{ color: cor }} /> Mesclar Cadastros Repetidos
              </h3>
              <button onClick={() => setModalMesclar(null)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Encontramos <strong>{modalMesclar.length} cadastros</strong> com o nome <strong>"{modalMesclar[0]?.nome}"</strong>. Escolha qual perfil continuará ativo:
            </p>

            <div className="flex flex-col gap-2">
              {modalMesclar.map(c => (
                <label 
                  key={c.id} 
                  onClick={() => setManterId(c.id)}
                  className={`border p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                    manterId === c.id ? 'border-2 bg-pink-50/50' : 'border-gray-200'
                  }`}
                  style={{ borderColor: manterId === c.id ? cor : undefined }}>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-gray-900">{c.nome}</p>
                    <p className="text-xs text-gray-500">
                      {c.telefone || 'Sem telefone'} • {c.email || 'Sem e-mail'}
                    </p>
                  </div>
                  <input 
                    type="radio" 
                    name="manterCliente" 
                    checked={manterId === c.id} 
                    onChange={() => setManterId(c.id)}
                    className="w-4 h-4"
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button 
                onClick={() => setModalMesclar(null)} 
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium">
                Cancelar
              </button>
              <button 
                onClick={executarMesclagem} 
                disabled={mesclando}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-medium shadow-sm" 
                style={{ backgroundColor: cor }}>
                {mesclando ? 'Mesclando...' : 'Confirmar e Unir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO / EDITAR CLIENTE */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">
                {editando ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button onClick={() => setModal(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {erroSalvar && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                <p className="text-red-600 text-xs">{erroSalvar}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do cliente *</label>
              <input 
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500" 
                placeholder="Ex: Maria Silva"
                value={form.nome} 
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} 
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Telefone (opcional)</label>
              <input 
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500" 
                placeholder="(16) 99999-9999"
                value={form.telefone} 
                onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} 
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">E-mail (opcional)</label>
              <input 
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500" 
                placeholder="cliente@email.com"
                value={form.email} 
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} 
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Observações (opcional)</label>
              <textarea 
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none focus:border-pink-500" 
                rows={2}
                placeholder="Preferências, alergias, restrições..."
                value={form.observacoes} 
                onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} 
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setModal(false)} 
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm">
                Cancelar
              </button>
              <button 
                onClick={handleSalvar} 
                disabled={salvando} 
                className="flex-1 py-3 rounded-2xl text-white font-medium text-sm shadow-sm" 
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
