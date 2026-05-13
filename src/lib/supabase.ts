import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'admin_geral' | 'dono_salao' | 'funcionario' | 'cliente'

export interface UserProfile {
  id: string
  email: string
  nome: string
  role: UserRole
  salao_id?: string
  avatar_url?: string
  aprovado: boolean
  created_at: string
}

export interface Salao {
  id: string
  nome: string
  slug: string
  descricao?: string
  telefone?: string
  endereco?: string
  logo_url?: string
  dono_id: string
  ativo: boolean
  created_at: string
}
