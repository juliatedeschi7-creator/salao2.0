// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { PushTemplates } from '@/lib/push'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { table, type, record, old_record } = body

    console.log(`[Webhook] Evento recebido na tabela "${table}" (Tipo: ${type})`)

    // ==========================================
    // 1. AGENDAMENTOS / PEDIDOS DE HORÁRIO
    // ==========================================
    if (table === 'appointments' || table === 'agendamentos' || table === 'solicitacoes_agendamento') {
      // Cliente criou um novo agendamento ou pediu um horário -> Dono recebe o push
      if (type === 'INSERT') {
        await PushTemplates.novoAgendamentoDono(
          record.dono_id || record.salao_id,
          record.cliente_nome || record.nome || 'Um cliente',
          record.servico_nome || 'Serviço',
          record.data_hora || record.data
        )
      }
      // Dono mudou de 'pendente' para 'confirmado' -> Cliente recebe o push
      if (type === 'UPDATE' && old_record?.status === 'pendente' && record.status === 'confirmado') {
        await PushTemplates.agendamentoConfirmadoCliente(
          record.cliente_id,
          record.servico_nome || 'Serviço',
          record.data_hora || record.data
        )
      }
    }

    // ==========================================
    // 2. CLIENTES (Nova cliente e Mesclagem)
    // ==========================================
    if (table === 'clientes') {
      // Nova cliente cadastrada -> Dono recebe o push
      if (type === 'INSERT') {
        await PushTemplates.novoAgendamentoDono( // Ou crie uma função específica no PushTemplates se preferir
          record.dono_id || record.salao_id,
          record.nome || 'Nova Cliente',
        , 'Cadastro de Cliente', 'Acabou de se cadastrar')
      }

      // Detecção de mesclagem de contatos (ex: se houver uma flag ou campo alterado que indique merge)
      if (type === 'UPDATE' && record.is_merged === true && !old_record?.is_merged) {
        // Exemplo caso você marque o registro como mesclado
        console.log(`[Webhook] Contato mesclado: ${record.nome}`)
      }
    }

    // ==========================================
    // 3. ORÇAMENTOS (budgets ou orcamentos)
    // ==========================================
    if (table === 'budgets' || table === 'orcamentos') {
      if (type === 'UPDATE' && old_record?.status === 'pendente' && record.status === 'pronto') {
        await PushTemplates.orcamentoProntoCliente(
          record.cliente_id,
          record.servico_nome || 'Serviço solicitado'
        )
      }
    }

    // ==========================================
    // 4. FICHA DE ANAMNESE (anamneses ou fichas_anamnese)
    // ==========================================
    if (table === 'anamneses' || table === 'fichas_anamnese') {
      if (type === 'INSERT' && record.status === 'pendente') {
        await PushTemplates.solicitarPreenchimentoAnamnese(
          record.cliente_id,
          record.profissional_nome || 'da profissional'
        )
      }
      if (type === 'UPDATE' && old_record?.status === 'pendente' && record.status === 'respondido') {
        await PushTemplates.anamneseRespondidaDono(
          record.dono_id,
          record.cliente_nome || 'Uma cliente'
        )
      }
    }

    // ==========================================
    // 5. FOTOS DE EVOLUÇÃO (evolucoes ou evolucoes_fotos)
    // ==========================================
    if (table === 'evolucoes' || table === 'evolucoes_fotos') {
      if (type === 'INSERT') {
        await PushTemplates.fotoEvolucaoAdicionada(
          record.cliente_id,
          record.tratamento_nome || 'tratamento'
        )
      }
    }

    return NextResponse.json({ ok: true, message: 'Webhook processado com sucesso!' })
  } catch (error: any) {
    console.error('[Webhook] Erro ao processar:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
