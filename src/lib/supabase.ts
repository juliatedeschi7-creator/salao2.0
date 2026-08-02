// @ts-nocheck
'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  nome: string
  email?: string
  role?: string
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

    // Timer de segurança para evitar qualquer travamento infinito de carregamento
    const safetyTimer = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false)
      }
    }, 2000)

    async function carregarUsuario() {
      try {
        // Com @supabase/ssr, getUser() é mais seguro e valida o cookie no servidor/cliente
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()

        if (!isMounted) return

        if (error || !currentUser) {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        setUser(currentUser)

        // Busca o perfil correspondente
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (isMounted) {
          setProfile(profData || { id: currentUser.id, nome: currentUser.email?.split('@')[0] || 'Usuário' })
        }
      } catch (err) {
        console.error('Erro ao carregar usuário:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
          clearTimeout(safetyTimer)
        }
      }
    }

    carregarUsuario()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()
        
        if (isMounted) {
          setProfile(profData || { id: currentUser.id, nome: currentUser.email?.split('@')[0] || 'Usuário' })
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
