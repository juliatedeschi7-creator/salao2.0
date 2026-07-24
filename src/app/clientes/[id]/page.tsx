'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function RedirecionarCliente() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id

  useEffect(() => {
    if (id) {
      router.replace(`/salao/clientes/${id}`)
    }
  }, [id, router])

  return null
}
