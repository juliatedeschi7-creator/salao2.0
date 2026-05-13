'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Scissors } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin() {
    setLoading(true)
    setErro('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    // Busca o perfil do usuário para saber o role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'admin_geral') {
      window.location.href = '/admin'
    } else if (profile?.role === 'dono_salao' || profile?.role === 'funcionario') {
      window.location.href = '/salao'
    } else {
      window.location.href = '/cliente'
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="w-20 h-20 rounded-full bg-pink-100 flex items-center justify-center mb-6">
        <Scissors className="text-[#E91E8C]" size={36} />
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-1">Organiza Salão</h1>
      <p className="text-gray-500 mb-8">Bem-vinda de volta ao seu espaço</p>

      {/* Formulário */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
          <input
            className="input-field"
            type="email"
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Senha</label>
          <div className="relative">
            <input
              className="input-field pr-12"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Digite sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setMostrarSenha(!mostrarSenha)}
            >
              {mostrarSenha ? '🙈' : '👁️'}
            </button>
          </div>
          <div className="text-right mt-1">
            <span className="text-[#E91E8C] text-sm font-medium">Esqueceu sua senha?</span>
          </div>
        </div>

        {erro && (
          <p className="text-red-500 text-sm text-center">{erro}</p>
        )}

        <button
          className="btn-primary mt-2"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-sm">ou</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <p className="text-center text-gray-600 text-sm">
          Não tem uma conta?{' '}
          <span className="text-[#E91E8C] font-semibold">Criar conta</span>
        </p>

        <button className="btn-secondary">
          🏪 Seja um salão parceiro
        </button>
      </div>
    </div>
  )
}
