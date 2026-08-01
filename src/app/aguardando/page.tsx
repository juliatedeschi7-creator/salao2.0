'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Clock, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AguardandoPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && profile && (profile as any).aprovado) {
      if (profile.tipo === 'dono_salao') window.location.href = '/criar-salao'
      else if (profile.tipo === 'funcionario') window.location.href = '/funcionario'
    }
  }, [loading, profile])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
        <Clock size={40} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Conta em análise</h1>
      <p className="text-gray-500 max-w-sm mb-8">
        Sua conta foi cadastrada com sucesso e está aguardando a aprovação do administrador do sistema. Você receberá acesso assim que for aprovada.
      </p>
      <button onClick={handleLogout}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium shadow-sm hover:bg-gray-50 transition-all">
        <LogOut size={18} /> Sair da conta
      </button>
    </div>
  )
}
