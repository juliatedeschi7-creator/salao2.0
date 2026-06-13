'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { Clock, LogOut, RefreshCw } from 'lucide-react'

export default function AguardandoPage() {
  const { profile, loading, logout } = useAuth()
  const [verificando, setVerificando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    if (!loading && profile?.aprovado) {
      if (profile.role === 'dono_salao') window.location.href = '/criar-salao'
      else if (profile.role === 'funcionario') window.location.href = '/funcionario'
    }
  }, [loading, profile])

  async function verificarStatus() {
    setVerificando(true)
    setMensagem('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setVerificando(false); return }
    const { data } = await supabase
      .from('profiles').select('aprovado, role, salao_id').eq('id', user.id).single()
    if (data?.aprovado) {
      if (data.role === 'dono_salao' && !data.salao_id) {
        setMensagem('Conta aprovada! Redirecionando para criar salao...')
        setTimeout(() => { window.location.href = '/criar-salao' }, 1500)
      } else if (data.role === 'dono_salao' && data.salao_id) {
        setMensagem('Conta aprovada! Redirecionando...')
        setTimeout(() => { window.location.href = '/salao' }, 1500)
      } else {
        setMensagem('Conta aprovada! Redirecionando...')
        setTimeout(() => { window.location.href = '/funcionario' }, 1500)
      }
    } else {
      setMensagem('Ainda aguardando aprovacao. Tente mais tarde.')
    }
    setVerificando(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-gray-900 px-6 pt-14 pb-10 flex flex-col items-center">
        <div className="w-28 h-28 rounded-3xl bg-white flex items-center justify-center mb-5 shadow-lg p-2">
          <img src="/logo.png" alt="Organiza" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-white text-3xl font-bold tracking-tight">Organiza</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center">
          <Clock size={40} className="text-yellow-500" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">Aguardando aprovacao</h2>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            Seu cadastro foi recebido e esta sendo analisado. Voce sera notificado assim que for aprovado.
          </p>
        </div>

        {profile && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 w-full max-w-sm">
            <p className="text-blue-700 text-sm font-medium">
              {profile.role === 'dono_salao' ? 'Dono de Salao' : 'Funcionario'}
            </p>
            <p className="text-blue-500 text-xs mt-1">{profile.email}</p>
          </div>
        )}

        {mensagem && (
          <div className={'rounded-xl px-4 py-3 w-full max-w-sm ' +
            (mensagem.includes('aprovada') ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200')}>
            <p className={'text-sm text-center ' +
              (mensagem.includes('aprovada') ? 'text-green-600' : 'text-yellow-600')}>
              {mensagem}
            </p>
          </div>
        )}

        <button onClick={verificarStatus} disabled={verificando}
          className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-2xl font-medium disabled:opacity-50">
          <RefreshCw size={16} className={verificando ? 'animate-spin' : ''} />
          {verificando ? 'Verificando...' : 'Verificar status'}
        </button>

        <button onClick={logout} className="flex items-center gap-2 text-gray-400 text-sm">
          <LogOut size={16} />Sair da conta
        </button>
      </div>
    </div>
  )
}
