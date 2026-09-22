‘use client’

import { createClient } from ‘@supabase/supabase-js’

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
supabaseUrl,
supabaseAnonKey
)

// =========================================================
// DIAGNÓSTICO DO PUSH
// =========================================================

let ultimoErroPush = ‘’

export function obterUltimoErroPush(): string {
return ultimoErroPush
}

function registrarErroPush(
mensagem: string
): false {

ultimoErroPush = mensagem

console.error(
‘[PUSH CLIENT] ERRO:’,
mensagem
)

return false
}

// =========================================================
// SUPORTE
// =========================================================

export function verificarSuportePush(): boolean {

if (typeof window === ‘undefined’) {
return false
}

return (
‘Notification’ in window &&
‘serviceWorker’ in navigator &&
‘PushManager’ in window
)
}

export function obterPermissaoPush(): NotificationPermission {

if (
typeof window === ‘undefined’ ||
!(‘Notification’ in window)
) {
return ‘denied’
}

return Notification.permission
}

// =========================================================
// VAPID
// =========================================================

function urlBase64ToUint8Array(
base64String: string
): Uint8Array {

const padding =
‘=’.repeat(
(4 - (base64String.length % 4)) % 4
)

const base64 =
(base64String + padding)
.replace(/-/g, ‘+’)
.replace(/_/g, ‘/’)

const rawData =
window.atob(base64)

const outputArray =
new Uint8Array(rawData.length)

for (
let i = 0;
i < rawData.length;
++i
) {
outputArray[i] =
rawData.charCodeAt(i)
}

return outputArray
}

function uint8ArrayToArrayBuffer(
array: Uint8Array
): ArrayBuffer {

const buffer =
new ArrayBuffer(array.byteLength)

new Uint8Array(buffer).set(array)

return buffer
}

// =========================================================
// OBTER SUBSCRIPTION EXISTENTE
// =========================================================

async function obterSubscriptionExistente(): Promise<PushSubscription | null> {

if (
typeof window === ‘undefined’ ||
!(‘serviceWorker’ in navigator) ||
!(‘PushManager’ in window)
) {
return null
}

try {

const registration =
  await navigator.serviceWorker.ready
const subscription =
  await registration.pushManager.getSubscription()
return subscription

} catch (error) {

console.error(
  '[PUSH CLIENT] Erro ao obter subscription existente:',
  error
)
return null

}
}

// =========================================================
// SALVAR SUBSCRIPTION PARA UMA CONTA
//
// IMPORTANTE:
// Esta função NÃO cria subscription.
// Ela apenas salva uma subscription que já existe
// para o profile informado.
//
// Isso permite que a mesma subscription do aparelho
// seja associada a mais de uma conta.
// =========================================================

async function salvarSubscriptionParaConta(
userId: string,
subscription: PushSubscription
): Promise {

try {

const subscriptionJson =
  subscription.toJSON()
console.log(
  '[PUSH CLIENT] Subscription JSON:',
  subscriptionJson
)
// -------------------------------------------------------
// Validar dados da subscription
// -------------------------------------------------------
if (
  !subscriptionJson.endpoint ||
  !subscriptionJson.keys?.p256dh ||
  !subscriptionJson.keys?.auth
) {
  return registrarErroPush(
    'A Push Subscription está incompleta: faltam endpoint, p256dh ou auth.'
  )
}
// -------------------------------------------------------
// Buscar profile
// -------------------------------------------------------
console.log(
  '[PUSH CLIENT] Buscando profile no Supabase...'
)
const {
  data: profile,
  error: profileError
} = await supabase
  .from('profiles')
  .select('salao_id')
  .eq('id', userId)
  .single()
if (profileError) {
  console.error(
    '[PUSH CLIENT] Erro ao buscar profile:',
    profileError
  )
  return registrarErroPush(
    `Erro ao buscar perfil no Supabase: ${profileError.message}`
  )
}
console.log(
  '[PUSH CLIENT] Profile encontrado:',
  profile
)
// -------------------------------------------------------
// Salvar subscription
//
// IMPORTANTE:
// Mantemos exatamente a estrutura atual.
//
// A tabela NÃO possui coluna endpoint.
// O endpoint continua dentro de subscription.
//
// Também mantemos:
// onConflict: 'profile_id'
//
// Não alteramos a estrutura que a rota atual
// /api/notificar já utiliza.
// -------------------------------------------------------
console.log(
  '[PUSH CLIENT] Salvando subscription para a conta...'
)
const {
  error: subscriptionError
} = await supabase
  .from('push_subscriptions')
  .upsert(
    {
      profile_id: userId,
      user_id: userId,
      salao_id:
        profile?.salao_id ?? null,
      subscription:
        subscriptionJson,
      updated_at:
        new Date().toISOString()
    },
    {
      onConflict: 'profile_id'
    }
  )
if (subscriptionError) {
  console.error(
    '[PUSH CLIENT] Erro ao salvar subscription:',
    subscriptionError
  )
  return registrarErroPush(
    `Erro ao salvar a Push Subscription no Supabase: ${subscriptionError.message}`
  )
}
console.log(
  '[PUSH CLIENT] Subscription salva para a conta com sucesso.'
)
return true

} catch (error: unknown) {

console.error(
  '[PUSH CLIENT] Erro ao salvar subscription para conta:',
  error
)
if (error instanceof Error) {
  return registrarErroPush(
    `${error.name}: ${error.message}`
  )
}
let mensagem =
  'Erro desconhecido ao salvar a Push Subscription.'
try {
  mensagem =
    JSON.stringify(error)
} catch {
  mensagem =
    String(error)
}
return registrarErroPush(
  mensagem
)

}
}

