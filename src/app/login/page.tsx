'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Scissors, Eye, EyeOff, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin() {
    if (!email || !senha) { setErro('Preencha email e senha.'); return }
    setLoading(true)
    setErro('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    if (error) {
      setErro('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, aprovado, ativo, salao_id')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      setErro('Perfil não encontrado.')
      setLoading(false)
      return
    }

    if (!profile.ativo) {
      await supabase.auth.signOut()
      setErro('Sua conta foi desativada. Entre em contato com o suporte.')
      setLoading(false)
      return
    }

    if (profile.role === 'admin_geral') {
      window.location.href = '/admin'
      return
    }

    if (!profile.aprovado) {
      await supabase.auth.signOut()
      setErro('Sua conta ainda aguarda aprovação do administrador.')
      setLoading(false)
      return
    }

    if (profile.role === 'dono_salao') {
      if (profile.salao_id) {
        const { data: salao } = await supabase
          .from('saloes')
          .select('pausado')
          .eq('id', profile.salao_id)
          .single()

        if (salao?.pausado) {
          await supabase.auth.signOut()
          setErro('Seu salão está pausado. Entre em contato com o administrador.')
          setLoading(false)
          return
        }
        window.location.href = '/salao'
      } else {
        window.location.href = '/criar-salao'
      }
      return
    }

    if (profile.role === 'funcionario') {
      window.location.href = '/funcionario'
      return
    }

    window.location.href = '/cliente'
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-20 h-20 rounded-full bg-pink-100 flex items-center justify-center mb-6">
        <Scissors className="text-[#E91E8C]" size={36} />
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-1">Organiza Salão</h1>
      <p className="text-gray-500 mb-8 text-center">Bem-vinda de volta ao seu espaço ✨</p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input-field pl-11"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Senha</label>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input-field pl-11 pr-12"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Digite sua senha"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setMostrarSenha(!mostrarSenha)}
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="text-right mt-1">
            <span className="text-[#E91E8C] text-sm font-medium cursor-pointer">
              Esqueceu sua senha?
            </span>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}

        <button
          className="btn-primary mt-2"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : 'Entrar'}
        </button>

        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-sm">ou</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <p className="text-center text-gray-600 text-sm">
          Não tem uma conta?{' '}
          <a href="/cadastro" className="text-[#E91E8C] font-semibold">Criar conta</a>
        </p>

        <a href="/cadastro?tipo=salao" className="btn-secondary">
          🏪 Seja um salão parceiro
        </a>
      </div>
    </div>
  )
}
