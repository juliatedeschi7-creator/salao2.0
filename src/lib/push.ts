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
    const { data: subs, error: dbErr } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('profile_id', profileId)

    if (dbErr) {
      console.error('[Push] Erro ao buscar do banco:', dbErr)
      return { ok: false, error: dbErr.message }
    }

    if (!subs || subs.length === 0) {
      return { ok: false, message: 'Nenhum dispositivo registrado.' }
    }

    const promessas = subs.map(async (sub) => {
      const s = sub.subscription
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: {
              p256dh: s.keys?.p256dh,
              auth: s.keys?.auth
            }
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
        return { id: sub.id, status: 'erro', code: err.statusCode }
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
  atualizacaoPacoteCliente: (clienteId: string, pacoteNome: string, sessoesRestantes: number) => {
    return sendPushNotification(clienteId, {
      title: '📦 Atualização de Pacote',
      body: `Você possui agora ${sessoesRestantes} sessões restantes no seu pacote de ${pacoteNome}.`,
      url: '/salao/meus-pacotes'
    })
  },

  // 5. Atualização de Conta (Envia para o Usuário)
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
  },

  // 7. Solicitação para Responder Anamnese (Envia para o Cliente)
  solicitarPreenchimentoAnamnese: (clienteId: string, profissionalNome: string) => {
    return sendPushNotification(clienteId, {
      title: '📝 Ficha de Anamnese',
      body: `Olá! Por favor, responda a sua ficha de anamnese antes do seu atendimento com ${profissionalNome}.`,
      url: '/salao/anamnese'
    })
  },

  // 8. Ficha Respondida / Atualizada (Envia para o Dono)
  anamneseRespondidaDono: (donoId: string, clienteNome: string) => {
    return sendPushNotification(donoId, {
      title: '📋 Anamnese Atualizada',
      body: `${clienteNome} respondeu/atualizou a ficha de anamnese. Clique para revisar.`,
      url: '/salao/clientes'
    })
  },

  // 9. Foto de Evolução Adicionada (Envia para o Cliente)
  fotoEvolucaoAdicionada: (clienteId: string, tratamentoNome: string) => {
    return sendPushNotification(clienteId, {
      title: '✨ Nova Foto de Evolução!',
      body: `Uma nova foto foi adicionada ao seu histórico de evolução em "${tratamentoNome}". Venha ver seu progresso!`,
      url: '/salao/minha-evolucao'
    })
  },

  // 10. Campanhas e Marketing (Envia para Clientes)
  campanhaMarketingServicos: (clienteId: string, salaoNome: string) => {
    return sendPushNotification(clienteId, {
      title: `✨ Novidades no ${salaoNome}!`,
      body: 'Que tal um momento de autocuidado? Vem conferir nossos serviços e garanta seu horário.',
      url: '/salao/servicos'
    })
  }
}
