
import { NextRequest, NextResponse } from 'next/server'
import { PushTemplates } from '@/lib/push'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { table, type, record, old_record } = body

    console.log(`[Webhook] Evento recebido na tabela "${table}" (Tipo: ${type})`)

    // ==========================================
    // 1. AGENDAMENTOS (appointments ou agendamentos)
    // ==========================================
    if (table === 'appointments' || table === 'agendamentos') {
      // Cliente criou um novo agendamento -> Dono recebe o push
      if (type === 'INSERT') {
        await PushTemplates.novoAgendamentoDono(
          record.dono_id,
          record.cliente_nome || 'Um cliente',
          record.servico_nome || 'Serviço',
          record.data_hora
        )
      }
      // Dono mudou de 'pendente' para 'confirmado' -> Cliente recebe o push
      if (type === 'UPDATE' && old_record.status === 'pendente' && record.status === 'confirmado') {
        await PushTemplates.agendamentoConfirmadoCliente(
          record.cliente_id,
          record.servico_nome || 'Serviço',
          record.data_hora
        )
      }
    }

    // ==========================================
    // 2. ORÇAMENTOS (budgets ou orcamentos)
    // ==========================================
    if (table === 'budgets' || table === 'orcamentos') {
      // Dono marcou o orçamento como pronto/finalizado -> Cliente recebe o push
      if (type === 'UPDATE' && old_record.status === 'pendente' && record.status === 'pronto') {
        await PushTemplates.orcamentoProntoCliente(
          record.cliente_id,
          record.servico_nome || 'Serviço solicitado'
        )
      }
    }

    // ==========================================
    // 3. FICHA DE ANAMNESE (anamneses ou fichas_anamnese)
    // ==========================================
    if (table === 'anamneses' || table === 'fichas_anamnese') {
      // Dono cadastrou uma ficha e pediu pro cliente responder -> Cliente recebe o push
      if (type === 'INSERT' && record.status === 'pendente') {
        await PushTemplates.solicitarPreenchimentoAnamnese(
          record.cliente_id,
          record.profissional_nome || 'da profissional'
        )
      }
      // Cliente respondeu a ficha pendente -> Dono recebe o push
      if (type === 'UPDATE' && old_record.status === 'pendente' && record.status === 'respondido') {
        await PushTemplates.anamneseRespondidaDono(
          record.dono_id,
          record.cliente_nome || 'Uma cliente'
        )
      }
    }

    // ==========================================
    // 4. FOTOS DE EVOLUÇÃO (evolucoes ou evolucoes_fotos)
    // ==========================================
    if (table === 'evolucoes' || table === 'evolucoes_fotos') {
      // Uma nova linha de histórico de evolução foi adicionada -> Cliente recebe o push
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
