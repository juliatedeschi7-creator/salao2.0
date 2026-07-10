import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Aplica os cookies atualizados tanto na requisição (pro resto
          // do pipeline enxergar) quanto na resposta (pro navegador salvar)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Chamar getUser() aqui é o que efetivamente dispara a renovação do
  // token quando ele está perto de expirar. Isso acontece no servidor,
  // antes da página carregar — então quando o PWA volta do background
  // (ou o processo foi kilado e reaberto), a primeira requisição já
  // chega com um cookie de sessão renovado, sem depender de nada
  // rodando no navegador.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}