import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Atualiza/Verifica a sessão do usuário de forma segura no servidor
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // 1. Definição de rotas totalmente públicas
  const isPublicRoute = 
    pathname === '/login' || 
    pathname === '/cadastro' || 
    pathname === '/' ||
    pathname.startsWith('/auth')

  // 2. Se o usuário NÃO está logado e tenta acessar uma rota privada -> Manda pro Login
  if (!user && !isPublicRoute) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 3. Se o usuário JÁ ESTÁ logado e tenta acessar a tela de Login -> Tira ele dali e manda para o painel
  if (user && pathname === '/login') {
    // Como você tem múltiplos perfis, mandamos para uma rota coringa ou padrão pós-login
    // Opcionalmente, você pode mandar para a home geral e o painel decide, ou redirecionar para /cliente por segurança
    url.pathname = '/cliente' 
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
