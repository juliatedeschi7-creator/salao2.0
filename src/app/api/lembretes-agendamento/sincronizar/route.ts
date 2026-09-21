import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // =========================================================
    // 0. VALIDAR CRON_SECRET
    // =========================================================

    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error(
        '[lembretes/sincronizar] CRON_SECRET não configurado.'
      )

      return NextResponse.json(
        {
          ok: false,
          erro: 'CRON_SECRET não configurado no ambiente.'
        },
        { status: 500 }
      )
    }

    const authorization =
      req.headers.get('authorization') || ''

    const esperado = `Bearer ${cronSecret}`

    if (authorization !== esperado) {
      console.warn(
        '[lembretes/sincronizar] acesso não autorizado.'
      )

      return NextResponse.json(
        {
          ok: false,
          erro: 'Não autorizado.'
        },
        { status: 401 }
      )
    }

    // =========================================================
    // 1. CONFIGURAÇÕES DO SUPABASE
    // =========================================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          erro: 'Variáveis do Supabase não configuradas.'
        },
        { status: 500 }
      )
    }

    /*
     * Esta rotina roda no servidor.
     * Usamos a Service Role porque ela precisa consultar
     * os dados dos salões e dos agendamentos.
     */

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const agora = new Date()

    console.log(
      '[lembretes/sincronizar] iniciando:',
      agora.toISOString()
    )

    // =========================================================
    // 2. BUSCAR CONFIGURAÇÕES ATIVAS DE LEMBRETES
    // =========================================================

    const { data: configuracoes, error: erroConfigs } =
      await supabase
        .from('lembretes_agendamento_config')
        .select(`
          id,
          salao_id,
          antecedencia_minutos,
          ativo,
          titulo,
          mensagem,
          ordem
        `)
        .eq('ativo', true)
        .order('salao_id', { ascending: true })
        .order('ordem', { ascending: true })

    if (erroConfigs) {
      console.error(
        '[lembretes/sincronizar] erro ao buscar configurações:',
        erroConfigs
      )

      return NextResponse.json(
        {
          ok: false,
          erro: erroConfigs.message
        },
        { status: 500 }
      )
    }

    if (!configuracoes || configuracoes.length === 0) {
      return NextResponse.json({
        ok: true,
        mensagem:
          'Nenhuma configuração ativa de lembrete encontrada.',
        configuracoes: 0,
        agendamentos: 0,
        criados: 0
      })
    }

    // =========================================================
    // 3. PEGAR OS SALÕES QUE POSSUEM CONFIGURAÇÕES ATIVAS
    // =========================================================

    const saloesIds = [
      ...new Set(
        configuracoes
          .map(config => config.salao_id)
          .filter(Boolean)
      )
    ]

    // =========================================================
    // 4. BUSCAR AGENDAMENTOS FUTUROS
    //
    // Somente "confirmado" entra nesta primeira versão.
    // =========================================================

    const { data: agendamentos, error: erroAgendamentos } =
      await supabase
        .from('agendamentos')
        .select(`
          id,
          salao_id,
          cliente_id,
          data_hora,
          status
        `)
        .in('salao_id', saloesIds)
        .eq('status', 'confirmado')
        .gt('data_hora', agora.toISOString())
        .order('data_hora', { ascending: true })

    if (erroAgendamentos) {
      console.error(
        '[lembretes/sincronizar] erro ao buscar agendamentos:',
        erroAgendamentos
      )

      return NextResponse.json(
        {
          ok: false,
          erro: erroAgendamentos.message
        },
        { status: 500 }
      )
    }

    if (!agendamentos || agendamentos.length === 0) {
      return NextResponse.json({
        ok: true,
        mensagem:
          'Nenhum agendamento futuro confirmado encontrado.',
        configuracoes: configuracoes.length,
        agendamentos: 0,
        criados: 0
      })
    }

    // =========================================================
    // 5. GERAR OS REGISTROS DE ENVIO
    // =========================================================

    const registros = []

    for (const agendamento of agendamentos) {
      if (!agendamento.id) continue
      if (!agendamento.salao_id) continue
      if (!agendamento.cliente_id) continue
      if (!agendamento.data_hora) continue

      const configsDoSalao =
        configuracoes.filter(
          config =>
            config.salao_id ===
            agendamento.salao_id
        )

      for (const config of configsDoSalao) {
        if (!config.id) continue
        if (!config.antecedencia_minutos) continue

        const dataAgendamento =
          new Date(agendamento.data_hora)

        if (
          Number.isNaN(
            dataAgendamento.getTime()
          )
        ) {
          continue
        }

        const enviarEm =
          new Date(
            dataAgendamento.getTime() -
            Number(
              config.antecedencia_minutos
            ) *
              60 *
              1000
          )

        registros.push({
          salao_id:
            agendamento.salao_id,

          agendamento_id:
            agendamento.id,

          cliente_id:
            agendamento.cliente_id,

          config_id:
            config.id,

          agendamento_data_hora:
            dataAgendamento.toISOString(),

          enviar_em:
            enviarEm.toISOString(),

          status: 'pendente'
        })
      }
    }

    if (registros.length === 0) {
      return NextResponse.json({
        ok: true,
        mensagem:
          'Nenhum lembrete precisou ser criado.',
        configuracoes:
          configuracoes.length,
        agendamentos:
          agendamentos.length,
        criados: 0
      })
    }

    // =========================================================
    // 6. SALVAR
    //
    // A tabela possui índice único:
    // (agendamento_id, config_id)
    //
    // Portanto, podemos usar upsert sem duplicar.
    // =========================================================

    const {
      data: registrosSalvos,
      error: erroInsert
    } = await supabase
      .from('lembretes_agendamento_envios')
      .upsert(
        registros,
        {
          onConflict:
            'agendamento_id,config_id',
          ignoreDuplicates: true
        }
      )
      .select(`
        id,
        agendamento_id,
        cliente_id,
        config_id,
        agendamento_data_hora,
        enviar_em,
        status
      `)

    if (erroInsert) {
      console.error(
        '[lembretes/sincronizar] erro ao criar lembretes:',
        erroInsert
      )

      return NextResponse.json(
        {
          ok: false,
          erro: erroInsert.message
        },
        { status: 500 }
      )
    }

    console.log(
      '[lembretes/sincronizar] concluído:',
      {
        configuracoes:
          configuracoes.length,
        agendamentos:
          agendamentos.length,
        encontrados:
          registros.length,
        salvos:
          registrosSalvos?.length || 0
      }
    )

    return NextResponse.json({
      ok: true,

      mensagem:
        'Lembretes de agendamento sincronizados com sucesso.',

      configuracoes:
        configuracoes.length,

      agendamentos:
        agendamentos.length,

      encontrados:
        registros.length,

      salvos:
        registrosSalvos?.length || 0
    })

  } catch (erro: any) {
    console.error(
      '[lembretes/sincronizar] erro inesperado:',
      erro
    )

    return NextResponse.json(
      {
        ok: false,
        erro:
          erro?.message ||
          'Erro inesperado ao sincronizar lembretes.'
      },
      { status: 500 }
    )
  }
}