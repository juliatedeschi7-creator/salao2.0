import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Importante: usar getUser() para validar a sessão no servidor com segurança
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const isAuthPage = url.pathname.startsWith('/login') || url.pathname.startsWith('/auth')
  const isPublicPage = url.pathname === '/' || isAuthPage

  // Se o usuário NÃO está logado e tenta acessar uma rota protegida, joga para o login
  if (!user && !isPublicPage) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se o usuário JÁ está logado e tenta ir para a tela de login, joga para o dashboard/painel
  if (user && isAuthPage) {
    url.pathname = '/dashboard' // Altere para a rota principal do seu app se for diferente
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
}
