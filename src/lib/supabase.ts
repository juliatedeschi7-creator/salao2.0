import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Adicione esta interface para o TypeScript parar de reclamar no build
export interface Profile {
  id: string
  role: 'admin_geral' | 'dono_salao' | 'funcionario' | 'cliente'
  aprovado: boolean
  ativo: boolean
  salao_id?: string | null
  nivel_acesso?: 'total' | 'parcial' | string | null
  nome?: string | null
  email?: string | null
}
