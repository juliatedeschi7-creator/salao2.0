'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin() {
    if (!email || !senha) { setErro('Preencha email e senha.'); return }
    setLoading(true); setErro('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password: senha
    })

    if (error) { setErro('Email ou senha incorretos.'); setLoading(false); return }
    if (!data.session) { setErro('Erro ao iniciar sessao.'); setLoading(false); return }

    const { data: prof } = await supabase
      .from('profiles')
      .select('role, aprovado, ativo, salao_id')
      .eq('id', data.user.id)
      .single()

    if (!prof) { setErro('Perfil nao encontrado.'); setLoading(false); return }
    if (!prof.ativo) { await supabase.auth.signOut(); setErro('Conta desativada.'); setLoading(false); return }

    let destino = '/login'
    if (prof.role === 'admin_geral') {
      destino = '/admin'
    } else if (!prof.aprovado) {
      if (prof.role === 'dono_salao' || prof.role === 'funcionario') destino = '/aguardando'
      else { await supabase.auth.signOut(); setErro('Conta aguarda aprovacao.'); setLoading(false); return }
    } else if (prof.role === 'dono_salao') {
      if (!prof.salao_id) {
        destino = '/criar-salao'
      } else {
        const { data: salao } = await supabase.from('saloes').select('pausado, aprovado').eq('id', prof.salao_id).single()
        if (salao?.pausado) { await supabase.auth.signOut(); setErro('Salão pausado.'); setLoading(false); return }
        destino = !salao?.aprovado ? '/aguardando' : '/salao'
      }
    } else if (prof.role === 'funcionario') {
      destino = '/funcionario'
    } else {
      destino = '/cliente'
    }

    await new Promise(resolve => setTimeout(resolve, 500))
    window.location.href = destino
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center gap-2 mb-8">
        <div className="w-24 h-24 mb-2">
          <img src="/logo.png" alt="Organiza Salão" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Organiza</h1>
        <p className="text-gray-400 text-sm text-center">Toda a gestao do seu espaco na palma da mao.</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none focus:border-gray-900 transition-colors placeholder-gray-400"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        <div className="relative">
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 pr-12 text-base outline-none focus:border-gray-900 transition-colors placeholder-gray-400"
            type={mostrarSenha ? 'text' : 'password'}
            placeholder="Senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            onClick={() => setMostrarSenha(!mostrarSenha)}>
            {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}

        <button
          className="w-full bg-gray-900 text-white rounded-2xl py-4 font-semibold text-base flex items-center justify-center active:scale-95 transition-all"
          onClick={handleLogin}
          disabled={loading}>
          {loading
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Entrar'}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-sm">ou</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <p className="text-center text-gray-500 text-sm">
          Nao tem conta?{' '}
          <a href="/cadastro" className="text-gray-900 font-bold">Criar conta</a>
        </p>

        <a href="/cadastro?tipo=salao"
          className="w-full border-2 border-gray-900 text-gray-900 rounded-2xl py-4 font-semibold text-base flex items-center justify-center active:scale-95 transition-all">
          Cadastrar meu salao
        </a>
      </div>
    </div>
  )
}
