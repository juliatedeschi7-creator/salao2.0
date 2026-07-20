'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function RedefinirSenhaPage() {
  const [novaSenha, setNovaSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleTrocarSenha(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: novaSenha,
    })

    setLoading(false)

    if (error) {
      alert('Erro ao atualizar senha: ' + error.message)
    } else {
      alert('Senha alterada com sucesso!')
      router.push('/login') // Redireciona para o login
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-md space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Crie sua nova senha</h1>
        
        <form onSubmit={handleTrocarSenha} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nova Senha</label>
            <input
              type="password"
              placeholder="Digite no mínimo 6 caracteres"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              minLength={6}
              required
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white py-2 rounded font-medium hover:bg-pink-700 transition"
          >
            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
        </form>
      </div>
    </main>
  )
}
