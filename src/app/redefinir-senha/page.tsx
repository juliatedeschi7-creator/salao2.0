'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { KeyRound, Eye, EyeOff } from 'lucide-react'

export default function RedefinirSenhaPage() {
  const [novaSenha, setNovaSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const router = useRouter()

  async function handleTrocarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!novaSenha || novaSenha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    setLoading(true)
    setErro('')

    const { error } = await supabase.auth.updateUser({
      password: novaSenha,
    })

    setLoading(false)

    if (error) {
      setErro('Erro ao atualizar senha: ' + error.message)
    } else {
      setSucesso(true)
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-sm w-full bg-white p-6 rounded-3xl shadow-xl border border-gray-100 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gray-900/10 text-gray-900 flex items-center justify-center shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Nova Senha</h1>
            <p className="text-xs text-gray-500">Digite sua nova senha abaixo.</p>
          </div>
        </div>

        {sucesso ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center space-y-1">
            <p className="text-green-700 text-sm font-bold">✅ Senha alterada com sucesso!</p>
            <p className="text-xs text-green-600">Redirecionando para o login...</p>
          </div>
        ) : (
          <form onSubmit={handleTrocarSenha} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-900">Nova Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  minLength={6}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4 pr-12 text-base outline-none placeholder-gray-400"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                >
                  {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-600 text-xs text-center">{erro}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl font-semibold text-base flex items-center justify-center active:scale-95 transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Salvar Senha'
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
