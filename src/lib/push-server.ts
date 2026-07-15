// src/lib/push-server.ts
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Inicializa o cliente do Supabase com privilégios de Admin (necessário no servidor)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Configura as chaves de identificação do Push
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

/**
 * Função base para disparar a notificação para todos os dispositivos de um usuário
 */
export async function sendPushNotification(profileId: string, payload: PushPayload) {
  try {
    // Busca todas as inscrições de push ativas do usuário
    const { data: subs, error: dbErr } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('profile_id', profileId)

    if (dbErr) {
      console.error('[Server Push] Erro ao buscar inscrições no banco:', dbErr)
      return { ok: false, error: dbErr.message }
    }

    if (!subs || subs.length === 0) {
      return { ok: false, message: 'Nenhum dispositivo registrado para este usuário.' }
    }

    // Dispara a notificação para cada navegador/aparelho registrado
    const promessas = subs.map(async (sub) => {
      const s = sub.subscription as any
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
            icon: '/logo.png', // Caminho padrão do ícone do seu app
            url: payload.url || '/salao'
          }),
          { timeout: 5000 }
        )
        return { id: sub.id, status: 'enviado' }
      } catch (err: any) {
        // Se o navegador rejeitar o push (inscrição expirou ou foi bloqueada pelo usuário)
        // limpamos o banco de dados automaticamente
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

/**
 * === TEMPLATES DE NOTIFICAÇÕES AUTOMÁTICAS DO SISTEMA ===
 */
export const PushTemplates = {
  // 1. Agendamentos
  novoAgendamentoDono: (donoId: string, clienteNome: string, servico: string, dataHora: string) => {
    return sendPushNotification(donoId, {
      title: '📅 Novo Agendamento!',
      body: `${clienteNome} agendou ${servico} para ${dataHora}.`,
      url: '/salao/agendamentos'
    })
  },
  agendamentoConfirmadoCliente: (clienteId: string, servico: string, dataHora: string) => {
    return sendPushNotification(clienteId, {
      title: '✅ Horário Confirmado!',
      body: `Seu agendamento de ${servico} para ${dataHora} foi aprovado pelo salão!`,
      url: '/salao/meus-horarios'
    })
  },

  // 2. Orçamentos
  orcamentoProntoCliente: (clienteId: string, servico: string) => {
    return sendPushNotification(clienteId, {
      title: '💰 Orçamento Disponível!',
      body: `O orçamento solicitado para o serviço de ${servico} está pronto para aprovação.`,
      url: '/salao/orcamentos'
    })
  },

  // 3. Fichas de Anamnese (Clínica)
  solicitarPreenchimentoAnamnese: (clienteId: string, profissionalNome: string) => {
    return sendPushNotification(clienteId, {
      title: '📝 Ficha de Anamnese',
      body: `Olá! Por favor, responda a sua ficha de anamnese antes do seu atendimento com ${profissionalNome}.`,
      url: '/salao/anamnese'
    })
  },
  anamneseRespondidaDono: (donoId: string, clienteNome: string) => {
    return sendPushNotification(donoId, {
      title: '📋 Anamnese Atualizada',
      body: `${clienteNome} respondeu/atualizou a ficha de anamnese. Clique para revisar.`,
      url: '/salao/clientes'
    })
  },

  // 4. Fotos de Evolução (Tratamento)
  fotoEvolucaoAdicionada: (clienteId: string, tratamentoNome: string) => {
    return sendPushNotification(clienteId, {
      title: '✨ Nova Foto de Evolução!',
      body: `Uma nova foto foi adicionada ao seu histórico de evolução em "${tratamentoNome}". Venha ver seu progresso!`,
      url: '/salao/minha-evolucao'
    })
  },

  // 5. Pacotes (Consumo de Sessões)
  atualizacaoPacoteCliente: (clienteId: string, pacoteNome: string, sessoesRestantes: number) => {
    return sendPushNotification(clienteId, {
      title: '📦 Atualização de Pacote',
      body: `Você possui agora ${sessoesRestantes} sessões restantes no seu pacote de ${pacoteNome}.`,
      url: '/salao/meus-pacotes'
    })
  },

  // 6. Segurança e Atualizações de Perfil
  atualizacaoContaUsuario: (perfilId: string, mensagem: string) => {
    return sendPushNotification(perfilId, {
      title: '⚙️ Atualização na sua Conta',
      body: mensagem,
      url: '/salao/configuracoes'
    })
  },

  // 7. Contratos
  contratoAssinadoDono: (donoId: string, clienteNome: string, contratoNome: string) => {
    return sendPushNotification(donoId, {
      title: '✍️ Contrato Assinado!',
      body: `O cliente ${clienteNome} assinou o contrato "${contratoNome}".`,
      url: '/salao/contratos'
    })
  },

  // 8. Financeiro (Contas Correntes de Clientes - Fiado / Crédito)
  atualizacaoSaldoCliente: (clienteId: string, novoSaldo: number) => {
    const saldoFormatado = Math.abs(novoSaldo).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })

    let titulo = '💰 Sua conta no salão foi atualizada!'
    let mensagem = ''

    if (novoSaldo < 0) {
      mensagem = `Olá! Um novo lançamento foi feito na sua conta. Seu saldo devedor atual é de ${saldoFormatado}.`
    } else if (novoSaldo > 0) {
      mensagem = `Olá! Seu saldo de créditos atualizado é de ${saldoFormatado}. Aproveite nos seus próximos serviços!`
    } else {
      titulo = '✅ Conta quitada!'
      mensagem = `Seu saldo foi atualizado e está totalmente em dia. Obrigado!`
    }

    return sendPushNotification(clienteId, {
      title: titulo,
      body: mensagem,
      url: '/salao/financeiro'
    })
  },

  // 9. Campanhas de Engajamento e Lembretes Gerais
  lembreteDeHorarioCliente: (clienteId: string, servico: string, horario: string) => {
    return sendPushNotification(clienteId, {
      title: '⏰ Lembrete de Agendamento',
      body: `Falta pouco! Seu serviço de ${servico} está marcado para hoje às ${horario}.`,
      url: '/salao/meus-horarios'
    })
  },
  campanhaMarketingServicos: (clienteId: string, salaoNome: string) => {
    return sendPushNotification(clienteId, {
      title: `✨ Novidades no ${salaoNome}!`,
      body: 'Que tal um momento de autocuidado? Vem conferir nossos serviços e garanta seu horário.',
      url: '/salao/servicos'
    })
  }
}
