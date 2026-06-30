'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import type { Profile } from '../supabase'

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const getProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data)
    } catch { setProfile(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (session?.user) await getProfile(session.user.id)
        else setLoading(false)
      } catch { if (mounted) setLoading(false) }
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' && session?.user) await getProfile(session.user.id)
      else if (event === 'SIGNED_OUT') { setProfile(null); setLoading(false) }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [getProfile])

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // helper para uso nas paginas: indica se o usuario logado tem acesso
  // total ao sistema do salao (dono_salao, ou funcionario socio/familiar)
  const temAcessoTotal =
    profile?.role === 'dono_salao' ||
    (profile?.role === 'funcionario' && profile?.acesso_total === true)

  return { profile, loading, logout, temAcessoTotal }
}
