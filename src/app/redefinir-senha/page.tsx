'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [novaSenha, setNovaSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [temSessao, setTemSessao] = useState(false)
  const [mensagemErro, setMensagemErro] = useState('')

  useEffect(() => {
    // 1. Escuta a mudança de estado da autenticação para capturar o evento de PASSWORD_RECOVERY
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setTemSessao(true)
      }
    })

    // 2. Checa se já existe uma sessão ativa (caso o link tenha sido processado pela URL)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setTemSessao(true)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function handleSalvarSenha(e: React.FormEvent) {
    e.preventDefault()
    setMensagemErro('')

    // Garante que a sessão existe antes de tentar atualizar
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      setMensagemErro('Sessão expirada ou aberta em navegador incompatível. Por favor, abra o link diretamente no Safari ou Chrome.')
      return
    }

    setCarregando(true)

    const { error } = await supabase.auth.updateUser({
      password: novaSenha,
    })

    if (error) {
      setMensagemErro('Erro ao atualizar senha: ' + error.message)
      setCarregando(false)
    } else {
      alert('Senha alterada com sucesso!')
      router.push('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white p-6 rounded-3xl shadow-sm max-w-sm w-full">
        <h2 className="font-bold text-lg text-gray-900 mb-1">Nova Senha</h2>
        <p className="text-xs text-gray-500 mb-4">Digite sua nova senha abaixo.</p>

        {mensagemErro && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl mb-4 leading-relaxed">
            {mensagemErro}
          </div>
        )}

        <form onSubmit={handleSalvarSenha} className="space-y-3">
          <input
            type="password"
            placeholder="Digite a nova senha"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none"
            value={novaSenha}
            onChange={e => setNovaSenha(e.target.value)}
            required
            minLength={6}
          />

          <button
            type="submit"
            disabled={carregando || !temSessao}
            className="w-full py-3 rounded-xl bg-gray-900 text-white font-medium text-sm disabled:opacity-50">
            {carregando ? 'Salvando...' : 'Salvar Senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