// =========================================================
// REGISTRAR PUSH
//
// Mantém o comportamento original:
//
// 1. verifica suporte
// 2. verifica permissão
// 3. pede permissão somente se necessário
// 4. registra service worker
// 5. reutiliza subscription existente
// 6. cria uma nova somente se não existir
// 7. salva para a conta atual
//
// NÃO altera a rota /api/notificar.
// =========================================================

export async function registrarPush(
userId: string
): Promise {

ultimoErroPush = ‘’

try {

console.log(
  '[PUSH CLIENT] ================================='
)
console.log(
  '[PUSH CLIENT] Iniciando registro do Push'
)
console.log(
  '[PUSH CLIENT] userId:',
  userId
)
// -------------------------------------------------------
// 1. Verificar suporte
// -------------------------------------------------------
if (!verificarSuportePush()) {
  return registrarErroPush(
    'Este dispositivo/navegador não possui suporte às APIs necessárias para Push.'
  )
}
console.log(
  '[PUSH CLIENT] Suporte ao Push detectado.'
)
// -------------------------------------------------------
// 2. Verificar permissão
// -------------------------------------------------------
let permission =
  obterPermissaoPush()
console.log(
  '[PUSH CLIENT] Permissão atual:',
  permission
)
if (permission === 'denied') {
  return registrarErroPush(
    'A permissão para notificações está bloqueada neste dispositivo.'
  )
}
if (permission === 'default') {
  console.log(
    '[PUSH CLIENT] Solicitando permissão ao usuário...'
  )
  permission =
    await Notification.requestPermission()
  console.log(
    '[PUSH CLIENT] Resultado da permissão:',
    permission
  )
}
if (permission !== 'granted') {
  return registrarErroPush(
    `Permissão para notificações não concedida. Resultado: ${permission}`
  )
}
console.log(
  '[PUSH CLIENT] Permissão concedida.'
)
// -------------------------------------------------------
// 3. Verificar VAPID
// -------------------------------------------------------
const vapidKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
if (!vapidKey) {
  return registrarErroPush(
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY não está configurada no navegador.'
  )
}
console.log(
  '[PUSH CLIENT] Chave VAPID pública encontrada.'
)
// -------------------------------------------------------
// 4. Registrar Service Worker
// -------------------------------------------------------
console.log(
  '[PUSH CLIENT] Registrando /sw.js...'
)
const registration =
  await navigator.serviceWorker.register(
    '/sw.js',
    {
      scope: '/'
    }
  )
console.log(
  '[PUSH CLIENT] Service Worker registrado:',
  registration
)
await navigator.serviceWorker.ready
console.log(
  '[PUSH CLIENT] Service Worker pronto.'
)
// -------------------------------------------------------
// 5. Verificar subscription existente
// -------------------------------------------------------
let subscription =
  await registration.pushManager.getSubscription()
if (subscription) {
  console.log(
    '[PUSH CLIENT] Subscription existente encontrada.'
  )
} else {
  console.log(
    '[PUSH CLIENT] Nenhuma subscription encontrada.'
  )
}
// -------------------------------------------------------
// 6. Criar nova subscription se necessário
// -------------------------------------------------------
if (!subscription) {
  console.log(
    '[PUSH CLIENT] Criando nova Push Subscription...'
  )
  const vapidBytes =
    urlBase64ToUint8Array(
      vapidKey
    )
  const applicationServerKey =
    uint8ArrayToArrayBuffer(
      vapidBytes
    )
  console.log(
    '[PUSH CLIENT] VAPID convertida para ArrayBuffer.'
  )
  subscription =
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    })
  console.log(
    '[PUSH CLIENT] Nova subscription criada:',
    subscription
  )
}
// -------------------------------------------------------
// 7. Salvar subscription para a conta atual
// -------------------------------------------------------
const resultado =
  await salvarSubscriptionParaConta(
    userId,
    subscription
  )
