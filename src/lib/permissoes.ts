import type { Profile } from './supabase'

export function temAcessoTotal(profile: Profile | null | undefined): boolean {
  if (!profile) return false
  return (
    profile.role === 'dono_salao' ||
    (profile.role === 'funcionario' && (profile as any).nivel_acesso === 'total')
  )
}
