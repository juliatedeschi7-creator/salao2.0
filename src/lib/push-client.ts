async function ativarPush() {
  setAtivandoPush(true)

  try {
    const resultado = await registrarPush(profile!.id)

    setPushAtivo(resultado.ok)

    setResultadoPush(
      resultado.ok
        ? {
            ok: true,
            msg: 'Push ativado! Agora clique em testar.'
          }
        : {
            ok: false,
            msg:
              resultado.erro ||
              'Não foi possível ativar o Push.'
          }
    )

    setTimeout(() => setResultadoPush(null), 8000)

  } catch (error) {
    console.error(
      '[CONFIGURAÇÕES] Erro ao ativar Push:',
      error
    )

    setPushAtivo(false)

    setResultadoPush({
      ok: false,
      msg:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : 'Erro desconhecido ao ativar o Push.'
    })

    setTimeout(() => setResultadoPush(null), 8000)

  } finally {
    setAtivandoPush(false)
  }
}
