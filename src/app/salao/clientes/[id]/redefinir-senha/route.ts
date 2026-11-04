
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('Variáveis do Supabase não configuradas.')
      return NextResponse.json(
        { error: 'Configuração administrativa indisponível.' },
        { status: 500 }
      )
    }

    const cookieStore = cookies()

    // Verifica a sessão real de quem está solicitando.
    const supabaseAuth = createServerClient(
      supabaseUrl,
      anonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch {
              // Cookies podem não permitir escrita neste contexto.
            }
          },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Sua sessão expirou. Entre novamente.' },
        { status: 401 }
      )
    }

    // Cliente administrativo: utilizado exclusivamente no servidor.
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Confere as permissões de quem está solicitando.
    const { data: solicitante, error: erroPerfil } =
      await supabaseAdmin
        .from('profiles')
        .select('id, role, salao_id, nivel_acesso, ativo, excluido')
        .eq('id', user.id)
        .maybeSingle()

    if (erroPerfil || !solicitante) {
      return NextResponse.json(
        { error: 'Não foi possível validar seu perfil.' },
        { status: 403 }
      )
    }

    const temPermissao =
      solicitante.role === 'dono_salao' ||
      (
        solicitante.role === 'funcionario' &&
        solicitante.nivel_acesso === 'total'
      )

    if (
      !temPermissao ||
      !solicitante.salao_id ||
      solicitante.ativo === false ||
      solicitante.excluido === true
    ) {
      return NextResponse.json(
        { error: 'Você não tem permissão para esta operação.' },
        { status: 403 }
      )
    }

    // Confere se a cliente pertence ao salão do solicitante.
    const { data: cliente, error: erroCliente } =
      await supabaseAdmin
        .from('clientes')
        .select('id, salao_id, profile_id')
        .eq('id', params.id)
        .eq('salao_id', solicitante.salao_id)
        .maybeSingle()

    if (erroCliente || !cliente || !cliente.profile_id) {
      return NextResponse.json(
        { error: 'Cliente não encontrada ou sem conta vinculada.' },
        { status: 404 }
      )
    }

    // Confere se a conta vinculada realmente é de uma cliente.
    const { data: perfilCliente, error: erroPerfilCliente } =
      await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', cliente.profile_id)
        .maybeSingle()

    if (
      erroPerfilCliente ||
      !perfilCliente ||
      perfilCliente.role !== 'cliente'
    ) {
      return NextResponse.json(
        { error: 'A conta vinculada não é uma conta de cliente.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const senha = body?.senha

    if (
      typeof senha !== 'string' ||
      senha.length < 8 ||
      senha.length > 128
    ) {
      return NextResponse.json(
        { error: 'A senha deve ter entre 8 e 128 caracteres.' },
        { status: 400 }
      )
    }

    // Redefine a senha diretamente no Supabase Auth.
    const { error: erroAtualizacao } =
      await supabaseAdmin.auth.admin.updateUserById(
        cliente.profile_id,
        { password: senha }
      )

    if (erroAtualizacao) {
      console.error(
        'Erro ao redefinir senha:',
        erroAtualizacao.message
      )

      return NextResponse.json(
        { error: 'Não foi possível redefinir a senha.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Senha temporária definida com sucesso.',
    })

  } catch (error) {
    console.error('Erro na redefinição de senha:', error)

    return NextResponse.json(
      { error: 'Ocorreu um erro ao processar a solicitação.' },
      { status: 500 }
    )
  }
}
