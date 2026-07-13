export async function enviarPushParaUsuario(
  userId: string,
  title: string,
  body: string,
  url?: string
) {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, url })
    })
  } catch (e) {
    console.error('Erro ao enviar push:', e)
  }
}
