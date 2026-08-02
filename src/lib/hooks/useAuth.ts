// @ts-nocheck
'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  nome: string
  email?: string
  tipo?: string
  salao_id?: string
}

interface AuthContextType {
  user: any | null
  profile: Profile | null
  loading: boolean
  temAcessoTotal: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  temAcessoTotal: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    // GARANTIA DE SEGURANÇA: Se por qualquer motivo o banco demorar mais de 2.5s, destrava o loading
    const safetyTimer = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('⚠️ Auth timeout acionado: destravando carregamento forçadamente.')
        setLoading(false)
      }
    }, 2500)

    async function carregarSessao() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Erro na sessão:', sessionError.message)
        }

        if (!isMounted) return

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          try {
            const { data: prof, error: profError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle()

            if (!profError && prof) {
              if (isMounted) setProfile(prof)
            } else {
              console.warn('Perfil não encontrado na tabela profiles para:', currentUser.id)
              if (isMounted) setProfile({ id: currentUser.id, nome: currentUser.email?.split('@')[0] || 'Usuário' })
            }
          } catch (dbErr) {
            console.error('Erro ao buscar perfil no Supabase:', dbErr)
            if (isMounted) setProfile(null)
          }
        } else {
          if (isMounted) setProfile(null)
        }
      } catch (error) {
        console.error('Erro geral ao carregar sessão:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
          clearTimeout(safetyTimer)
        }
      }
    }

    carregarSessao()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return

      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle()
          
          if (isMounted) {
            setProfile(prof || { id: currentUser.id, nome: currentUser.email?.split('@')[0] || 'Usuário' })
          }
        } catch (e) {
          if (isMounted) setProfile(null)
        }
      } else {
        if (isMounted) setProfile(null)
      }
      if (isMounted) {
        setLoading(false)
        clearTimeout(safetyTimer)
      }
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      // ignora
    }
    setUser(null)
    setProfile(null)
    router.push('/login')
  }

  const temAcessoTotal = true

  return React.createElement(
    AuthContext.Provider,
    { value: { user, profile, loading, temAcessoTotal, signOut } },
    children
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
