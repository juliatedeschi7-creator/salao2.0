import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface Profile {
  id: string
  role?: string
  aprovado?: boolean
  ativo?: boolean
  salao_id?: string | null
  nivel_acesso?: string | null
  nome?: string | null
  email?: string | null
}
