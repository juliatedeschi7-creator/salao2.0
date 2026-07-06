import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      }
    }
  )
}

export const supabase = createClient()

export type UserRole = 'admin_geral' | 'dono_salao' | 'funcionario' | 'cliente'

export interface Profile {
  id: string
  email: string
  nome: string
  role: UserRole
  aprovado: boolean
  ativo: boolean
  salao_id?: string | null
  acesso_total?: boolean
}

export interface Salao {
  id: string
  nome: string
  slug: string
  telefone?: string
  instagram?: string
  cidade?: string
  dono_id: string
  cor_primaria: string
  cor_secundaria: string
  ativo: boolean
  pausado: boolean
  aprovado: boolean
  motivo_pausa?: string
  horario_abertura: string
  horario_fechamento: string
  dias_funcionamento: string[]
  created_at: string
}