if (!resultado) {
  return false
}
// -------------------------------------------------------
// 8. Sucesso
// -------------------------------------------------------
console.log(
  '[PUSH CLIENT] Subscription salva com sucesso.'
)
console.log(
  '[PUSH CLIENT] ================================='
)
return true

} catch (error: unknown) {

console.error(
  '[PUSH CLIENT] ================================='
)
console.error(
  '[PUSH CLIENT] ERRO ao registrar Push:',
  error
)
if (error instanceof Error) {
  console.error(
    '[PUSH CLIENT] Tipo do erro:',
    error.name
  )
  console.error(
    '[PUSH CLIENT] Mensagem:',
    error.message
  )
  console.error(
    '[PUSH CLIENT] Stack:',
    error.stack
  )
  return registrarErroPush(
    `${error.name}: ${error.message}`
  )
} else {
  let mensagem =
    'Erro desconhecido ao registrar o Push.'
  try {
    mensagem =
      JSON.stringify(error)
  } catch {
    mensagem =
      String(error)
  }
  return registrarErroPush(
    mensagem
  )
}

}
}

// =========================================================
// VERIFICAR PUSH NO APARELHO
//
// Esta função responde:
//
// “Existe uma PushSubscription neste aparelho?”
//
// Ela NÃO decide se a conta atual está vinculada.
// Para isso usamos verificarPushVinculadoAConta().
// =========================================================

export async function verificarPushAtivo(
userId?: string
): Promise {

try {

if (
  typeof window === 'undefined' ||
  !('serviceWorker' in navigator) ||
  !('PushManager' in window)
) {
  return false
}
const registration =
  await navigator.serviceWorker.ready
const subscription =
  await registration.pushManager.getSubscription()
if (!subscription) {
  return false
}
if (userId) {
  const subscriptionJson =
    subscription.toJSON()
  if (
    !subscriptionJson.endpoint
  ) {
    return false
  }
}
return true

} catch (error) {

console.error(
  '[PUSH CLIENT] Erro ao verificar Push ativo:',
  error
)
return false

}
}

// =========================================================
// VERIFICAR SE A CONTA ATUAL ESTÁ VINCULADA
//
// Diferente de verificarPushAtivo():
//
// verificarPushAtivo()
// → existe Push no aparelho?
//
// verificarPushVinculadoAConta()
// → esta conta possui a subscription salva no banco?
//
// Isso é necessário para múltiplas contas no mesmo aparelho.
// =========================================================

export async function verificarPushVinculadoAConta(
userId: string
): Promise {

try {

if (
  !userId ||
  typeof window === 'undefined' ||
  !('serviceWorker' in navigator) ||
  !('PushManager' in window)
) {
  return false
}
const registration =
  await navigator.serviceWorker.ready
const subscription =
  await registration.pushManager.getSubscription()
if (!subscription) {
  return false
}
const subscriptionJson =
  subscription.toJSON()
if (!subscriptionJson.endpoint) {
  return false
}
// -------------------------------------------------------
// Buscar a associação da conta
// -------------------------------------------------------
const {
  data,
  error
} = await supabase
  .from('push_subscriptions')
  .select('id, subscription')
  .eq(
    'profile_id',
    userId
  )
  .maybeSingle()
if (error) {
  console.error(
    '[PUSH CLIENT] Erro ao verificar vínculo da conta:',
    error
  )
  return false
}
if (!data?.subscription) {
  return false
}
const subscriptionSalva =
  data.subscription as any
if (
  !subscriptionSalva.endpoint
) {
  return false
}
return (
  subscriptionSalva.endpoint ===
  subscriptionJson.endpoint
)

} catch (error) {

console.error(
  '[PUSH CLIENT] Erro ao verificar vínculo do Push:',
  error
)
return false

}
}

