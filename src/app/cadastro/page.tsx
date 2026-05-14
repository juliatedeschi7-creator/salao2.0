'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Scissors, Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

export default function CadastroPage() {
  const searchParams = useSearchParams()
  const tipo = searchParams.get('tipo')
  const token = searchParams.get('token')
  const salaoSlug = searchParams.get('salao')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const isCliente = !!salaoSlug
  const isSalao = tipo === 'salao' || !!token

  async function handleCadastro() {
    if (!nome || !email || !senha) { setErro('Preencha todos os campos.'); return }
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (isCliente && !dataNascimento) { setErro('Informe sua data de nascimento.'); return }

    setLoading(true)
    setErro('')

    const role = isCliente ? 'cliente' : isSalao ? 'dono_salao' : 'cliente'

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: { nome, role }
      }
    })

    if (error) {
      setErro(error.message === 'User already registered'
        ? 'Este email já está cadastrado.'
        : 'Erro ao criar conta. Tente novamente.')
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email.trim(),
        nome,
        role,
        aprovado: isCliente ? true : false,
        ativo: true,
      })

      if (isCliente && salaoSlug) {
        const { data: salao } = await supabase
          .from('saloes')
          .select('id')
          .eq('slug', salaoSlug)
          .single()

        if (salao) {
          await supabase.from('clientes').insert({
            salao_id: salao.id,
            profile_id: data.user.id,
            nome,
            email: email.trim(),
            data_nascimento: dataNascimento || null,
          })

          await supabase.from('profiles').update({
            salao_id: salao.id
          }).eq('id', data.user.id)
        }

        window.location.href = '/cliente'
        return
      }

      if (token) {
        const { data: convite } = await supabase
          .from('convites')
          .select('*, saloes(*)')
          .eq('token', token)
          .eq('usado', false)
          .single()

        if (convite) {
          await supabase.from('profiles').update({
            role: convite.role,
            salao_id: convite.salao_id,
          }).eq('id', data.user.id)

          await supabase.from('convites').update({ usado: true })
            .eq('id', convite.id)
        }
      }

      window.location.href = isSalao
        ? '/criar-salao'
        : '/login?mensagem=Conta criada! Aguarde aprovação.'
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-8">
      <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center mb-5">
        <Scissors className="text-[#E91E8C]" size={28} />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {isCliente ? 'Criar sua conta' : isSalao ? 'Cadastrar Salão' : 'Criar conta'}
      </h1>
      <p className="text-gray-500 text-sm mb-6 text-center">
        {isCliente
          ? 'Acesse os serviços do salão'
          : 'Comece a organizar seu salão hoje'}
      </p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Nome completo</label>
          <div className="relative">
            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input-field pl-11"
              placeholder="Seu nome completo"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
          </div>
        </div>

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
            />
          </div>
        </div>

        {isCliente && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Data de nascimento
            </label>
            <input
              className="input-field"
              type="date"
              value={dataNascimento}
              onChange={e => setDataNascimento(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Senha</label>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input-field pl-11 pr-12"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={e => setSenha(e.target.value)}
            />
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setMostrarSenha(!mostrarSenha)}
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center">{erro}</p>
          </div>
        )}

        <button
          className="btn-primary mt-2"
          onClick={handleCadastro}
          disabled={loading}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : 'Criar conta'}
        </button>

        <p className="text-center text-gray-600 text-sm">
          Já tem conta?{' '}
          <a href="/login" className="text-[#E91E8C] font-semibold">Entrar</a>
        </p>
      </div>
    </div>
  )
}
