'use client'
import { useState, Suspense, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

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
      if (!salaoSlug) {
        setCarregandoSalao(false)
        return
      }
      const { data } = await supabase
        .from('saloes')
        .select('nome, cor_primaria, cor_secundaria')
        .eq('slug', salaoSlug)
        .maybeSingle()
      if (data) setSalaoInfo(data)
      setCarregandoSalao(false)
    }
    buscarSalao()
  }, [salaoSlug])

  async function handleCadastro() {
    if (!nome || !email || !senha) {
      setErro('Preencha todos os campos.')
      return
    }
    if (senha.length < 6) {
      setErro('Senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (isCliente && !dataNascimento) {
      setErro('Informe sua data de nascimento.')
      return
    }
    setLoading(true)
    setErro('')
    const role = isCliente ? 'cliente' : 'dono_salao'
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
        options: { data: { nome: nome.trim(), role } }
      })
      if (error) {
        setErro(error.message.includes('already') ? 'Email ja cadastrado.' : 'Erro: ' + error.message)
        setLoading(false)
        return
      }
      if (!data.user) {
        setErro('Erro ao criar usuario.')
        setLoading(false)
        return
      }

      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email.trim().toLowerCase(),
        nome: nome.trim(),
        role,
        aprovado: isCliente,
        ativo: true
      }, { onConflict: 'id' })

      if (isCliente && salaoSlug) {
        const { data: salao } = await supabase.from('saloes').select('id').eq('slug', salaoSlug).single()
        if (!salao) {
          setErro('Salao nao encontrado.')
          setLoading(false)
          return
        }
        await supabase.from('clientes').insert({
          salao_id: salao.id,
          profile_id: data.user.id,
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
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

  if (carregandoSalao) {
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
      <div className="w-full max-w-sm flex flex-col items-center gap-1 mb-6 mt-6">
{isCliente ? (
  <div className="text-center mt-8">
    <h1 className="text-2xl font-bold leading-tight" style={{ color: cor }}>
      {getNomeParte1()}
    </h1>
    {getNomeParte2() && (
      <p className="text-sm font-medium mt-1 text-gray-400">
        {getNomeParte2()}
      </p>
    )}
    <p className="text-gray-400 text-sm mt-3 text-center leading-relaxed">
      Crie sua conta para agendar serviços<br />e acompanhar seus pacotes
    </p>
  </div>
) : (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Criar conta</h1>
            <p className="text-gray-400 text-sm mt-1 text-center">
              {isSalao ? 'Comece a organizar seu salao' : 'Comece agora'}
            </p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4 mt-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">Nome completo</label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none transition-colors placeholder-gray-400"
            placeholder="Seu nome completo"
            value={nome}
            onChange={e => setNome(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">Email</label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none transition-colors placeholder-gray-400"
            type="email"
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        {isCliente && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Data de nascimento</label>
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 text-base outline-none transition-colors text-gray-700"
              type="date"
              value={dataNascimento}
              onChange={e => setDataNascimento(e.target.value)}
              style={{ colorScheme: 'light' }}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">Senha</label>
          <div className="relative">
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 pr-12 text-base outline-none transition-colors placeholder-gray-400"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={e => setSenha(e.target.value)}
            />
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setMostrarSenha(!mostrarSenha)}
            >
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
          onClick={handleCadastro}
          disabled={loading}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Criar conta'
          )}
        </button>

        <p className="text-center text-gray-500 text-sm mb-6">
          Já tem conta?{' '}
          <a href="/login" className="font-bold" style={{ color: cor }}>
            Entrar
          </a>
        </p>
      </div>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CadastroForm />
    </Suspense>
  )
}
