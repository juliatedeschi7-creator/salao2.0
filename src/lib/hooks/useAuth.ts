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

    async function carregarSessao() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return

        setUser(session?.user ?? null)

        if (session?.user) {
          const { data: prof, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (!error && prof) {
            setProfile(prof)
          } else {
            console.warn('Perfil não encontrado para o usuário:', session.user.id)
            setProfile(null)
          }
        }
      } catch (error) {
        console.error('Erro ao carregar sessão:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    carregarSessao()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return

      setUser(session?.user ?? null)
      if (session?.user) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()
          if (isMounted) setProfile(prof || null)
        } catch (e) {
          if (isMounted) setProfile(null)
        }
      } else {
        if (isMounted) setProfile(null)
      }
      if (isMounted) setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
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
