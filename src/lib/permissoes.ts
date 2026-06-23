import type { Profile } from '@/lib/supabase'

export function temAcessoTotal(profile: Profile | null): boolean {
  if (!profile) return false
  if (profile.role === 'dono_salao') return true
  if (profile.role === 'funcionario' && (profile as any).acesso_total) return true
  return false
}

export function ehAdminGeral(profile: Profile | null): boolean {
  return profile?.role === 'admin_geral'
}
