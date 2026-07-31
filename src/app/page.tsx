'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  useEffect(() => {
    async function redirecionar() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          window.location.href = '/login'
          return
        }

        const { data: prof, error } = await supabase
          .from('profiles')
          .select('role, aprovado, ativo, salao_id, acesso_total')
          .eq('id', session.user.id)
          .single()

        if (error || !prof) {
          window.location.href = '/login'
          return
        }

        if (!prof.ativo) {
          await supabase.auth.signOut()
          window.location.href = '/login'
          return
        }

        const acessoTotal = prof.role === 'dono_salao' ||
          (prof.role === 'funcionario' && prof.acesso_total === true)

        if (prof.role === 'admin_geral') {
          window.location.href = '/admin'
          return
        }

        if (!prof.aprovado) {
          window.location.href = '/aguardando'
          return
        }

        if (acessoTotal) {
          if (!prof.salao_id) {
            window.location.href = '/criar-salao'
            return
          }
          const { data: salao } = await supabase
            .from('saloes')
            .select('pausado, aprovado')
            .eq('id', prof.salao_id)
            .single()
          if (salao?.pausado) {
            await supabase.auth.signOut()
            window.location.href = '/login'
            return
          }
          window.location.href = !salao?.aprovado ? '/aguardando' : '/salao'
          return
        }

        if (prof.role === 'funcionario') {
          window.location.href = '/funcionario'
          return
        }

        if (prof.role === 'cliente') {
          window.location.href = '/cliente'
          return
        }

        window.location.href = '/login'
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
