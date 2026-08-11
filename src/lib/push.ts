import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Configura as chaves VAPID do Servidor
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:suporte@organizasalao.com.br',
    vapidPublicKey,
    vapidPrivateKey
  )
}

// Cliente Supabase server-side para buscar as subscriptions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Objeto de templates de mensagens de push.
export const PushTemplates: {
  [key: string]: (...args: any[]) => { title: string; body: string; url?: string }
} = {
  novoAgendamento: (clienteNome: string = 'Cliente', servico: string = 'serviço', dataHora: string = '') => ({
    title: 'Novo Agendamento! 🗓️',
    body: `${clienteNome} agendou ${servico}${dataHora ? ` para ${dataHora}` : ''}.`,
    url: '/salao/agendamentos'
  }),

  pedidoAgendamento: (clienteNome: string = 'Cliente', servico: string = 'serviço') => ({
    title: 'Novo Pedido de Horário! ⏳',
    body: `${clienteNome} solicitou um horário para ${servico}.`,
    url: '/salao/agendamentos'
  }),

  contatoMesclado: (clienteNome: string = 'Cliente') => ({
    title: 'Contatos Mesclados 🔄',
    body: `Os registros da cliente ${clienteNome} foram mesclados com sucesso.`,
    url: '/salao/clientes'
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

// Função de disparo básico (individual)
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

// Função auxiliar para disparar em massa buscando pelo profile_id correto
export async function dispararParaPerfil(
  profileId: string, 
  payload: { title: string; body: string; url?: string }
) {
  try {
    if (!profileId) {
      console.log('Nenhum profileId fornecido para o disparo de push.')
      return { ok: false, message: 'profileId ausente.' }
    }

    // Busca focada na coluna profile_id onde o seu ID está cadastrado
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('profile_id', profileId)

    if (error || !subs || subs.length === 0) {
      console.log(`Nenhuma inscrição encontrada na tabela push_subscriptions para o profile_id: ${profileId}`)
      return { ok: false, message: 'Nenhuma inscrição encontrada para este perfil.' }
    }

    const promessas = subs.map(async (sub) => {
      const res = await enviarPush(sub.subscription, payload)
      // Se a subscription expirou ou é inválida, remove do banco
      if (!res.ok && (res.error?.includes('410') || res.error?.includes('404'))) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
      return res
    })

    await Promise.all(promessas)
    return { ok: true }
  } catch (err: any) {
    console.error('Erro em dispararParaPerfil:', err)
    return { ok: false, error: err.message }
  }
}
