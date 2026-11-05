
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
} from 'lucide-react'

type Etapa = 'codigo' | 'senha'

export default function RedefinirSenhaPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [etapa, setEtapa] = useState<Etapa>('codigo')
  const [verificandoCodigo, setVerificandoCodigo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false)

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search)
    const emailUrl = parametros.get('email')

    if (emailUrl) {
      setEmail(emailUrl.trim().toLowerCase())
    }
  }, [])

  async function validarCodigo(e?: React.FormEvent) {
    e?.preventDefault()
    setErro('')

    const emailLimpo = email.trim().toLowerCase()
    const codigoLimpo = codigo.replace(/\D/g, '')

    if (!emailLimpo) {
      setErro('Informe o e-mail cadastrado.')
      return
    }

    if (!/^\d{6}$/.test(codigoLimpo)) {
      setErro('Digite o código de seis números recebido por e-mail.')
      return
    }

    setVerificandoCodigo(true)

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailLimpo,
        token: codigoLimpo,
        type: 'recovery',
      })

      if (error || !data.session) {
        console.error('Erro ao validar código de recuperação:', error)

        setErro(
          'Código inválido ou expirado. Confira os números e, se necessário, solicite um novo código.'
        )
        return
      }

      setEtapa('senha')
      setErro('')
    } catch (err) {
      console.error('Erro inesperado ao validar código:', err)
      setErro('Não foi possível validar o código. Tente novamente.')
    } finally {
      setVerificandoCodigo(false)
    }
  }

  async function salvarSenha(e?: React.FormEvent) {
    e?.preventDefault()
    setErro('')
    setSucesso(false)

    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setSalvando(true)

    try {
      const {
        data: { session },
        error: erroSessao,
      } = await supabase.auth.getSession()

      if (erroSessao || !session) {
        setEtapa('codigo')
        setErro(
          'Sua sessão de recuperação expirou. Solicite um novo código pelo e-mail.'
        )
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      })

      if (error) {
        console.error('Erro ao atualizar senha:', error)
        setErro('Não foi possível atualizar a senha: ' + error.message)
        return
      }

      setSucesso(true)

      await supabase.auth.signOut()

      setTimeout(() => {
        router.replace('/login')
      }, 2000)
    } catch (err) {
      console.error('Erro inesperado ao salvar senha:', err)
      setErro('Não foi possível alterar sua senha. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#faf7f8] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-7 sm:p-8">
          <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-5">
            {sucesso ? (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : etapa === 'codigo' ? (
              <Mail className="w-7 h-7 text-pink-500" />
            ) : (
              <Lock className="w-7 h-7 text-pink-500" />
            )}
          </div>

          <h1 className="text-2xl font-semibold text-gray-800 text-center">
            {sucesso
              ? 'Senha alterada!'
              : etapa === 'codigo'
                ? 'Confirmar código'
                : 'Criar nova senha'}
          </h1>

          <p className="text-sm text-gray-500 text-center mt-2 mb-7">
            {sucesso
              ? 'Sua senha foi atualizada com sucesso.'
              : etapa === 'codigo'
                ? 'Digite o código recebido no seu e-mail para confirmar sua identidade.'
                : 'Agora você já pode cadastrar uma nova senha para sua conta.'}
          </p>

          {erro && (
            <div className="mb-5 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 leading-relaxed">
                {erro}
              </p>
            </div>
          )}

          {sucesso ? (
            <div className="text-center py-5">
              <p className="text-sm text-gray-500">
                Você já pode entrar com sua nova senha.
              </p>
              <p className="text-xs text-gray-400 mt-4">
                Redirecionando para o login...
              </p>
              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="w-full mt-5 rounded-2xl bg-[#d98fa5] text-white py-3.5 font-medium"
              >
                Ir para o login
              </button>
            </div>
          ) : etapa === 'codigo' ? (
            <form onSubmit={validarCodigo} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail cadastrado
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-gray-800 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código recebido por e-mail
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) =>
                    setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-center text-2xl tracking-[0.5em] font-semibold text-gray-800 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                  required
                />
                <p className="text-xs text-gray-400 mt-2">
                  O código é enviado pelo Supabase para o e-mail cadastrado.
                </p>
              </div>

              <button
                type="submit"
                disabled={verificandoCodigo}
                className="w-full rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 font-medium transition flex items-center justify-center gap-2"
              >
                {verificandoCodigo ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verificando código...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    Confirmar código
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                Voltar para o login
              </button>
            </form>
          ) : (
            <form onSubmit={salvarSenha} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nova senha
                </label>

                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Digite sua nova senha"
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 pr-12 text-gray-800 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setMostrarSenha((valor) => !valor)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha
                      ? <EyeOff className="w-5 h-5" />
                      : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  A senha deve ter pelo menos 6 caracteres.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar nova senha
                </label>

                <div className="relative">
                  <input
                    type={mostrarConfirmacao ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Digite a senha novamente"
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 pr-12 text-gray-800 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarConfirmacao((valor) => !valor)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={
                      mostrarConfirmacao
                        ? 'Ocultar senha'
                        : 'Mostrar senha'
                    }
                  >
                    {mostrarConfirmacao
                      ? <EyeOff className="w-5 h-5" />
                      : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={salvando}
                className="w-full rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 font-medium transition flex items-center justify-center gap-2"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar nova senha'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEtapa('codigo')
                  setNovaSenha('')
                  setConfirmarSenha('')
                  setErro('')
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                Voltar
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
