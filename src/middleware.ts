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

  const { data: { user } } = await supabase.auth.getUser()
  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // 1. Rotas públicas que qualquer um pode acessar (inclusive deslogados)
  const isPublicRoute = pathname === '/login' || pathname === '/cadastro' || pathname === '/'

  if (!user && !isPublicRoute) {
    // Se não estiver logado e tentar acessar rota protegida, manda para o login
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Se já estiver logado e tentar ir para o login, redireciona para a home/dashboard
    if (pathname === '/login' || pathname === '/cadastro') {
      url.pathname = '/dashboard' // ou a rota padrão pós-login
      return NextResponse.redirect(url)
    }

    // 2. Lógica opcional para separar Funcionário de Cliente (se houver rotas exclusivas)
    // Exemplo: se o funcionário tentar entrar numa rota de cliente ou vice-versa
    // Você pode buscar o perfil do usuário aqui se precisar de controle estrito por cargo:
    /*
    const { data: profile } = await supabase
      .from('profiles')
      .ехаmple('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'client' && pathname.startsWith('/funcionario')) {
      url.pathname = '/cliente/dashboard'
      return NextResponse.redirect(url)
    }
    */
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
