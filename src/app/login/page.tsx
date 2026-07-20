'use client'
import { useState, Suspense, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Bell, KeyRound } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { registrarPush } from '@/lib/push-client'

function LoginForm() {
  const searchParams = useSearchParams()
  const salaoSlug = searchParams.get('salao')
  const [salaoInfo, setSalaoInfo] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [lembrarEReceber, setLembrarEReceber] = useState(true)

  // Estados para o modal de "Esqueci a senha"
  const [modalEsqueci, setModalEsqueci] = useState(false)
  const [loadingEsqueci, setLoadingEsqueci] = useState(false)
  const [erroEsqueci, setErroEsqueci] = useState('')
  const [sucessoEsqueci, setSucessoEsqueci] = useState('')

  useEffect(() => {
    async function carregarIdentidade() {
      // 1. Pega o slug da URL ou busca no localStorage do celular
      const slugSalvo = typeof window !== 'undefined' ? localStorage.getItem('ultimo_salao_slug') : null
      const slugEfetivo = salaoSlug || slugSalvo

      // 2. Se veio slug na URL, salva no localStorage para acessos futuros
      if (salaoSlug && typeof window !== 'undefined') {
        localStorage.setItem('ultimo_salao_slug', salaoSlug)
      }

      // 3. Se não encontrou nenhum salão, encerra o carregamento no modo "Organiza Salão"
      if (!slugEfetivo) {
        setCarregando(false)
        return
      }

      // 4. Busca os dados do salão no Supabase
      const { data } = await supabase
        .from('saloes')
        .select('nome, cor_primaria, cor_secundaria, slug')
        .eq('slug', slugEfetivo)
        .maybeSingle()

      if (data) {
        setSalaoInfo(data)
        if (typeof window !== 'undefined') {
          localStorage.setItem('ultimo_salao_slug', data.slug)
        }
      }
      setCarregando(false)
    }

    carregarIdentidade()
  }, [salaoSlug])

  async function handleLogin() {
    if (!email || !senha) { setErro('Preencha email e senha.'); return }
    setLoading(true); setErro('')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password: senha
    })
    if (error) { setErro('Email ou senha incorretos.'); setLoading(false); return }
    if (!data.session) { setErro('Erro ao iniciar sessão.'); setLoading(false); return }
    const { data: prof } = await supabase.from('profiles')
      .select('role, aprovado, ativo, salao_id, acesso_total').eq('id', data.user.id).single()
    if (!prof) { setErro('Perfil não encontrado.'); setLoading(false); return }
    if (!prof.ativo) { await supabase.auth.signOut(); setErro('Conta desativada.'); setLoading(false); return }
    const acessoTotal = prof.role === 'dono_salao' || (prof.role === 'funcionario' && prof.acesso_total === true)
    let destino = '/login'
    if (prof.role === 'admin_geral') destino = '/admin'
    else if (!prof.aprovado) {
      if (prof.role === 'dono_salao' || prof.role === 'funcionario') destino = '/aguardando'
      else { await supabase.auth.signOut(); setErro('Conta aguarda aprovação.'); setLoading(false); return }
    } else if (acessoTotal) {
      if (!prof.salao_id) destino = '/criar-salao'
      else {
        const { data: salao } = await supabase.from('saloes').select('pausado, aprovado').eq('id', prof.salao_id).single()
        if (salao?.pausado) { await supabase.auth.signOut(); setErro('Salão pausado.'); setLoading(false); return }
        destino = !salao?.aprovado ? '/aguardando' : '/salao'
      }
    } else if (prof.role === 'funcionario') destino = '/funcionario'
    else destino = '/cliente'

    if (lembrarEReceber) {
      registrarPush(data.user.id).catch(() => {})
    }

    await new Promise(resolve => setTimeout(resolve, 500))
    window.location.href = destino
  }

  async function handleEsqueciSenha() {
    if (!email) {
      setErroEsqueci('Digite seu e-mail no campo acima ou informe abaixo para receber o link.')
      return
    }
    setLoadingEsqueci(true)
    setErroEsqueci('')
    setSucessoEsqueci('')

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://organiza-salao.xyz'

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${origin}/redefinir-senha`,
    })

    setLoadingEsqueci(false)

    if (error) {
      setErroEsqueci('Erro ao enviar e-mail: ' + error.message)
    } else {
      setSucessoEsqueci('✅ E-mail enviado com sucesso! Verifique sua caixa de entrada e o spam.')
    }
  }

  const isCliente = !!salaoInfo || !!salaoSlug
  const cor = (isCliente && salaoInfo?.cor_primaria) ? salaoInfo.cor_primaria : '#111827'
  const corSec = (isCliente && salaoInfo?.cor_secundaria) ? salaoInfo.cor_secundaria : '#f3f4f6'
  const partes = salaoInfo?.nome?.split(' - ')
  const nomePrincipal = partes?.[0]
  const nomeSecundario = partes?.[1]
  const slugCadastro = salaoInfo?.slug || salaoSlug

  if (carregando) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <>
      {isCliente && <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet" />}
      <div className="min-h-screen flex flex-col items-center px-6 py-10"
        style={{ background: isCliente ? `linear-gradient(to bottom, ${corSec} 0%, #ffffff 340px)` : '#ffffff' }}>

        <div className="w-full max-w-sm flex flex-col items-center gap-1 mb-6 mt-6">
          {isCliente ? (
            <div className="text-center">
              <div
                className="w-28 h-28 mb-1 mx-auto"
                style={{
                  backgroundColor: cor,
                  WebkitMaskImage: 'url(/logo.png)',
                  maskImage: 'url(/logo.png)',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center'
                }}
              />
              <h1 style={{
                fontFamily: "'Dancing Script', cursive",
                fontSize: '2.2rem',
                fontWeight: 700,
                color: cor,
                lineHeight: 1.2,
              }}>
                {nomePrincipal || 'Entrar'}
              </h1>
              {nomeSecundario && (
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {nomeSecundario}
                </p>
              )}
              <p className="text-gray-400 text-sm mt-2">Entre na sua conta para continuar</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div
                className="w-20 h-20 mb-4"
                style={{
                  backgroundColor: '#111827',
                  WebkitMaskImage: 'url(/logo.png)',
                  maskImage: 'url(/logo.png)',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center'
                }}
              />
              <h1 className="text-2xl font-bold text-gray-900">Organiza Salão</h1>
              <p className="text-gray-400 text-sm mt-1">Toda a gestão do seu espaço na palma da mão.</p>
            </div>
          )}
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-900">Email</label>
            <input className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none placeholder-gray-400"
              type="email" placeholder="seuemail@exemplo.com"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-900">Senha</label>
              <button
                type="button"
                onClick={() => {
                  setModalEsqueci(true)
                  setErroEsqueci('')
                  setSucessoEsqueci('')
                }}
                className="text-xs font-bold hover:underline transition-all"
                style={{ color: cor }}
              >
                Esqueceu a senha?
              </button>
            </div>
            <div className="relative">
              <input className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 pr-12 text-base outline-none placeholder-gray-400"
                type={mostrarSenha ? 'text' : 'password'} placeholder="Digite sua senha"
                value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setMostrarSenha(!mostrarSenha)}>
                {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button type="button" onClick={() => setLembrarEReceber(v => !v)}
            className="flex items-center gap-3 text-left">
            <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
              style={{ borderColor: lembrarEReceber ? cor : '#d1d5db', backgroundColor: lembrarEReceber ? cor : 'transparent' }}>
              {lembrarEReceber && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L4.5 8.5L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              <Bell size={14} className="text-gray-400 shrink-0" />
              Lembrar meu acesso e receber notificações
            </span>
          </button>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm text-center">{erro}</p>
            </div>
          )}
          <button className="w-full text-white rounded-2xl py-4 font-semibold text-base flex items-center justify-center active:scale-95 transition-all mt-1"
            style={{ backgroundColor: cor }} onClick={handleLogin} disabled={loading}>
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Entrar'}
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
            <p className="text-center text-gray-900 text-sm">
              Não tem conta?{' '}
              <a href={'/cadastro?salao=' + slugCadastro} className="font-bold" style={{ color: cor }}>Criar conta</a>
            </p>
          )}
        </div>
      </div>

      {/* MODAL DE ESQUECI A SENHA */}
      {modalEsqueci && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cor}15`, color: cor }}>
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Recuperar Senha</h3>
                <p className="text-xs text-gray-500">Enviaremos um link para criar nova senha.</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-2">
              <label className="text-xs font-semibold text-gray-900">E-mail cadastrado</label>
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4 text-base outline-none placeholder-gray-400"
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            {erroEsqueci && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-600 text-xs text-center">{erroEsqueci}</p>
              </div>
            )}

            {sucessoEsqueci && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-green-700 text-xs text-center font-medium">{sucessoEsqueci}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEsqueci(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-3.5 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEsqueciSenha}
                disabled={loadingEsqueci}
                className="flex-1 text-white py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center active:scale-95 transition"
                style={{ backgroundColor: cor }}
              >
                {loadingEsqueci ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Enviar Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
