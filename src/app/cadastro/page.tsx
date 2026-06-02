'use client'
import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { Scissors, Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function CadastroForm() {
  const searchParams = useSearchParams()
  const tipo = searchParams.get('tipo')
  const token = searchParams.get('token')
  const salaoSlug = searchParams.get('salao')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const isCliente = !!salaoSlug
  const isSalao = tipo === 'salao' || !!token

  async function handleCadastro() {
    if (!nome || !email || !senha) { setErro('Preencha todos os campos.'); return }
    if (senha.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres.'); return }
    if (isCliente && !dataNascimento) { setErro('Informe sua data de nascimento.'); return }
    setLoading(true); setErro('')
    const role = isCliente ? 'cliente' : 'dono_salao'
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password: senha,
        options: { data: { nome: nome.trim(), role } }
      })
      if (error) {
        setErro(error.message.includes('already') ? 'Email ja cadastrado.' : 'Erro: ' + error.message)
        setLoading(false); return
      }
      if (!data.user) { setErro('Erro ao criar usuario.'); setLoading(false); return }
      await supabase.from('profiles').upsert({
        id: data.user.id, email: email.trim().toLowerCase(),
        nome: nome.trim(), role, aprovado: isCliente, ativo: true
      }, { onConflict: 'id' })
      if (isCliente && salaoSlug) {
        const { data: salao } = await supabase.from('saloes').select('id').eq('slug', salaoSlug).single()
        if (!salao) { setErro('Salao nao encontrado.'); setLoading(false); return }
        await supabase.from('clientes').insert({
          salao_id: salao.id, profile_id: data.user.id,
          nome: nome.trim(), email: email.trim().toLowerCase(),
          data_nascimento: dataNascimento || null
        })
        await supabase.from('profiles').update({ salao_id: salao.id, aprovado: true }).eq('id', data.user.id)
        window.location.href = '/cliente'; return
      }
      if (token) {
        const { data: convite } = await supabase.from('convites').select('*').eq('token', token).eq('usado', false).single()
        if (convite) {
          await supabase.from('profiles').update({ role: convite.role, salao_id: convite.salao_id }).eq('id', data.user.id)
          await supabase.from('convites').update({ usado: true }).eq('id', convite.id)
        }
        window.location.href = '/aguardando'; return
      }
      window.location.href = isSalao ? '/aguardando' : '/login'
    } catch (e: any) { setErro('Erro: ' + (e.message || 'Tente novamente.')) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-gray-900 px-6 pt-16 pb-12 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4">
          <Scissors size={30} className="text-gray-900" />
        </div>
        <h1 className="text-white text-2xl font-bold">
          {isCliente ? 'Criar sua conta' : 'Cadastrar Salao'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {isCliente ? 'Acesse os servicos do salao' : 'Comece a organizar seu espaco'}
        </p>
      </div>
      <div className="flex-1 px-6 py-8 flex flex-col gap-4 max-w-sm mx-auto w-full">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Nome completo</label>
          <div className="relative">
            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" placeholder="Seu nome completo"
              value={nome} onChange={e => setNome(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" type="email" placeholder="seuemail@exemplo.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        {isCliente && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Data de nascimento</label>
            <input className="input-field" type="date"
              value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} />
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Senha</label>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11 pr-12"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Minimo 6 caracteres"
              value={senha} onChange={e => setSenha(e.target.value)} />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setMostrarSenha(!mostrarSenha)}>
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}
        <button className="btn-primary mt-2" onClick={handleCadastro} disabled={loading}>
          {loading
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Criar conta'}
        </button>
        <p className="text-center text-gray-600 text-sm">
          Ja tem conta?{' '}
          <a href="/login" className="text-gray-900 font-bold underline">Entrar</a>
        </p>
      </div>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CadastroForm />
    </Suspense>
  )
}