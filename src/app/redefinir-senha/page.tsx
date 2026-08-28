'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RedefinirSenhaPage() {
  const router = useRouter()

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [carregando, setCarregando] = useState(false)
  const [verificandoSessao, setVerificandoSessao] = useState(true)

  const [temSessao, setTemSessao] = useState(false)
  const [mensagemErro, setMensagemErro] = useState('')
  const [mensagemSucesso, setMensagemSucesso] = useState('')

  useEffect(() => {
    let ativo = true

    async function verificarSessao() {
      try {
        /*
         * Quando o usuário abre o link de recuperação,
         * o Supabase pode precisar de alguns instantes
         * para processar o token da URL e criar a sessão.
         *
         * Por isso verificamos mais de uma vez.
         */

        const tentativas = 10

        for (let i = 0; i < tentativas; i++) {
          if (!ativo) return

          const {
            data: { session },
            error
          } = await supabase.auth.getSession()

          if (error) {
            console.error(
              'Erro ao verificar sessão:',
              error
            )
          }

          if (session) {
            if (ativo) {
              setTemSessao(true)
              setVerificandoSessao(false)
            }

            return
          }

          /*
           * Aguarda 300ms antes de tentar novamente.
           * Isso ajuda principalmente no iPhone/Safari,
           * onde o processamento inicial do link pode
           * acontecer um pouco depois da renderização.
           */

          await new Promise(resolve =>
            setTimeout(resolve, 300)
          )
        }

        if (ativo) {
          setTemSessao(false)
          setVerificandoSessao(false)
          setMensagemErro(
            'Não foi possível validar o link de recuperação. Abra o link novamente pelo e-mail.'
          )
        }

      } catch (error) {
        console.error(
          'Erro ao verificar sessão de recuperação:',
          error
        )

        if (ativo) {
          setTemSessao(false)
          setVerificandoSessao(false)
          setMensagemErro(
            'Não foi possível validar o link de recuperação.'
          )
        }
      }
    }

    /*
     * Escuta o evento PASSWORD_RECOVERY.
     *
     * Esse é o evento específico que o Supabase dispara
     * quando o usuário entra pelo fluxo de recuperação
     * de senha.
     */

    const {
      data: authListener
    } = supabase.auth.onAuthStateChange(
      (event, session) => {

        console.log(
          '[REDEFINIR SENHA] Evento:',
          event
        )

        if (!ativo) return

        if (
          event === 'PASSWORD_RECOVERY' ||
          session
        ) {
          setTemSessao(true)
          setVerificandoSessao(false)
          setMensagemErro('')
        }

        if (event === 'SIGNED_OUT') {
          setTemSessao(false)
        }
      }
    )

    verificarSessao()

    return () => {
      ativo = false
      authListener.subscription.unsubscribe()
    }

  }, [])

  async function handleSalvarSenha(
    e: React.FormEvent
  ) {
    e.preventDefault()

    setMensagemErro('')
    setMensagemSucesso('')

    /*
     * Validação da senha
     */

    if (novaSenha.length < 6) {
      setMensagemErro(
        'A senha deve ter pelo menos 6 caracteres.'
      )
      return
    }

    if (novaSenha !== confirmarSenha) {
      setMensagemErro(
        'As senhas não são iguais.'
      )
      return
    }

    /*
     * Confirma novamente a sessão imediatamente antes
     * de alterar a senha.
     */

    setCarregando(true)

    try {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!session) {
        setMensagemErro(
          'O link de recuperação não está mais válido. Solicite um novo link para redefinir sua senha.'
        )

        setTemSessao(false)
        return
      }

      /*
       * Atualiza a senha do usuário autenticado
       * pelo fluxo de recuperação.
       */

      const {
        error: updateError
      } = await supabase.auth.updateUser({
        password: novaSenha
      })

      if (updateError) {
        console.error(
          'Erro ao atualizar senha:',
          updateError
        )

        setMensagemErro(
          'Não foi possível alterar a senha: ' +
          updateError.message
        )

        return
      }

      /*
       * Senha alterada com sucesso.
       */

      setMensagemSucesso(
        'Senha alterada com sucesso! Você será direcionada para o login.'
      )

      /*
       * Faz logout para que a pessoa entre novamente
       * utilizando a nova senha.
       */

      await supabase.auth.signOut()

      setTimeout(() => {
        router.replace('/login')
      }, 1500)

    } catch (error: any) {
      console.error(
        'Erro ao redefinir senha:',
        error
      )

      setMensagemErro(
        error?.message ||
        'Ocorreu um erro ao alterar a senha.'
      )

    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">

      <div className="bg-white p-6 rounded-3xl shadow-sm max-w-sm w-full">

        <h2 className="font-bold text-xl text-gray-900 mb-1">
          Criar nova senha
        </h2>

        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          Digite uma nova senha para acessar sua conta do Organiza.
        </p>

        {/* VERIFICANDO LINK */}

        {verificandoSessao && (
          <div className="bg-gray-50 border border-gray-100 text-gray-600 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-pink-500 rounded-full animate-spin shrink-0" />

            <span>
              Validando seu link de recuperação...
            </span>
          </div>
        )}

        {/* ERRO */}

        {mensagemErro && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl mb-4 leading-relaxed">
            {mensagemErro}
          </div>
        )}

        {/* SUCESSO */}

        {mensagemSucesso && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl mb-4 leading-relaxed">
            {mensagemSucesso}
          </div>
        )}

        <form
          onSubmit={handleSalvarSenha}
          className="space-y-3"
        >

          {/* NOVA SENHA */}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Nova senha
            </label>

            <input
              type="password"
              placeholder="Digite a nova senha"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
              value={novaSenha}
              onChange={e =>
                setNovaSenha(e.target.value)
              }
              required
              minLength={6}
              autoComplete="new-password"
              disabled={
                verificandoSessao ||
                carregando ||
                !temSessao
              }
            />
          </div>

          {/* CONFIRMAR SENHA */}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Confirmar nova senha
            </label>

            <input
              type="password"
              placeholder="Digite novamente a senha"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
              value={confirmarSenha}
              onChange={e =>
                setConfirmarSenha(e.target.value)
              }
              required
              minLength={6}
              autoComplete="new-password"
              disabled={
                verificandoSessao ||
                carregando ||
                !temSessao
              }
            />
          </div>

          {/* BOTÃO */}

          <button
            type="submit"
            disabled={
              verificandoSessao ||
              carregando ||
              !temSessao ||
              !novaSenha ||
              !confirmarSenha
            }
            className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition"
            style={{
              backgroundColor: '#E91E8C'
            }}
          >
            {verificandoSessao
              ? 'Validando link...'
              : carregando
                ? 'Salvando...'
                : 'Salvar nova senha'}
          </button>

        </form>

        {/* LINK INVÁLIDO */}

        {!verificandoSessao &&
          !temSessao && (
            <button
              type="button"
              onClick={() =>
                router.push('/login')
              }
              className="w-full mt-3 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm"
            >
              Voltar para o login
            </button>
          )}

      </div>

    </div>
  )
}