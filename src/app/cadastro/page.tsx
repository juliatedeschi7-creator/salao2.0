'use client'
import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Scissors } from 'lucide-react'

function CadastroConteudo() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  const [salao, setSalao] = useState<any>(null)
  const [convite, setConvite] = useState<any>(null)
  const [carregandoSalao, setCarregandoSalao] = useState(true)
  const [tokenInvalido, setTokenInvalido] = useState(false)
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (token) {
      carregarConvite()
    } else {
      setCarregandoSalao(false)
    }
  }, [token])

  async function carregarConvite() {
    const { data: conv } = await supabase
      .from('convites')
      .select('*, saloes(*)')
      .eq('token', token)
      .eq('usado', false)
      .single()
    if (!conv) {
      setTokenInvalido(true)
    } else {
      setConvite(conv)
      setSalao(conv.saloes)
      setModo('criar')
    }
    setCarregandoSalao(false)
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('Email ou senha incorretos.'); setCarregando(false); return }
    router.replace('/app')
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setCarregando(true)
    const { data, error } = await supabase.auth.signUp({ email, password: senha })
    if (error || !data.user) { setErro('Erro ao criar conta. Tente outro e-mail.'); setCarregando(false); return }
    const role = convite ? 'funcionario' : 'cliente'
    await supabase.from('profiles').insert({
      id: data.user.id, email, nome, role,
      salao_id: convite?.salao_id || null,
      acesso_total: convite?.acesso_total || false,
      aprovado: convite ? false : true,
      ativo: convite ? false : true
    })
    if (convite) {
      await supabase.from('convites').update({ usado: true }).eq('id', convite.id)
    }
    setCarregando(false)
    router.replace(convite ? '/cadastro/aguardando' : '/app')
  }

  const cor = salao?.cor_primaria || '#1a1a1a'
  const corSec = salao?.cor_secundaria || '#f0f0f0'

  if (carregandoSalao) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#1a1a1a', borderTopColor: 'transparent' }} />
    </div>
  )

  if (tokenInvalido) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
        <Scissors size={28} className="text-red-400" />
      </div>
      <h1 className="font-bold text-gray-900 text-xl">Link inválido</h1>
      <p className="text-gray-500 text-sm">Este link de convite já foi usado ou não existe. Peça um novo para a responsável do salão.</p>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: corSec }}>

      {/* Header com identidade do salão */}
      <div className="flex flex-col items-center pt-14 pb-8 px-6" style={{ backgroundColor: cor }}>
        {salao?.logo_url ? (
          <img src={salao.logo_url} alt={salao.nome}
            className="w-16 h-16 rounded-2xl object-cover shadow-lg mb-4" />
        ) : (
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4 bg-white/20">
            <img src="/icon.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>
        )}
        <h1 className="font-bold text-white text-xl text-center">
          {salao?.nome || 'Bem-vinda!'}
        </h1>
        {convite && (
          <p className="text-white/70 text-sm mt-1 text-center">
            {convite.acesso_total ? 'Você foi convidada como co-gestora' : 'Você foi convidada como funcionária'}
          </p>
        )}
        {!salao && !convite && (
          <p className="text-white/70 text-sm mt-1">Acesse sua conta</p>
        )}
      </div>

      {/* Card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 px-6 pt-8 pb-8 flex flex-col gap-5">

        {!convite && (
          <div className="flex rounded-2xl p-1 gap-1" style={{ backgroundColor: corSec }}>
            {(['entrar', 'criar'] as const).map(m => (
              <button key={m} onClick={() => { setModo(m); setErro('') }}
                className={'flex-1 py-2 rounded-xl text-sm font-semibold transition-all ' +
                  (modo === m ? 'bg-white shadow-sm' : 'text-gray-400')}
                style={modo === m ? { color: cor } : {}}>
                {m === 'entrar' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>
        )}

        {convite && (
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Criar sua conta</h2>
            <p className="text-sm text-gray-400 mt-0.5">Preencha os dados para começar</p>
          </div>
        )}

        <form onSubmit={modo === 'entrar' ? entrar : criar} className="flex flex-col gap-3">
          {modo === 'criar' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seu nome</label>
              <input value={nome} onChange={e => setNome(e.target.value)} required
                placeholder="Como você se chama?"
                className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none transition-colors"
                onFocus={e => e.target.style.borderColor = cor}
                onBlur={e => e.target.style.borderColor = '#f3f4f6'} />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="seu@email.com"
              className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none transition-colors"
              onFocus={e => e.target.style.borderColor = cor}
              onBlur={e => e.target.style.borderColor = '#f3f4f6'} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Senha</label>
            <div className="relative mt-1.5">
              <input type={mostrarSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} required
                placeholder="••••••••" minLength={6}
                className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-100 bg-gray-50 text-sm outline-none transition-colors"
                onFocus={e => e.target.style.borderColor = cor}
                onBlur={e => e.target.style.borderColor = '#f3f4f6'} />
              <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

          <button type="submit" disabled={carregando}
            className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm mt-2 disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{ backgroundColor: cor }}>
            {carregando ? '...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {salao && (
          <p className="text-center text-xs text-gray-300 mt-2">{salao.nome}</p>
        )}
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
      <CadastroConteudo />
    </Suspense>
  )
}