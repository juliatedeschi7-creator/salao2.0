'use client'
import { useState, Suspense, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function hexParaFiltroCSS(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `brightness(0) saturate(100%) invert(${Math.round(r / 2.55)}%) sepia(1) saturate(5) hue-rotate(${Math.round((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180) / Math.PI)}deg)`
}

function CadastroForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const salaoSlug = searchParams.get('salao')
  const tipo = searchParams.get('tipo')

  const [salaoInfo, setSalaoInfo] = useState<any>(null)
  const [carregandoSalao, setCarregandoSalao] = useState(true)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const isCliente = !!salaoSlug
  const isSalao = tipo === 'salao' || !!token

  useEffect(() => {
    async function buscarSalao() {
      if (!salaoSlug) { setCarregandoSalao(false); return }
      const { data } = await supabase.from('saloes')
        .select('nome, cor_primaria, cor_secundaria')
        .eq('slug', salaoSlug)
        .maybeSingle()
      if (data) setSalaoInfo(data)
      setCarregandoSalao(false)
    }
    buscarSalao()
  }, [salaoSlug])

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
        window.location.href = '/cliente'
        return
      }

      if (token) {
        const { data: convite } = await supabase.from('convites').select('*').eq('token', token).eq('usado', false).single()
        if (convite) {
          await supabase.from('profiles').update({ role: convite.role, salao_id: convite.salao_id }).eq('id', data.user.id)
          await supabase.from('convites').update({ usado: true }).eq('id', convite.id)
        }
        window.location.href = '/aguardando'
        return
      }
      window.location.href = isSalao ? '/aguardando' : '/login'
    } catch (e: any) {
      setErro('Erro: ' + (e.message || 'Tente novamente.'))
    }
    setLoading(false)
  }

  const cor = (isCliente && salaoInfo?.cor_primaria) ? salaoInfo.cor_primaria : '#111827'
  const corSec = (isCliente && salaoInfo?.cor_secundaria) ? salaoInfo.cor_secundaria : '#f3f4f6'

  function getNomeParte1() {
    if (!salaoInfo?.nome) return 'Criar conta'
    return salaoInfo.nome.includes(' - ') ? salaoInfo.nome.split(' - ')[0] : salaoInfo.nome
  }

  function getNomeParte2() {
    if (!salaoInfo?.nome) return null
    return salaoInfo.nome.includes(' - ') ? salaoInfo.nome.split(' - ')[1] : null
  }

  if (carregandoSalao) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-6 pt-14 pb-10 flex flex-col items-center" style={{ backgroundColor: cor }}>
        <div className="w-28 h-28 rounded-3xl bg-white flex items-center justify-center mb-5 shadow-lg p-3">
          <img
            src="/logo.png"
            alt="Organiza"
            className="w-full h-full object-contain"
            style={isCliente && salaoInfo ? {
              filter: 'brightness(0) saturate(100%)',
              WebkitFilter: 'brightness(0) saturate(100%)',
            } : {}}
          />
        </div>

        {isCliente ? (
          <div className="text-center">
            <h1 className="text-white text-2xl font-bold leading-tight">
              {getNomeParte1()}
            </h1>
            {getNomeParte2() && (
              <p className="text-white/80 text-base font-medium mt-0.5">
                {getNomeParte2()}
              </p>
            )}
            <p className="text-white/70 text-sm mt-2 text-center">
              Crie sua conta para acessar nossos servicos
            </p>
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-white text-2xl font-bold">Organiza</h1>
            <p className="text-white/70 text-sm mt-1 text-center">
              {isSalao ? 'Cadastre seu negocio' : 'Crie sua conta'}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 px-6 py-8 flex flex-col gap-5 max-w-sm mx-auto w-full">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">Nome completo</label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none transition-colors"
            placeholder="Seu nome completo"
            value={nome} onChange={e => setNome(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">Email</label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none transition-colors"
            type="email" placeholder="seuemail@exemplo.com"
            value={email} onChange={e => setEmail(e.target.value)}
          />
        </div>

        {isCliente && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">
              Data de nascimento <span className="text-red-400">*</span>
            </label>
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none transition-colors"
              type="date"
              value={dataNascimento} onChange={e => setDataNascimento(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">Senha</label>
          <div className="relative">
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 pr-12 text-base outline-none transition-colors"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Minimo 6 caracteres"
              value={senha} onChange={e => setSenha(e.target.value)}
            />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
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
          onClick={handleCadastro} disabled={loading}>
          {loading
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Criar conta'}
        </button>

        <p className="text-center text-gray-600 text-sm">
          Ja tem conta?{' '}
          <a href="/login" className="font-bold underline" style={{ color: cor }}>Entrar</a>
        </p>
      </div>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CadastroForm />
    </Suspense>
  )
}
