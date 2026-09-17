import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatarDataHora(dataHora: string) {
  const data = new Date(dataHora)

  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(data)

  const get = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value || ''

  return {
    data: `${get('day')}/${get('month')}/${get('year')}`,
    hora: `${get('hour')}:${get('minute')}`,
  }
}

function substituirVariaveis(
  texto: string,
  dados: {
    cliente: string
    salao: string
    data: string
    hora: string
    servico: string
  }
) {
  return texto
    .replace(/\{cliente\}/gi, dados.cliente)
    .replace(/\{salao\}/gi, dados.salao)
    .replace(/\{data\}/gi, dados.data)
    .replace(/\{hora\}/gi, dados.hora)
    .replace(/\{servico\}/gi, dados.servico)
}

export async function POST(req: NextRequest) {
  const inicio = new Date()

  console.log('================================================')
  console.log('[lembretes] PROCESSADOR INICIADO')
  console.log('[lembretes] horário:', inicio.toISOString())
  console.log('================================================')

  try {
    /*
     * ============================================================
     * 1. BUSCA OS LEMBRETES PENDENTES
     * ============================================================
     */

    const agora = new Date().toISOString()

    const { data: lembretes, error: lembretesError } =
      await supabase
        .from('lembretes_agendamento_envios')
        .select(
          `
          id,
          salao_id,
          agendamento_id,
          cliente_id,
          config_id,
          agendamento_data_hora,
          enviar_em,
          status,
          erro
          `
        )
        .eq('status', 'pendente')
        .lte('enviar_em', agora)
        .order('enviar_em', { ascending: true })
        .limit(20)

    if (lembretesError) {
      console.error(
        '[lembretes] ERRO AO BUSCAR FILA:',
        lembretesError
      )

      return NextResponse.json(
        {
          ok: false,
          erro: lembretesError.message,
        },
        { status: 500 }
      )
    }

    console.log(
      '[lembretes] lembretes encontrados:',
      lembretes?.length || 0
    )

    if (!lembretes || lembretes.length === 0) {
      console.log('[lembretes] nenhuma mensagem pendente.')

      return NextResponse.json({
        ok: true,
        processados: 0,
        enviados: 0,
        erros: 0,
        mensagem: 'Nenhum lembrete pendente.',
      })
    }

    /*
     * ============================================================
     * 2. PROCESSA CADA LEMBRETE
     * ============================================================
     */

    let processados = 0
    let enviados = 0
    let erros = 0

    const resultados: any[] = []

    for (const lembrete of lembretes) {
      processados++

      console.log('------------------------------------------------')
      console.log(
        '[lembretes] processando:',
        lembrete.id
      )

      try {
        /*
         * ========================================================
         * 3. BUSCA CONFIGURAÇÃO DO LEMBRETE
         * ========================================================
         */

        const { data: config, error: configError } =
          await supabase
            .from('lembretes_agendamento_config')
            .select(
              `
              id,
              salao_id,
              antecedencia_minutos,
              ativo,
              titulo,
              mensagem,
              ordem
              `
            )
            .eq('id', lembrete.config_id)
            .maybeSingle()

        if (configError) {
          throw new Error(
            `Erro ao buscar configuração: ${configError.message}`
          )
        }

        if (!config) {
          throw new Error(
            'Configuração do lembrete não encontrada.'
          )
        }

        if (!config.ativo) {
          console.log(
            '[lembretes] configuração inativa:',
            config.id
          )

          resultados.push({
            id: lembrete.id,
            status: 'ignorado',
            motivo: 'Configuração inativa.',
          })

          continue
        }

        /*
         * ========================================================
         * 4. BUSCA O AGENDAMENTO
         * ========================================================
         */

        const { data: agendamento, error: agendamentoError } =
          await supabase
            .from('agendamentos')
            .select(
              `
              id,
              salao_id,
              cliente_id,
              servico_id,
              data_hora,
              status
              `
            )
            .eq('id', lembrete.agendamento_id)
            .maybeSingle()

        if (agendamentoError) {
          throw new Error(
            `Erro ao buscar agendamento: ${agendamentoError.message}`
          )
        }

        if (!agendamento) {
          throw new Error(
            'Agendamento não encontrado.'
          )
        }

        /*
         * ========================================================
         * 5. VERIFICA SE O AGENDAMENTO AINDA EXISTE
         * ========================================================
         */

        if (
          agendamento.status === 'cancelado' ||
          agendamento.status === 'cancelada'
        ) {
          console.log(
            '[lembretes] agendamento cancelado:',
            agendamento.id
          )

          await supabase
            .from('lembretes_agendamento_envios')
            .update({
              status: 'erro',
              erro: 'Agendamento cancelado antes do envio.',
              updated_at: new Date().toISOString(),
            })
            .eq('id', lembrete.id)

          resultados.push({
            id: lembrete.id,
            status: 'erro',
            motivo: 'Agendamento cancelado.',
          })

          erros++
          continue
        }

        /*
         * ========================================================
         * 6. BUSCA CLIENTE
         * ========================================================
         */

        const { data: cliente, error: clienteError } =
          await supabase
            .from('clientes')
            .select(
              `
              id,
              nome,
              profile_id
              `
            )
            .eq('id', agendamento.cliente_id)
            .maybeSingle()

        if (clienteError) {
          throw new Error(
            `Erro ao buscar cliente: ${clienteError.message}`
          )
        }

        if (!cliente) {
          throw new Error(
            'Cliente não encontrado.'
          )
        }

        /*
         * ========================================================
         * 7. BUSCA SALÃO
         * ========================================================
         */

        const { data: salao, error: salaoError } =
          await supabase
            .from('saloes')
            .select(
              `
              id,
              nome
              `
            )
            .eq('id', lembrete.salao_id)
            .maybeSingle()

        if (salaoError) {
          throw new Error(
            `Erro ao buscar salão: ${salaoError.message}`
          )
        }

        if (!salao) {
          throw new Error(
            'Salão não encontrado.'
          )
        }

        /*
         * ========================================================
         * 8. BUSCA SERVIÇO
         * ========================================================
         */

        const { data: servico, error: servicoError } =
          await supabase
            .from('servicos')
            .select(
              `
              id,
              nome
              `
            )
            .eq('id', agendamento.servico_id)
            .maybeSingle()

        if (servicoError) {
          throw new Error(
            `Erro ao buscar serviço: ${servicoError.message}`
          )
        }

        if (!servico) {
          throw new Error(
            'Serviço não encontrado.'
          )
        }

        /*
         * ========================================================
         * 9. FORMATA DATA E HORA
         * ========================================================
         */

        const dataHora = formatarDataHora(
          agendamento.data_hora
        )

        /*
         * ========================================================
         * 10. MONTA A MENSAGEM
         * ========================================================
         */

        const dados = {
          cliente: cliente.nome || 'cliente',
          salao: salao.nome || 'nosso salão',
          data: dataHora.data,
          hora: dataHora.hora,
          servico: servico.nome?.trim() || 'seu serviço',
        }

        const titulo = substituirVariaveis(
          config.titulo || 'Lembrete de agendamento',
          dados
        )

        const mensagem = substituirVariaveis(
          config.mensagem || '',
          dados
        )

        console.log(
          '[lembretes] destinatário:',
          cliente.profile_id
        )

        console.log(
          '[lembretes] título:',
          titulo
        )

        console.log(
          '[lembretes] mensagem:',
          mensagem
        )

        /*
         * ========================================================
         * 11. ENVIA PARA A ROTA EXISTENTE DE PUSH
         * ========================================================
         */

        const urlNotificar = new URL(
          '/api/notificar',
          req.url
        )

        console.log(
          '[lembretes] chamando:',
          urlNotificar.toString()
        )

        const respostaPush = await fetch(
          urlNotificar.toString(),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              salaoId: lembrete.salao_id,
              remetenteId: null,
              destinatarioId: cliente.profile_id,
              titulo,
              mensagem,
              tipo: 'lembrete_agendamento',
              url: '/cliente',
            }),
          }
        )

        let resultadoPush: any = null

        try {
          resultadoPush = await respostaPush.json()
        } catch {
          resultadoPush = null
        }

        console.log(
          '[lembretes] resposta do /api/notificar:',
          {
            status: respostaPush.status,
            resultado: resultadoPush,
          }
        )

        /*
         * ========================================================
         * 12. CONFIRMA SE O PUSH FOI REALMENTE ENVIADO
         * ========================================================
         */

        if (!respostaPush.ok) {
          throw new Error(
            resultadoPush?.erro ||
              `API de notificação retornou HTTP ${respostaPush.status}.`
          )
        }

        if (!resultadoPush?.pushEnviado) {
          const motivo =
            resultadoPush?.motivo ||
            'Nenhuma subscription disponível para o cliente.'

          console.log(
            '[lembretes] PUSH NÃO ENVIADO:',
            motivo
          )

          /*
           * Mantemos como pendente.
           *
           * Assim, se a cliente ainda não tiver o Push
           * habilitado, não marcamos como "enviado" falsamente.
           */
          await supabase
            .from('lembretes_agendamento_envios')
            .update({
              erro: motivo,
              updated_at: new Date().toISOString(),
            })
            .eq('id', lembrete.id)

          resultados.push({
            id: lembrete.id,
            status: 'pendente',
            pushEnviado: false,
            motivo,
          })

          continue
        }

        /*
         * ========================================================
         * 13. MARCA COMO ENVIADO
         * ========================================================
         */

        const agoraEnvio = new Date().toISOString()

        const { error: updateError } =
          await supabase
            .from('lembretes_agendamento_envios')
            .update({
              status: 'enviado',
              enviado_em: agoraEnvio,
              erro: null,
              updated_at: agoraEnvio,
            })
            .eq('id', lembrete.id)
            .eq('status', 'pendente')

        if (updateError) {
          throw new Error(
            `Push enviado, mas não foi possível atualizar a fila: ${updateError.message}`
          )
        }

        enviados++

        resultados.push({
          id: lembrete.id,
          status: 'enviado',
          pushEnviado: true,
          cliente: cliente.nome,
          agendamento: agendamento.id,
        })

        console.log(
          '[lembretes] ✅ LEMBRETE ENVIADO:',
          lembrete.id
        )
      } catch (error: any) {
        erros++

        const mensagemErro =
          error?.message ||
          'Erro desconhecido ao processar lembrete.'

        console.error(
          '[lembretes] ❌ ERRO NO LEMBRETE:',
          lembrete.id,
          mensagemErro
        )

        /*
         * ========================================================
         * 14. REGISTRA O ERRO
         * ========================================================
         */

        const { error: updateError } =
          await supabase
            .from('lembretes_agendamento_envios')
            .update({
              status: 'erro',
              erro: mensagemErro,
              updated_at: new Date().toISOString(),
            })
            .eq('id', lembrete.id)

        if (updateError) {
          console.error(
            '[lembretes] erro ao registrar erro na fila:',
            updateError
          )
        }

        resultados.push({
          id: lembrete.id,
          status: 'erro',
          erro: mensagemErro,
        })
      }
    }

    /*
     * ============================================================
     * 15. RESULTADO FINAL
     * ============================================================
     */

    const fim = new Date()

    console.log('================================================')
    console.log('[lembretes] PROCESSADOR FINALIZADO')
    console.log('[lembretes] processados:', processados)
    console.log('[lembretes] enviados:', enviados)
    console.log('[lembretes] erros:', erros)
    console.log(
      '[lembretes] duração:',
      fim.getTime() - inicio.getTime(),
      'ms'
    )
    console.log('================================================')

    return NextResponse.json({
      ok: true,
      processados,
      enviados,
      erros,
      resultados,
    })
  } catch (error: any) {
    console.error(
      '[lembretes] ERRO GERAL DO PROCESSADOR:',
      error
    )

    return NextResponse.json(
      {
        ok: false,
        erro:
          error?.message ||
          'Erro interno no processador de lembretes.',
      },
      { status: 500 }
    )
  }
}
