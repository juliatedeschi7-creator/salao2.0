'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [carregando, setCarregando] = useState(false)
  const [verificandoSessao, setVerificandoSessao] = useState(true)

  const [temSessao, setTemSessao] = useState(false)

  const [mensagemErro, setMensagemErro] = useState('')
  const [mensagemSucesso, setMensagemSucesso] = useState('')

  useEffect(() => {
    let ativo = true

    async function prepararRecuperacao() {
      try {
        /*
         * ==========================================================
         * 1. VERIFICA SE O SUPABASE ENVIOU UM CODE NA URL
         * ==========================================================
         *
         * No fluxo PKCE, o link de recuperação chega assim:
         *
         * /redefinir-senha?code=xxxxxxxx
         *
         * Precisamos trocar esse código por uma sessão.
         */

        const code = searchParams.get('code')

        if (code) {
          console.log('[RECUPERAÇÃO] Código encontrado na URL.')

          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error(
              '[RECUPERAÇÃO] Erro ao trocar code por sessão:',
              error
            )

            if (ativo) {
              setTemSessao(false)
              setMensagemErro(
                'O link de recuperação expirou ou já foi utilizado. Solicite um novo link pelo login.'
              )
              setVerificandoSessao(false)
            }

            return
          }

          if (data.session) {
            console.log(
              '[RECUPERAÇÃO] Sessão de recuperação criada com sucesso.'
            )

            if (ativo) {
              setTemSessao(true)
              setMensagemErro('')
              setVerificandoSessao(false)
            }

            return
          }
        }

        /*
         * ==========================================================
         * 2. ESCUTA O EVENTO PASSWORD_RECOVERY
         * ==========================================================
         */

        const {
          data: authListener
        } = supabase.auth.onAuthStateChange(
          (event, session) => {
            console.log(
              '[RECUPERAÇÃO] Evento de autenticação:',
              event
            )

            if (!ativo) return

            if (
              event === 'PASSWORD_RECOVERY' &&
              session
            ) {
              setTemSessao(true)
              setMensagemErro('')
              setVerificandoSessao(false)

              return
            }

            /*
             * Também aceitamos uma sessão já existente.
             */

            if (session) {
              setTemSessao(true)
              setMensagemErro('')
              setVerificandoSessao(false)
            }
          }
        )

        /*
         * ==========================================================
         * 3. VERIFICA SE JÁ EXISTE UMA SESSÃO
         * ==========================================================
         */

        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error(
            '[RECUPERAÇÃO] Erro ao obter sessão:',
            sessionError
          )
        }

        if (session) {
          console.log(
            '[RECUPERAÇÃO] Sessão encontrada.'
          )

          if (ativo) {
            setTemSessao(true)
            setMensagemErro('')
            setVerificandoSessao(false)
          }

          return
        }

        /*
         * ==========================================================
         * 4. PEQUENA ESPERA
         * ==========================================================
         *
         * Útil principalmente em Safari/iPhone.
         */

        await new Promise(resolve =>
          setTimeout(resolve, 800)
        )

        if (!ativo) return

        const {
          data: { session: sessionDepois }
        } = await supabase.auth.getSession()

        if (sessionDepois) {
          setTemSessao(true)
          setMensagemErro('')
        } else {
          setTemSessao(false)

          setMensagemErro(
            'Não foi possível validar o link de recuperação. Solicite um novo link pelo login.'
          )
        }

        setVerificandoSessao(false)

        return () => {
          authListener.subscription.unsubscribe()
        }

      } catch (error: any) {
        console.error(
          '[RECUPERAÇÃO] Erro inesperado:',
          error
        )

        if (ativo) {
          setTemSessao(false)
          setMensagemErro(
            'Não foi possível validar o link de recuperação. Solicite um novo link pelo login.'
          )
          setVerificandoSessao(false)
        }
      }
    }

    prepararRecuperacao()

    return () => {
      ativo = false
    }

  }, [searchParams])


  async function handleSalvarSenha(
    e: React.FormEvent
  ) {
    e.preventDefault()

    setMensagemErro('')
    setMensagemSucesso('')

    /*
     * ==========================================================
     * VALIDAÇÕES
     * ==========================================================
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

    setCarregando(true)

    try {

      /*
       * ==========================================================
       * CONFIRMA A SESSÃO
       * ==========================================================
       */

      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!session) {
        setMensagemErro(
          'O link de recuperação não está mais válido. Solicite um novo link pelo login.'
        )

        setTemSessao(false)
        return
      }

      /*
       * ==========================================================
       * ALTERA A SENHA
       * ==========================================================
       */

      const { error } =
        await supabase.auth.updateUser({
          password: novaSenha
        })

      if (error) {
        console.error(
          '[RECUPERAÇÃO] Erro ao atualizar senha:',
          error
        )

        setMensagemErro(
          'Não foi possível alterar a senha: ' +
          error.message
        )

        return
      }

      /*
       * ==========================================================
       * SUCESSO
       * ==========================================================
       */

      setMensagemSucesso(
        'Senha alterada com sucesso! Você será direcionada para o login.'
      )

      /*
       * Dá um pequeno tempo para a usuária
       * visualizar a confirmação.
       */

      setTimeout(async () => {

        await supabase.auth.signOut()

        router.replace('/login')

      }, 1500)

    } catch (error: any) {

      console.error(
        '[RECUPERAÇÃO] Erro ao redefinir senha:',
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


        {/* =====================================================
            VALIDANDO LINK
        ====================================================== */}

        {verificandoSessao && (

          <div className="bg-gray-50 border border-gray-100 text-gray-600 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">

            <div
              className="
                w-4 h-4
                border-2
                border-gray-300
                border-t-pink-500
                rounded-full
                animate-spin
                shrink-0
              "
            />

            <span>
              Validando seu link de recuperação...
            </span>

          </div>

        )}


        {/* =====================================================
            ERRO
        ====================================================== */}

        {mensagemErro && (

          <div className="
            bg-red-50
            border
            border-red-200
            text-red-600
            text-xs
            p-3
            rounded-xl
            mb-4
            leading-relaxed
          ">

            {mensagemErro}

          </div>

        )}


        {/* =====================================================
            SUCESSO
        ====================================================== */}

        {mensagemSucesso && (

          <div className="
            bg-emerald-50
            border
            border-emerald-200
            text-emerald-700
            text-xs
            p-3
            rounded-xl
            mb-4
            leading-relaxed
          ">

            {mensagemSucesso}

          </div>

        )}


        <form
          onSubmit={handleSalvarSenha}
          className="space-y-4"
        >

          {/* ===================================================
              NOVA SENHA
          ==================================================== */}

          <div>

            <label className="
              block
              text-xs
              font-semibold
              text-gray-700
              mb-1.5
            ">
              Nova senha
            </label>

            <input
              type="password"
              placeholder="Digite a nova senha"
              className="
                w-full
                px-4
                py-3
                rounded-xl
                border
                border-gray-200
                text-sm
                focus:outline-none
                focus:border-pink-500
                disabled:bg-gray-100
              "
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


          {/* ===================================================
              CONFIRMAR SENHA
          ==================================================== */}

          <div>

            <label className="
              block
              text-xs
              font-semibold
              text-gray-700
              mb-1.5
            ">
              Confirmar nova senha
            </label>

            <input
              type="password"
              placeholder="Digite novamente a senha"
              className="
                w-full
                px-4
                py-3
                rounded-xl
                border
                border-gray-200
                text-sm
                focus:outline-none
                focus:border-pink-500
                disabled:bg-gray-100
              "
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


          {/* ===================================================
              BOTÃO
          ==================================================== */}

          <button
            type="submit"
            disabled={
              verificandoSessao ||
              carregando ||
              !temSessao ||
              !novaSenha ||
              !confirmarSenha
            }
            className="
              w-full
              py-3
              rounded-xl
              text-white
              font-semibold
              text-sm
              disabled:opacity-50
              transition
            "
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


        {/* =====================================================
            VOLTAR PARA LOGIN
        ====================================================== */}

        {!verificandoSessao &&
          !temSessao && (

          <button
            type="button"
            onClick={() =>
              router.replace('/login')
            }
            className="
              w-full
              mt-3
              py-3
              rounded-xl
              border
              border-gray-200
              text-gray-600
              font-medium
              text-sm
            "
          >
            Voltar para o login
          </button>

        )}

      </div>

    </div>
  )
}