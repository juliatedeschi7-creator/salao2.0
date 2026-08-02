import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface Profile {
  id: string
  role: 'admin_geral' | 'dono_salao' | 'funcionario' | 'cliente'
  aprovado: boolean
  ativo: boolean
  salao_id?: string | null
  nivel_acesso?: 'total' | 'restrito' | string | null
  nome?: string | null
  email?: string | null
}
