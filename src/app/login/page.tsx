/login/page.tsx — Sistema P&B (donos e funcionários


'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Scissors } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [nome, setNome] = useState('')

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('Email ou senha incorretos.'); setCarregando(false); return }
    router.replace('/salao')
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setCarregando(true)
    const { data, error } = await supabase.auth.signUp({ email, password: senha })
    if (error || !data.user) { setErro('Erro ao criar conta. Tente outro e-mail.'); setCarregando(false); return }
    await supabase.from('profiles').insert({
      id: data.user.id, email, nome, role: 'dono_salao', aprovado: false, ativo: false
    })
    setCarregando(false)
    setErro('')
    setModo('entrar')
    alert('Conta criada! Aguarde a aprovação do administrador.')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-8">

        {/* Logo sistema */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
            <Scissors size={28} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="font-bold text-gray-900 text-xl tracking-tight">StudioApp</h1>
            <p className="text-gray-400 text-sm mt-0.5">Gestão para salões de beleza</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm p-6 flex flex-col gap-5">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
            {(['entrar', 'criar'] as const).map(m => (
              <button key={m} onClick={() => { setModo(m); setErro('') }}
                className={'flex-1 py-2 rounded-xl text-sm font-semibold transition-all ' +
                  (modo === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400')}>
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={modo === 'entrar' ? entrar : criar} className="flex flex-col gap-3">
            {modo === 'criar' && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome do salão</label>
                <input value={nome} onChange={e => setNome(e.target.value)} required
                  placeholder="Ex: Studio Ana Paula"
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 transition-colors" />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="seu@email.com"
                className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 transition-colors" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Senha</label>
              <div className="relative mt-1.5">
                <input type={mostrarSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 transition-colors" />
                <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

            <button type="submit" disabled={carregando}
              className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-semibold text-sm mt-1 disabled:opacity-50 transition-opacity active:scale-[0.98]">
              {carregando ? '...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-300">StudioApp ©️ 2025</p>
      </div>
    </div>
  )
}