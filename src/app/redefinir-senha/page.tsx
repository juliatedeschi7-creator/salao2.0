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
} from 'lucide-react'

export default function RedefinirSenhaPage() {
  const router = useRouter()

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [temSessao, setTemSessao] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false)

  useEffect(() => {
    let montado = true

    const verificarRecuperacao = async () => {
      try {
        setVerificando(true)
        setErro('')

        /*
         * SUPABASE PKCE
         *
         * Quando o projeto usa PKCE, o link de recuperação chega
         * com ?code=...
         *
         * Precisamos trocar esse code por uma sessão antes de
         * tentar atualizar a senha.
         */
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const code = params.get('code')

          if (code) {
            const { error } =
              await supabase.auth.exchangeCodeForSession(code)

            if (error) {
              console.error(
                'Erro ao trocar código de recuperação por sessão:',
                error
              )

              if (montado) {
                setErro(
                  'O link de recuperação é inválido, expirou ou já foi utilizado. Solicite um novo link pelo e-mail.'
                )
                setTemSessao(false)
              }

              return
            }
          }
        }

        /*
         * Depois do exchangeCodeForSession, verificamos se existe
         * uma sessão válida.
         */
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Erro ao verificar sessão:', error)

          if (montado) {
            setErro(
              'Não foi possível validar o link de recuperação. Solicite um novo link pelo e-mail.'
            )
            setTemSessao(false)
          }

          return
        }

        if (data.session) {
          if (montado) {
            setTemSessao(true)
            setErro('')
          }

          return
        }

        /*
         * Caso o Supabase ainda esteja processando o fluxo de
         * recuperação, aguardamos o evento PASSWORD_RECOVERY.
         */
        if (montado) {
          setTemSessao(false)
        }
      } catch (err) {
        console.error('Erro inesperado na recuperação:', err)

        if (montado) {
          setErro(
            'Não foi possível validar o link de recuperação. Solicite um novo link pelo e-mail.'
          )
          setTemSessao(false)
        }
      } finally {
        if (montado) {
          setVerificando(false)
        }
      }
    }

    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Evento de autenticação:', event)

        if (
          event === 'PASSWORD_RECOVERY' ||
          event === 'SIGNED_IN'
        ) {
          if (session && montado) {
            setTemSessao(true)
            setErro('')
            setVerificando(false)
          }
        }
      }
    )

    verificarRecuperacao()

    return () => {
      montado = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const salvarSenha = async () => {
    setErro('')
    setSucesso(false)

    if (!temSessao) {
      setErro(
        'A sessão de recuperação não está disponível. Solicite um novo link pelo e-mail.'
      )
      return
    }

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
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      })

      if (error) {
        console.error('Erro ao atualizar senha:', error)
        setErro(error.message)
        setSalvando(false)
        return
      }

      setSucesso(true)
      setSalvando(false)

      setTimeout(() => {
        router.push('/login')
      }, 1800)
    } catch (err) {
      console.error('Erro inesperado ao salvar senha:', err)

      setErro(
        'Não foi possível alterar sua senha. Tente novamente.'
      )

      setSalvando(false)
    }
  }

  if (verificando) {
    return (
      <main className="min-h-screen bg-[#faf7f8] flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-7 h-7 text-pink-500 animate-spin" />
            </div>

            <h1 className="text-xl font-semibold text-gray-800 mb-2">
              Validando seu acesso
            </h1>

            <p className="text-sm text-gray-500">
              Aguarde enquanto verificamos seu link de recuperação.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (!temSessao) {
    return (
      <main className="min-h-screen bg-[#faf7f8] flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>

            <h1 className="text-2xl font-semibold text-gray-800 text-center mb-3">
              Link indisponível
            </h1>

            <p className="text-sm text-gray-500 text-center leading-relaxed">
              {erro ||
                'O link de recuperação é inválido ou expirou. Solicite um novo link pelo e-mail.'}
            </p>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full mt-7 rounded-2xl bg-[#d98fa5] hover:bg-[#cc7f97] text-white py-3.5 font-medium transition"
            >
              Voltar para o login
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#faf7f8] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-7 sm:p-8">
          <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-pink-500" />
          </div>

          <h1 className="text-2xl font-semibold text-gray-800 text-center">
            Criar nova senha
          </h1>

          <p className="text-sm text-gray-500 text-center mt-2 mb-7">
            Digite sua nova senha para acessar sua conta novamente.
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
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>

              <h2 className="text-xl font-semibold text-gray-800">
                Senha alterada!
              </h2>

              <p className="text-sm text-gray-500 mt-2">
                Sua senha foi atualizada com sucesso.
              </p>

              <p className="text-xs text-gray-400 mt-4">
                Redirecionando para o login...
              </p>
            </div>
          ) : (
            <div className="space-y-5">
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
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarSenha((valor) => !valor)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={
                      mostrarSenha
                        ? 'Ocultar senha'
                        : 'Mostrar senha'
                    }
                  >
                    {mostrarSenha ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
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
                    type={
                      mostrarConfirmacao ? 'text' : 'password'
                    }
                    value={confirmarSenha}
                    onChange={(e) =>
                      setConfirmarSenha(e.target.value)
                    }
                    placeholder="Digite a senha novamente"
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 pr-12 text-gray-800 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
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
                    {mostrarConfirmacao ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={salvarSenha}
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
                onClick={() => router.push('/login')}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                Voltar para o login
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}