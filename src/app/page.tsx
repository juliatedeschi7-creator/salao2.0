'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  useEffect(() => {
    async function redirecionar() {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout de conexão')), 8000)
        )

        const sessionPromise = supabase.auth.getSession()
        const sessionResult = await Promise.race([sessionPromise, timeoutPromise]) as any
        const session = sessionResult?.data?.session

        if (!session?.user) {
          window.location.href = '/login'
          return
        }

        const { data: prof, error } = await supabase.from('profiles')
          .select('role, aprovado, ativo, salao_id, acesso_total')
          .eq('id', session.user.id)
          .single()

        // Se houver erro ou o perfil não existir, vamos mandar para o login para evitar loop
        if (error || !prof) {
          console.error('Erro ao buscar perfil:', error)
          window.location.href = '/login'
          return
        }

        // Se o usuário estiver inativo, mas por segurança quisermos evitar travamento, 
        // verifique se a coluna 'ativo' realmente existe e está preenchida como true no banco
        const isDonoOuSocio = ['dono_salao', 'dono', 'socio'].includes(prof.role) || prof.acesso_total === true

        if (prof.role === 'admin_geral') {
          window.location.href = '/admin'
          return
        }
        if (isDonoOuSocio) {
          window.location.href = '/salao'
          return
        }
        if (['funcionario', 'profissional', 'comum'].includes(prof.role)) {
          window.location.href = '/funcionario'
          return
        }
        if (prof.role === 'cliente') {
          window.location.href = '/cliente'
          return
        }

        window.location.href = '/salao' // Fallback seguro para donos caso o cargo seja genérico
      } catch (err) {
        console.error('Erro no redirecionamento:', err)
        window.location.href = '/login'
      }
    }

    redirecionar()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
