'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Scissors } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState('')

  async function handleLogin() {
    setLoading(true)
    setLog('Tentando logar...')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    })

    if (error) {
      setLog('ERRO AUTH: ' + error.message + ' | Status: ' + error.status)
      setLoading(false)
      return
    }

    setLog('Login OK! User ID: ' + data.user?.id)

    const { data: prof, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profError) {
      setLog(prev => prev + ' | ERRO PROFILE: ' + profError.message)
      setLoading(false)
      return
    }

    setLog(prev => prev + ' | Profile: ' + JSON.stringify(prof))
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-4">
      <Scissors size={40} className="text-gray-900" />
      <h1 className="text-xl font-bold">Debug Login</h1>
      <input
        className="input-field w-full max-w-sm"
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        className="input-field w-full max-w-sm"
        type="password"
        placeholder="Senha"
        value={senha}
        onChange={e => setSenha(e.target.value)}
      />
      <button
        className="btn-primary max-w-sm"
        onClick={handleLogin}
        disabled={loading}>
        {loading ? 'Testando...' : 'Testar Login'}
      </button>
      {log && (
        <div className="bg-gray-100 rounded-xl p-4 w-full max-w-sm">
          <p className="text-xs text-gray-700 break-all">{log}</p>
        </div>
      )}
    </div>
  )
}
