import webpush from 'web-push'

// Configura as chaves VAPID do Servidor
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:suporte@organizasalao.com.br', // Substitua se quiser pelo seu email de suporte
    vapidPublicKey,
    vapidPrivateKey
  )
}

// Objeto de templates de mensagens de push.
// Usamos uma assinatura dinâmica [key: string] para garantir que o TypeScript
// não quebre o build se a sua rota de webhook chamar qualquer outro template personalizado!
export const PushTemplates: {
  [key: string]: (...args: any[]) => { title: string; body: string; url?: string }
} = {
  novoAgendamento: (clienteNome: string = 'Cliente', servico: string = 'serviço', dataHora: string = '') => ({
    title: 'Novo Agendamento! 🗓️',
    body: `${clienteNome} agendou ${servico}${dataHora ? ` para ${dataHora}` : ''}.`,
    url: '/salao/agendamentos'
  }),
  
  agendamentoCancelado: (clienteNome: string = 'Cliente', dataHora: string = '') => ({
    title: 'Agendamento Cancelado ⚠️',
    body: `O agendamento de ${clienteNome}${dataHora ? ` de ${dataHora}` : ''} foi cancelado.`,
    url: '/salao/agendamentos'
  }),

  lembreteCliente: (servico: string = 'seu serviço', dataHora: string = '') => ({
    title: 'Seu horário está chegando! ⏰',
    body: `Lembrete: Seu horário para ${servico} é hoje às ${dataHora}. Esperamos você!`,
    url: '/cliente'
  }),

  confirmacao: (servico: string = 'seu serviço', dataHora: string = '') => ({
    title: 'Agendamento Confirmado! ✅',
    body: `Seu horário para ${servico} em ${dataHora} foi confirmado.`,
    url: '/cliente'
  })
}

// Função de disparo no servidor (Server-side)
export async function enviarPush(
  subscription: any, 
  payload: { title: string; body: string; url?: string }
) {
  try {
    const payloadString = JSON.stringify(payload)
    await webpush.sendNotification(subscription, payloadString)
    return { ok: true }
  } catch (error: any) {
    console.error('Erro ao disparar push:', error)
    return { ok: false, error: error?.message || String(error) }
  }
}
