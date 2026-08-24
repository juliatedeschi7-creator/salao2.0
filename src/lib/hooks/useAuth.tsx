// @ts-nocheck
'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from 'react'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  nome: string
  email?: string
  role?: string
  tipo?: string
  salao_id?: string | null
  nivel_acesso?: string | null
  aprovado?: boolean
  ativo?: boolean
}

interface AuthContextType {
  user: any | null
  profile: Profile | null
  loading: boolean
  temAcessoTotal: boolean
  signOut: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  temAcessoTotal: false,
  signOut: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    let safetyTimer: ReturnType<typeof setTimeout> | null = null

    // --------------------------------------------------
    // BUSCAR PERFIL
    // --------------------------------------------------

    async function carregarPerfil(userId: string, email?: string) {
      try {
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (error) {
          console.error('Erro ao carregar perfil:', error)
        }

        if (!isMounted) return

        if (prof) {
          setProfile(prof)
        } else {
          // Perfil ainda não encontrado.
          // Mantemos um perfil mínimo para não deixar
          // a aplicação presa indefinidamente.
          setProfile({
            id: userId,
            nome: email?.split('@')[0] || 'Usuário',
            email: email
          })
        }
      } catch (error) {
        console.error('Erro ao buscar perfil:', error)

        if (!isMounted) return

        setProfile({
          id: userId,
          nome: email?.split('@')[0] || 'Usuário',
          email: email
        })
      }
    }

    // --------------------------------------------------
    // CARREGAR SESSÃO INICIAL
    // --------------------------------------------------

    async function carregarSessaoInicial() {
      try {
        // getSession() lê a sessão já existente no cliente.
        // É mais apropriado para inicialização do que getUser().
        const {
          data: { session },
          error
        } = await supabase.auth.getSession()

        if (error) {
          console.error('Erro ao recuperar sessão:', error)

          if (isMounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }

          return
        }

        if (!session?.user) {
          if (isMounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }

          return
        }

        const currentUser = session.user

        if (isMounted) {
          setUser(currentUser)
        }

        await carregarPerfil(
          currentUser.id,
          currentUser.email
        )

        if (isMounted) {
          setLoading(false)
        }

      } catch (error) {
        console.error('Erro ao inicializar autenticação:', error)

        if (isMounted) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    }

    // --------------------------------------------------
    // TIMEOUT DE SEGURANÇA
    // --------------------------------------------------
    //
    // Não queremos que o sistema fique eternamente
    // mostrando carregamento caso o Supabase tenha
    // algum problema de conexão.
    //
    // 8 segundos é mais seguro que 1,5s.
    //

    safetyTimer = setTimeout(() => {
      if (!isMounted) return

      console.warn(
        'Timeout de segurança da autenticação.'
      )

      setLoading(false)
    }, 8000)

    carregarSessaoInicial()

    // --------------------------------------------------
    // ALTERAÇÕES DE AUTENTICAÇÃO
    // --------------------------------------------------

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (event, session) => {

        if (!isMounted) return

        const currentUser = session?.user ?? null

        // LOGIN
        if (currentUser) {

          setUser(currentUser)

          // Não fazemos a consulta ao profile diretamente
          // dentro do callback de autenticação.
          //
          // Isso evita algumas condições de corrida na
          // inicialização do Supabase.
          //
          // Para eventos de login, fazemos a busca de forma
          // assíncrona e independente.
          Promise.resolve().then(async () => {

            await carregarPerfil(
              currentUser.id,
              currentUser.email
            )

            if (!isMounted) return

            setLoading(false)

            if (safetyTimer) {
              clearTimeout(safetyTimer)
              safetyTimer = null
            }
          })

          return
        }

        // LOGOUT
        if (
          event === 'SIGNED_OUT' ||
          event === 'INITIAL_SESSION'
        ) {
          setUser(null)
          setProfile(null)
          setLoading(false)

          if (safetyTimer) {
            clearTimeout(safetyTimer)
            safetyTimer = null
          }
        }
      }
    )

    return () => {
      isMounted = false

      if (safetyTimer) {
        clearTimeout(safetyTimer)
      }

      subscription.unsubscribe()
    }

  }, [])

  // --------------------------------------------------
  // SAIR
  // --------------------------------------------------

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Erro ao sair:', error)
    }

    setUser(null)
    setProfile(null)

    router.push('/login')
  }

  // --------------------------------------------------
  // ACESSO TOTAL
  // --------------------------------------------------

  const temAcessoTotal =
    profile?.role === 'dono_salao' ||
    (
      profile?.role === 'funcionario' &&
      profile?.nivel_acesso === 'total'
    )

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        temAcessoTotal,
        signOut,
        logout: signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}