// =========================================================
// VINCULAR SUBSCRIPTION EXISTENTE À CONTA
//
// NÃO cria nova subscription.
// NÃO pede permissão.
// Apenas pega a subscription que já existe no aparelho
// e salva para a conta informada.
//
// É esta função que permite:
//
// Conta A → Push
// sair
// Conta B → reutilizar o mesmo Push
// =========================================================

export async function vincularPushAConta(
userId: string
): Promise {

ultimoErroPush = ‘’

try {

console.log(
  '[PUSH CLIENT] ================================='
)
console.log(
  '[PUSH CLIENT] Vinculando Push existente à conta'
)
console.log(
  '[PUSH CLIENT] userId:',
  userId
)
if (!verificarSuportePush()) {
  return registrarErroPush(
    'Este dispositivo/navegador não possui suporte às APIs necessárias para Push.'
  )
}
if (
  obterPermissaoPush() !==
  'granted'
) {
  return registrarErroPush(
    'A permissão para notificações não está concedida neste dispositivo.'
  )
}
const subscription =
  await obterSubscriptionExistente()
if (!subscription) {
  return registrarErroPush(
    'Nenhuma Push Subscription existente foi encontrada neste dispositivo.'
  )
}
const resultado =
  await salvarSubscriptionParaConta(
    userId,
    subscription
  )
if (!resultado) {
  return false
}
console.log(
  '[PUSH CLIENT] Push existente vinculado à conta com sucesso.'
)
console.log(
  '[PUSH CLIENT] ================================='
)
return true

} catch (error: unknown) {

console.error(
  '[PUSH CLIENT] Erro ao vincular Push à conta:',
  error
)
if (error instanceof Error) {
  return registrarErroPush(
    `${error.name}: ${error.message}`
  )
}
return registrarErroPush(
  'Erro desconhecido ao vincular o Push à conta.'
)

}
}

// =========================================================
// DESATIVAR PUSH DA CONTA
//
// IMPORTANTE:
//
// NÃO executa unsubscribe().
//
// A subscription continua existindo no aparelho.
// Apenas removemos a associação desta conta.
//
// Outras contas continuam funcionando normalmente.
// =========================================================

export async function desativarPushConta(
userId: string
): Promise {

ultimoErroPush = ‘’

try {

if (!userId) {
  return registrarErroPush(
    'Não foi possível identificar a conta.'
  )
}
console.log(
  '[PUSH CLIENT] Desativando Push somente para a conta:',
  userId
)
const {
  error
} = await supabase
  .from('push_subscriptions')
  .delete()
  .eq(
    'profile_id',
    userId
  )
if (error) {
  console.error(
    '[PUSH CLIENT] Erro ao desativar Push da conta:',
    error
  )
  return registrarErroPush(
    `Não foi possível desativar as notificações desta conta: ${error.message}`
  )
}
console.log(
  '[PUSH CLIENT] Push desativado somente para esta conta.'
)
return true

} catch (error: unknown) {

console.error(
  '[PUSH CLIENT] Erro ao desativar Push:',
  error
)
if (error instanceof Error) {
  return registrarErroPush(
    `${error.name}: ${error.message}`
  )
}
return registrarErroPush(
  'Erro desconhecido ao desativar o Push.'
)

}
}

// =========================================================
// DESCONEXÃO DA CONTA
//
// Por enquanto, a desconexão utiliza a mesma operação
// segura de remover somente a associação da conta.
//
// NÃO cancela a subscription do aparelho.
// =========================================================

export async function desconectarPushConta(
userId: string
): Promise {

ultimoErroPush = ‘’

try {

if (!userId) {
  return registrarErroPush(
    'Não foi possível identificar a conta.'
  )
}
console.log(
  '[PUSH CLIENT] Desconectando Push somente da conta:',
  userId
)
const {
  error
} = await supabase
  .from('push_subscriptions')
  .delete()
  .eq(
    'profile_id',
    userId
  )
if (error) {
  console.error(
    '[PUSH CLIENT] Erro ao desconectar Push da conta:',
    error
  )
  return registrarErroPush(
    `Não foi possível desconectar as notificações desta conta: ${error.message}`
  )
}
console.log(
  '[PUSH CLIENT] Conta desconectada do Push.'
)
return true

} catch (error: unknown) {

console.error(
  '[PUSH CLIENT] Erro ao desconectar Push:',
  error
)
if (error instanceof Error) {
  return registrarErroPush(
    `${error.name}: ${error.message}`
  )
}
return registrarErroPush(
  'Erro desconhecido ao desconectar o Push.'
)

}
}