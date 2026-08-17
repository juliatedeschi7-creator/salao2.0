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

    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 1500)

    async function carregarSessao() {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()
        
        if (error || !currentUser) {
          if (isMounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        setUser(currentUser)

        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (isMounted) {
          setProfile(prof || { id: currentUser.id, nome: currentUser.email?.split('@')[0] || 'Usuário' })
          setLoading(false)
          clearTimeout(safetyTimer)
        }
      } catch (e) {
        console.error('Erro ao carregar sessão:', e)
        if (isMounted) setLoading(false)
      }
    }

    carregarSessao()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return
      
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (currentUser) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()
        
        if (isMounted) {
          setProfile(prof || { id: currentUser.id, nome: currentUser.email?.split('@')[0] || 'Usuário' })
        }
      } else {
        if (isMounted) setProfile(null)
      }
      
      if (isMounted) setLoading(false)
      clearTimeout(safetyTimer)
    })

    return () => { 
      isMounted = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe() 
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push('/login')
  }

  const temAcessoTotal =
    profile?.role === 'dono_salao' ||
    (profile?.role === 'funcionario' && profile?.nivel_acesso === 'total')

  return (
    <AuthContext.Provider 
      value={{ user, profile, loading, temAcessoTotal, signOut, logout: signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
