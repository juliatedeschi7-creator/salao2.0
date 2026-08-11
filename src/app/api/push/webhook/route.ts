// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { PushTemplates, dispararParaPerfil } from '@/lib/push' // Certifique-se de importar a função de disparo se usar

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { table, type, record, old_record } = body

    console.log(`[Webhook] Evento recebido na tabela "${table}" (Tipo: ${type})`)

    const donoId = record.dono_id || record.salao_id || record.profile_id

    // ==========================================
    // 1. AGENDAMENTOS / PEDIDOS DE HORÁRIO
    // ==========================================
    if (table === 'appointments' || table === 'agendamentos' || table === 'solicitacoes_agendamento') {
      if (type === 'INSERT') {
        const payload = PushTemplates.novoAgendamento
          ? PushTemplates.novoAgendamento(
              record.cliente_nome || record.nome || 'Um cliente',
              record.servico_nome || 'Serviço',
              record.data_hora || record.data
            )
          : { title: 'Novo Agendamento', body: 'Novo horário solicitado.' }

        await dispararParaPerfil(donoId, payload)
      }

      if (type === 'UPDATE' && old_record?.status === 'pendente' && record.status === 'confirmado') {
        if (PushTemplates.agendamento ConfirmadoCliente) {
          const payload = PushTemplates.agendamentoConfirmadoCliente(
            record.servico_nome || 'Serviço',
            record.data_hora || record.data
          )
          // Se for para o cliente, você precisará buscar o token do cliente ao invés do donoId
        }
      }
    }

    // ==========================================
    // 2. CLIENTES (Nova cliente e Mesclagem)
    // ==========================================
    if (table === 'clientes') {
      // Nova cliente cadastrada -> Dono recebe o push
      if (type === 'INSERT') {
        const payload = {
          title: '✨ Nova Cliente Cadastrada',
          body: `A cliente ${record.nome || 'Nova Cliente'} acabou de ser cadastrada.`,
          url: '/salao/clientes'
        }
        await dispararParaPerfil(donoId, payload)
      }

      // Detecção de mesclagem de contatos
      if (type === 'UPDATE' && record.is_merged === true && !old_record?.is_merged) {
        const payload = {
          title: '🔄 Contatos Mesclados',
          body: `Os registros da cliente ${record.nome || ''} foram mesclados.`,
          url: '/salao/clientes'
        }
        await dispararParaPerfil(donoId, payload)
      }
    }

    // ==========================================
    // 3. ORÇAMENTOS (budgets ou orcamentos)
    // ==========================================
    if (table === 'budgets' || table === 'orcamentos') {
      if (type === 'UPDATE' && old_record?.status === 'pendente' && record.status === 'pronto') {
        if (typeof PushTemplates.orcamentoProntoCliente === 'function') {
          const payload = PushTemplates.orcamentoProntoCliente(record.servico_nome || 'Serviço solicitado')
          // Enviar para o cliente
        }
      }
    }

    // ==========================================
    // 4. FICHA DE ANAMNESE (anamneses ou fichas_anamnese)
    // ==========================================
    if (table === 'anamneses' || table === 'fichas_anamnese') {
      if (type === 'INSERT' && record.status === 'pendente') {
        // Enviar para o cliente preencher
      }
      if (type === 'UPDATE' && old_record?.status === 'pendente' && record.status === 'respondido') {
        const payload = {
          title: '📋 Anamnese Respondida',
          body: `A cliente ${record.cliente_nome || 'Uma cliente'} respondeu à ficha de anamnese.`,
          url: '/salao/clientes'
        }
        await dispararParaPerfil(donoId, payload)
      }
    }

    // ==========================================
    // 5. FOTOS DE EVOLUÇÃO (evolucoes ou evolucoes_fotos)
    // ==========================================
    if (table === 'evolucoes' || table === 'evolucoes_fotos') {
      if (type === 'INSERT') {
        // Notificação de evolução
      }
    }

    return NextResponse.json({ ok: true, message: 'Webhook processado com sucesso!' })
  } catch (error: any) {
    console.error('[Webhook] Erro ao processar:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
