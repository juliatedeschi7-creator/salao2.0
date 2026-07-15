import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

interface PushPayload {
  title: string
  body: string
  url?: string
}

// Função core de envio (envia para todos os aparelhos de um usuário)
export async function sendPushNotification(profileId: string, payload: PushPayload) {
  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('profile_id', profileId)

    if (!subs || subs.length === 0) return { ok: false, message: 'Nenhum dispositivo registrado.' }

    const promessas = subs.map(async (sub) => {
      const s = sub.subscription
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.keys?.p256dh, auth: s.keys?.auth }
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: '/logo.png',
            url: payload.url || '/salao'
          }),
          { timeout: 5000 }
        )
        return { id: sub.id, status: 'enviado' }
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
        return { id: sub.id, status: 'erro' }
      }
    })

    const resultados = await Promise.all(promessas)
    return { ok: true, resultados }
  } catch (error: any) {
    return { ok: false, error: error.message }
  }
}

// === TODOS OS MODELOS DE NOTIFICAÇÃO DO SISTEMA ===
export const PushTemplates = {
  // 1. Agendamento Criado (Envia para o Dono)
  novoAgendamentoDono: (donoId: string, clienteNome: string, servico: string, dataHora: string) => {
    return sendPushNotification(donoId, {
      title: '📅 Novo Agendamento!',
      body: `${clienteNome} agendou ${servico} para ${dataHora}.`,
      url: '/salao/agendamentos'
    })
  },

  // 2. Agendamento Confirmado (Envia para o Cliente)
  agendamentoConfirmadoCliente: (clienteId: string, servico: string, dataHora: string) => {
    return sendPushNotification(clienteId, {
      title: '✅ Horário Confirmado!',
      body: `Seu agendamento de ${servico} para ${dataHora} foi aprovado pelo salão!`,
      url: '/salao/meus-horarios'
    })
  },

  // 3. Orçamento Pronto (Envia para o Cliente)
  orcamentoProntoCliente: (clienteId: string, servico: string) => {
    return sendPushNotification(clienteId, {
      title: '💰 Orçamento Disponível!',
      body: `O orçamento solicitado para o serviço de ${servico} está pronto para aprovação.`,
      url: '/salao/orcamentos'
    })
  },

  // 4. Atualização de Pacote (Envia para o Cliente)
  // Exemplo: Comprou pacote, ou usou uma sessão do pacote
  atualizacaoPacoteCliente: (clienteId: string, pacoteNome: string, sessoesRestantes: number) => {
    return sendPushNotification(clienteId, {
      title: '📦 Atualização de Pacote',
      body: `Você possui agora ${sessoesRestantes} sessões restantes no seu pacote de ${pacoteNome}.`,
      url: '/salao/meus-pacotes'
    })
  },

  // 5. Atualização de Conta (Envia para o Usuário)
  // Exemplo: Assinatura do salão ativa, alteração de dados, etc.
  atualizacaoContaUsuario: (perfilId: string, mensagem: string) => {
    return sendPushNotification(perfilId, {
      title: '⚙️ Atualização na sua Conta',
      body: mensagem,
      url: '/salao/configuracoes'
    })
  },

  // 6. Lembrete de Horário (Envia para o Cliente)
  lembreteDeHorarioCliente: (clienteId: string, servico: string, horario: string) => {
    return sendPushNotification(clienteId, {
      title: '⏰ Lembrete de Agendamento',
      body: `Falta pouco! Seu serviço de ${servico} está marcado para hoje às ${horario}.`,
      url: '/salao/meus-horarios'
    })
  }
}
