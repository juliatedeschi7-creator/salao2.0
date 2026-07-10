import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // IMPORTANTE: sem isso, o @supabase/ssr grava o cookie de sessão
      // sem "maxAge" — vira um cookie de sessão do navegador (dura até
      // a "sessão de navegação" acabar). No iOS, quando o app vai pro
      // background, o sistema costuma matar o processo do WKWebView do
      // PWA pra liberar memória, e isso conta como fim da sessão pro
      // WebKit — apagando o cookie. Ao reabrir, a sessão já não existe
      // mais de verdade (não é um bug no useAuth, o cookie mesmo sumiu).
      //
      // Definindo maxAge explícito, o cookie persiste em disco e
      // sobrevive ao app ser fechado/kilado pelo sistema.
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 100, // 100 dias
        sameSite: 'lax',
        secure: true,
        path: '/',
      },
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