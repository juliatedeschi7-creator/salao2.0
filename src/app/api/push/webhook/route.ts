// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  PushTemplates,
  dispararParaPerfil
} from '@/lib/push'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      table,
      type,
      record,
      old_record
    } = body

    console.log(
      `[Webhook] Evento recebido na tabela "${table}" (Tipo: ${type})`
    )

    const donoId =
      record?.dono_id ||
      record?.salao_id ||
      record?.profile_id

    // ==========================================
    // 1. AGENDAMENTOS / PEDIDOS DE HORÁRIO
    // ==========================================
    if (
      table === 'appointments' ||
      table === 'agendamentos' ||
      table === 'solicitacoes_agendamento'
    ) {
      if (type === 'INSERT') {
        const payload =
          PushTemplates.novoAgendamento
            ? PushTemplates.novoAgendamento(
                record.cliente_nome ||
                  record.nome ||
                  'Um cliente',
                record.servico_nome ||
                  'Serviço',
                record.data_hora ||
                  record.data
              )
            : {
                title: 'Novo Agendamento',
                body: 'Novo horário solicitado.'
              }

        await dispararParaPerfil(
          donoId,
          payload
        )
      }

      if (
        type === 'UPDATE' &&
        old_record?.status === 'pendente' &&
        record.status === 'confirmado'
      ) {
        if (
          typeof PushTemplates.agendamentoConfirmadoCliente ===
          'function'
        ) {
          const payload =
            PushTemplates.agendamentoConfirmadoCliente(
              record.servico_nome ||
                'Serviço',
              record.data_hora ||
                record.data
            )

          // Se for para o cliente,
          // ajuste o ID do receptor se necessário.
        }
      }
    }

    // ==========================================
    // 2. CLIENTES
    // ==========================================
    if (table === 'clientes') {

      // Nova cliente cadastrada
      if (type === 'INSERT') {
        const payload = {
          title: '✨ Nova Cliente Cadastrada',
          body:
            `A cliente ${record.nome || 'Nova Cliente'} ` +
            `acabou de ser cadastrada.`,
          url: '/salao/clientes'
        }

        await dispararParaPerfil(
          donoId,
          payload
        )
      }

      // Mesclagem de contatos
      //
      // Alterações simples como:
      // - nome
      // - acento
      // - telefone
      // - email
      // etc.
      //
      // NÃO geram Push.
      if (
        type === 'UPDATE' &&
        record.is_merged === true &&
        !old_record?.is_merged
      ) {
        const payload = {
          title: '🔄 Contatos Mesclados',
          body:
            `Os registros da cliente ` +
            `${record.nome || ''} foram mesclados.`,
          url: '/salao/clientes'
        }

        await dispararParaPerfil(
          donoId,
          payload
        )
      }
    }

    // ==========================================
    // 3. CONTAS DOS CLIENTES / FINANCEIRO
    // ==========================================
    if (table === 'contas_clientes') {

      // ------------------------------------------
      // NOVA CONTA
      // ------------------------------------------
      if (type === 'INSERT') {

        console.log(
          '[Webhook][Financeiro] Nova conta criada',
          {
            contaId: record.id,
            clienteId: record.cliente_id,
            tipo: record.tipo,
            valor: record.valor
          }
        )

        // cliente_id é o ID da tabela clientes.
        // O Push precisa do profile_id.
        const {
          data: cliente,
          error: clienteError
        } = await supabaseAdmin
          .from('clientes')
          .select(
            'id, profile_id, nome'
          )
          .eq(
            'id',
            record.cliente_id
          )
          .maybeSingle()

        if (clienteError) {
          console.error(
            '[Webhook][Financeiro] Erro ao buscar cliente:',
            clienteError
          )
        }

        if (!cliente?.profile_id) {
          console.log(
            '[Webhook][Financeiro] Cliente sem profile_id. Push não enviado.',
            {
              clienteId:
                record.cliente_id
            }
          )
        } else {

          // Buscar nome do salão
          let nomeSalao =
            'O salão'

          if (record.salao_id) {
            const {
              data: salao
            } = await supabaseAdmin
              .from('saloes')
              .select('nome')
              .eq(
                'id',
                record.salao_id
              )
              .maybeSingle()

            if (salao?.nome) {
              nomeSalao =
                salao.nome
            }
          }

          let payload = null

          // NOVO DÉBITO
          if (
            record.tipo === 'debito'
          ) {
            payload = {
              title:
                'Novo valor na sua conta',
              body:
                `${nomeSalao} adicionou ` +
                `R$ ${Number(record.valor || 0)
                  .toFixed(2)
                  .replace('.', ',')} ` +
                `referente a: ` +
                `${record.descricao || 'Serviço'}.`,
              url: '/cliente'
            }
          }

          // NOVO CRÉDITO
          if (
            record.tipo === 'credito'
          ) {
            payload = {
              title:
                'Crédito adicionado',
              body:
                `R$ ${Number(record.valor || 0)
                  .toFixed(2)
                  .replace('.', ',')} ` +
                `de crédito foi adicionado ` +
                `em ${nomeSalao}.` +
                (
                  record.descricao
                    ? ` ${record.descricao}.`
                    : ''
                ),
              url: '/cliente'
            }
          }

          if (payload) {
            console.log(
              '[Webhook][Financeiro] Enviando Push de nova conta para:',
              cliente.profile_id
            )

            await dispararParaPerfil(
              cliente.profile_id,
              payload
            )

            console.log(
              '[Webhook][Financeiro] Push de nova conta processado'
            )
          }
        }
      }

      // ------------------------------------------
      // PAGAMENTO REGISTRADO
      // ------------------------------------------
      //
      // Um pagamento altera normalmente:
      // - valor_pago
      // - status
      // - meio_pagamento
      // - data_pagamento
      // - ultimo_pagamento
      //
      // Não vamos notificar qualquer UPDATE.
      //
      // Só notificamos quando o valor_pago realmente aumenta.
      // Assim, edições simples não geram Push.
      if (type === 'UPDATE') {

        const valorPagoAnterior =
          Number(
            old_record?.valor_pago || 0
          )

        const valorPagoAtual =
          Number(
            record?.valor_pago || 0
          )

        const valorPagamentoAgora =
          valorPagoAtual -
          valorPagoAnterior

        const pagamentoRegistrado =
          valorPagamentoAgora > 0

        if (!pagamentoRegistrado) {
          console.log(
            '[Webhook][Financeiro] UPDATE sem novo pagamento. Nenhum Push será enviado.',
            {
              contaId: record.id,
              valorPagoAnterior,
              valorPagoAtual
            }
          )
        } else {

          console.log(
            '[Webhook][Financeiro] Novo pagamento detectado',
            {
              contaId: record.id,
              clienteId: record.cliente_id,
              valorAnterior:
                valorPagoAnterior,
              valorAtual:
                valorPagoAtual,
              valorPagamentoAgora
            }
          )

          // Buscar profile_id da cliente
          const {
            data: cliente,
            error: clienteError
          } = await supabaseAdmin
            .from('clientes')
            .select(
              'id, profile_id, nome'
            )
            .eq(
              'id',
              record.cliente_id
            )
            .maybeSingle()

          if (clienteError) {
            console.error(
              '[Webhook][Financeiro] Erro ao buscar cliente para pagamento:',
              clienteError
            )
          }

          if (!cliente?.profile_id) {
            console.log(
              '[Webhook][Financeiro] Cliente sem profile_id. Push de pagamento não enviado.',
              {
                clienteId:
                  record.cliente_id
              }
            )
          } else {

            const valorFormatado =
              `R$ ${valorPagamentoAgora
                .toFixed(2)
                .replace('.', ',')}`

            let mensagem =
              `Pagamento de ${valorFormatado} ` +
              `foi registrado na sua conta.`

            if (
              record.meio_pagamento
            ) {
              const meios: Record<
                string,
                string
              > = {
                pix: 'Pix',
                dinheiro: 'dinheiro',
                cartao_credito:
                  'cartão de crédito',
                cartao_debito:
                  'cartão de débito',
                transferencia:
                  'transferência'
              }

              const meio =
                meios[
                  record.meio_pagamento
                ] ||
                record.meio_pagamento

              mensagem +=
                ` Forma de pagamento: ${meio}.`
            }

            const payload = {
              title:
                'Pagamento confirmado',
              body: mensagem,
              url: '/cliente'
            }

            console.log(
              '[Webhook][Financeiro] Enviando Push de pagamento para:',
              cliente.profile_id
            )

            await dispararParaPerfil(
              cliente.profile_id,
              payload
            )

            console.log(
              '[Webhook][Financeiro] Push de pagamento processado'
            )
          }
        }
      }
    }

    // ==========================================
    // 4. ORÇAMENTOS
    // ==========================================
    if (
      table === 'budgets' ||
      table === 'orcamentos'
    ) {
      if (
        type === 'UPDATE' &&
        old_record?.status === 'pendente' &&
        record.status === 'pronto'
      ) {
        if (
          typeof PushTemplates.orcamentoProntoCliente ===
          'function'
        ) {
          const payload =
            PushTemplates.orcamentoProntoCliente(
              record.servico_nome ||
                'Serviço solicitado'
            )

          // Enviar para o cliente
        }
      }
    }

    // ==========================================
    // 5. FICHA DE ANAMNESE
    // ==========================================
    if (
      table === 'anamneses' ||
      table === 'fichas_anamnese'
    ) {

      if (
        type === 'INSERT' &&
        record.status === 'pendente'
      ) {
        // Enviar para o cliente preencher
      }

      if (
        type === 'UPDATE' &&
        old_record?.status === 'pendente' &&
        record.status === 'respondido'
      ) {
        const payload = {
          title:
            '📋 Anamnese Respondida',
          body:
            `A cliente ${
              record.cliente_nome ||
              'Uma cliente'
            } respondeu à ficha de anamnese.`,
          url: '/salao/clientes'
        }

        await dispararParaPerfil(
          donoId,
          payload
        )
      }
    }

    // ==========================================
    // 6. FOTOS DE EVOLUÇÃO
    // ==========================================
    if (
      table === 'evolucoes' ||
      table === 'evolucoes_fotos'
    ) {
      if (type === 'INSERT') {
        // Notificação de evolução
      }
    }

    return NextResponse.json({
      ok: true,
      message:
        'Webhook processado com sucesso!'
    })

  } catch (error: any) {

    console.error(
      '[Webhook] Erro ao processar:',
      error
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Erro ao processar webhook'
      },
      { status: 500 }
    )
  }
}