'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Mail, Lock, Scissors } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  async function handleLogin() {
    if (!email || !senha) { setErro('Preencha email e senha.'); return }
    setLoading(true); setErro('')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password: senha
    })
    if (error) { setErro('Email ou senha incorretos.'); setLoading(false); return }
    if (!data.session) { setErro('Erro ao iniciar sessao.'); setLoading(false); return }
    const { data: prof } = await supabase
      .from('profiles').select('role, aprovado, ativo, salao_id').eq('id', data.user.id).single()
    if (!prof) { setErro('Perfil nao encontrado.'); setLoading(false); return }
    if (!prof.ativo) { await supabase.auth.signOut(); setErro('Conta desativada.'); setLoading(false); return }
    if (prof.role === 'admin_geral') { router.replace('/admin'); return }
    if (!prof.aprovado) {
      if (prof.role === 'dono_salao' || prof.role === 'funcionario') { router.replace('/aguardando'); return }
      await supabase.auth.signOut(); setErro('Conta aguarda aprovacao.'); setLoading(false); return
    }
    if (prof.role === 'dono_salao') {
      if (!prof.salao_id) { router.replace('/criar-salao'); return }
      const { data: salao } = await supabase.from('saloes').select('pausado, aprovado').eq('id', prof.salao_id).single()
      if (salao?.pausado) { await supabase.auth.signOut(); setErro('Salao pausado.'); setLoading(false); return }
      if (!salao?.aprovado) { router.replace('/aguardando'); return }
      router.replace('/salao'); return
    }
    if (prof.role === 'funcionario') { router.replace('/funcionario'); return }
    router.replace('/cliente')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-gray-900 px-6 pt-16 pb-12 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4">
          <Scissors size={30} className="text-gray-900" />
        </div>
        <h1 className="text-white text-2xl font-bold">Organiza Salao</h1>
        <p className="text-gray-400 text-sm mt-1">Bem-vinda de volta</p>
      </div>
      <div className="flex-1 px-6 py-8 flex flex-col gap-4 max-w-sm mx-auto w-full">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11" type="email" placeholder="seuemail@exemplo.com"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Senha</label>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-11 pr-12" type={mostrarSenha ? 'text' : 'password'} placeholder="Digite sua senha"
              value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setMostrarSenha(!mostrarSenha)}>
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}
        <button className="btn-primary mt-2" onClick={handleLogin} disabled={loading}>
          {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Entrar'}
        </button>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-sm">ou</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <p className="text-center text-gray-600 text-sm">
          Nao tem conta? <a href="/cadastro" className="text-gray-900 font-bold underline">Criar conta</a>
        </p>
        <a href="/cadastro?tipo=salao" className="btn-secondary text-center">Seja um salao parceiro</a>
      </div>
    </div>
  )
}
