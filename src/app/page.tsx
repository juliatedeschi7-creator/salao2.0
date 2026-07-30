'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  useEffect(() => {
    async function redirecionar() {
      try {
        // Timeout de segurança de 8 segundos para evitar loading infinito se a internet cair
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout de conexão')), 8000)
        )

        const sessionPromise = supabase.auth.getSession()
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any

        if (!session?.user) {
          window.location.href = '/login'
          return
        }

        const { data: prof, error } = await supabase.from('profiles')
          .select('role, aprovado, ativo, salao_id, acesso_total')
          .eq('id', session.user.id)
          .single()

        if (error || !prof || prof.ativo === false) {
          window.location.href = '/login'
          return
        }

        // Reconhece tanto os cargos novos (socio, dono) quanto os antigos
        const isDonoOuSocio = ['dono_salao', 'dono', 'socio'].includes(prof.role) || prof.acesso_total === true

        if (prof.role === 'admin_geral') {
          window.location.href = '/admin'
          return
        }
        if (prof.aprovado === false) {
          window.location.href = '/aguardando'
          return
        }
        if (isDonoOuSocio) {
          window.location.href = '/salao'
          return
        }
        if (prof.role === 'funcionario' || prof.role === 'profissional' || prof.role === 'comum') {
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
