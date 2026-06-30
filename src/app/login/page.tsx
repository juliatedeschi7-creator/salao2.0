'use client'
import { useState, Suspense, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const searchParams = useSearchParams()
  const salaoSlug = searchParams.get('salao')
  const [salaoInfo, setSalaoInfo] = useState<any>(null)
  const [carregando, setCarregando] = useState(!!salaoSlug)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function buscarSalao() {
      if (!salaoSlug) { setCarregando(false); return }
      const { data } = await supabase.from('saloes')
        .select('nome, cor_primaria, cor_secundaria')
        .eq('slug', salaoSlug)
        .maybeSingle()
      if (data) setSalaoInfo(data)
      setCarregando(false)
    }
    buscarSalao()
  }, [salaoSlug])

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
      .select('role, aprovado, ativo, salao_id, nivel_acesso')
      .eq('id', data.user.id)
      .single()

    if (!prof) { setErro('Perfil nao encontrado.'); setLoading(false); return }
    if (!prof.ativo) { await supabase.auth.signOut(); setErro('Conta desativada.'); setLoading(false); return }

    // funcionario com nivel_acesso 'total' (socio/co-criador/familiar) é tratado
    // igual ao dono_salao para fins de acesso ao sistema
    const acessoTotal = prof.role === 'dono_salao' ||
      (prof.role === 'funcionario' && prof.nivel_acesso === 'total')

    let destino = '/login'
    if (prof.role === 'admin_geral') {
      destino = '/admin'
    } else if (!prof.aprovado) {
      if (prof.role === 'dono_salao' || prof.role === 'funcionario') destino = '/aguardando'
      else { await supabase.auth.signOut(); setErro('Conta aguarda aprovacao.'); setLoading(false); return }
    } else if (acessoTotal) {
      if (!prof.salao_id) {
        destino = '/criar-salao'
      } else {
        const { data: salao } = await supabase.from('saloes').select('pausado, aprovado').eq('id', prof.salao_id).single()
        if (salao?.pausado) { await supabase.auth.signOut(); setErro('Salão pausado.'); setLoading(false); return }
        destino = !salao?.aprovado ? '/aguardando' : '/salao'
      }
    } else if (prof.role === 'funcionario') {
      // funcionario com acesso restrito
      destino = '/funcionario'
    } else {
      destino = '/cliente'
    }

    await new Promise(resolve => setTimeout(resolve, 500))
    window.location.href = destino
  }

  const isCliente = !!salaoSlug
  const cor = (isCliente && salaoInfo?.cor_primaria) ? salaoInfo.cor_primaria : '#111827'
  const corSec = (isCliente && salaoInfo?.cor_secundaria) ? salaoInfo.cor_secundaria : '#f3f4f6'

  function getNomeParte1() {
    if (!salaoInfo?.nome) return 'Entrar'
    return salaoInfo.nome.includes(' - ') ? salaoInfo.nome.split(' - ')[0] : salaoInfo.nome
  }

  function getNomeParte2() {
    if (!salaoInfo?.nome) return null
    return salaoInfo.nome.includes(' - ') ? salaoInfo.nome.split(' - ')[1] : null
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6 py-10"
      style={{
        background: isCliente
          ? `linear-gradient(to bottom, ${corSec} 0%, #ffffff 340px)`
          : '#ffffff'
      }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-1 mb-8 mt-8">
        {isCliente ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: cor }}>
              {getNomeParte1()}
            </h1>
            {getNomeParte2() && (
              <p className="text-sm font-medium mt-1 text-gray-400">
                {getNomeParte2()}
              </p>
            )}
            <p className="text-gray-400 text-sm mt-3 text-center">
              Entre na sua conta para continuar
            </p>
          </div>
    ) : (
  <div className="flex flex-col items-center text-center">
    <div className="w-20 h-20 mb-4">
      <img src="/logo.png" alt="Organiza Salão" className="w-full h-full object-contain" />
    </div>
    <h1 className="text-2xl font-bold text-gray-900">Organiza Salão</h1>
    <p className="text-gray-400 text-sm mt-1 text-center">
      Toda a gestão do seu espaço na palma da mão.
    </p>
  </div>
)}
      </div>
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">Email</label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none transition-colors placeholder-gray-400"
            type="email"
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">Senha</label>
          <div className="relative">
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 pr-12 text-base outline-none transition-colors placeholder-gray-400"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Digite sua senha"
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
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}

        <button
          className="w-full text-white rounded-2xl py-4 font-semibold text-base flex items-center justify-center active:scale-95 transition-all mt-1"
          style={{ backgroundColor: cor }}
          onClick={handleLogin}
          disabled={loading}>
          {loading
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Entrar'}
        </button>

        {!isCliente && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-sm">ou</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <p className="text-center text-gray-500 text-sm">
              Não tem conta?{' '}
              <a href="/cadastro" className="text-gray-900 font-bold">Criar conta</a>
            </p>

            <a href="/cadastro?tipo=salao"
              className="w-full border-2 border-gray-900 text-gray-900 rounded-2xl py-4 font-semibold text-base flex items-center justify-center active:scale-95 transition-all">
              Cadastrar meu salão
            </a>
          </>
        )}

        {isCliente && (
          <p className="text-center text-gray-500 text-sm">
            Não tem conta?{' '}
            <a href={'/cadastro?salao=' + salaoSlug} className="font-bold" style={{ color: cor }}>Criar conta</a>
          </p>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}