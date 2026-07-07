'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import type { Profile } from '../supabase'

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRef = useRef<Profile | null>(null)
  const tentandoRef = useRef(false)

  const getProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      profileRef.current = data
      setProfile(data)
    } catch {
      // Erro de rede/transiente: NÃO apaga o profile que já estava carregado.
      // Só fica sem profile se realmente nunca conseguiu carregar um.
      if (!profileRef.current) setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const restaurarSessao = useCallback(async () => {
    if (tentandoRef.current) return
    tentandoRef.current = true
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (session?.user) {
        await getProfile(session.user.id)
      } else if (error) {
        // erro de rede ao checar sessão: mantém o que já tinha, não desloga
        setLoading(false)
      } else {
        // sem sessão mesmo (realmente deslogado)
        profileRef.current = null
        setProfile(null)
        setLoading(false)
      }
    } catch {
      setLoading(false)
    } finally {
      tentandoRef.current = false
    }
  }, [getProfile])

  useEffect(() => {
    let mounted = true

    async function init() {
      if (!mounted) return
      await restaurarSessao()
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' && session?.user) {
        await getProfile(session.user.id)
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        await getProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        profileRef.current = null
        setProfile(null)
        setLoading(false)
      }
    })

    // Quando o PWA volta a ficar visível (reaberto do background/recentes),
    // tenta restaurar a sessão de novo em vez de assumir "deslogado" na
    // primeira falha — dá tempo da conexão de rede voltar.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        restaurarSessao()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onVisibilityChange)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onVisibilityChange)
    }
  }, [getProfile, restaurarSessao])

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