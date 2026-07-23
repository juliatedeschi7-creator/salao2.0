// 🟢 Valida se o usuário é dono/admin geral
export function temAcessoTotal(profile: any): boolean {
  if (!profile) return false
  const role = (profile.role || '').toString().toLowerCase()
  return role === 'admin' || role === 'dono'
}

// 🟢 1. Checa se o usuário pode ABRIR/ACESSAR a página
export function temAcessoPagina(profile: any, paginaKey: string): boolean {
  if (!profile) return false
  
  const role = (profile.role || '').toString().toLowerCase()
  // Dono/Admin sempre tem acesso total a tudo
  if (role === 'admin' || role === 'dono') return true

  const permissoes = profile.permissoes || {}
  const permPagina = permissoes[paginaKey]

  return permPagina?.acesso ?? false
}

// 🟢 2. Checa se o usuário navega na página COMO DONO (visão total) ou COMO FUNCIONÁRIO (visão restrita)
export function ehDonoNaPagina(profile: any, paginaKey: string): boolean {
  if (!profile) return false
  
  const role = (profile.role || '').toString().toLowerCase()
  // Dono/Admin sempre navega como dono
  if (role === 'admin' || role === 'dono') return true

  const permissoes = profile.permissoes || {}
  const permPagina = permissoes[paginaKey]

  return permPagina?.acesso === true && permPagina?.modo === 'dono'
}
