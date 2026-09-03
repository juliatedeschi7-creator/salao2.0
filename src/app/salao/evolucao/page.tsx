'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Search,
  Sparkles,
  User
} from 'lucide-react'

export default function EvolucaoIndexPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const [clientes, setClientes] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salao, setSalao] = useState<any>(null)

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.push('/login')
      return
    }

    carregarDados()
  }, [loading, profile])

  async function carregarDados() {
    if (!profile?.salao_id) return

    setCarregando(true)

    try {
      const [{ data: sal }, { data: cls, error }] =
        await Promise.all([
          supabase
            .from('saloes')
            .select('*')
            .eq('id', profile.salao_id)
            .single(),

          supabase
            .from('clientes')
            .select(
              'id, nome, telefone, email'
            )
            .eq(
              'salao_id',
              profile.salao_id
            )
            .order('nome', {
              ascending: true
            })
        ])

      if (error) {
        console.error(
          'Erro ao carregar clientes:',
          error.message
        )
        return
      }

      setSalao(sal)
      setClientes(cls || [])
    } finally {
      setCarregando(false)
    }
  }

  const cor =
    salao?.cor_primaria || '#E91E8C'

  const clientesFiltrados =
    clientes.filter(cliente =>
      String(cliente.nome || '')
        .toLowerCase()
        .includes(
          busca.toLowerCase()
        )
    )

  if (loading || carregando) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{
            borderColor: cor,
            borderTopColor: 'transparent'
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">

      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">

        <button
          onClick={() => router.back()}
          className="p-1"
        >
          <ArrowLeft
            size={22}
            className="text-gray-700"
          />
        </button>

        <div className="flex items-center gap-2">
          <Sparkles
            size={21}
            style={{ color: cor }}
          />

          <div>
            <h1 className="font-bold text-gray-900 text-lg">
              Evolução
            </h1>

            <p className="text-xs text-gray-400">
              Selecione uma cliente
            </p>
          </div>
        </div>

      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-2">

          <Search
            size={18}
            className="text-gray-400 shrink-0"
          />

          <input
            value={busca}
            onChange={e =>
              setBusca(e.target.value)
            }
            placeholder="Buscar cliente..."
            className="flex-1 outline-none text-sm text-gray-800 placeholder:text-gray-400"
          />

        </div>

        {clientesFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm">

            <div
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
              style={{
                backgroundColor: `${cor}15`
              }}
            >
              <User
                size={25}
                style={{ color: cor }}
              />
            </div>

            <p className="font-bold text-gray-700">
              Nenhuma cliente encontrada
            </p>

            <p className="text-xs text-gray-400 mt-1">
              Tente buscar por outro nome.
            </p>

          </div>
        ) : (
          <div className="space-y-2">

            {clientesFiltrados.map(cliente => (
              <button
                key={cliente.id}
                onClick={() =>
                  router.push(
                    `/salao/evolucao/${cliente.id}`
                  )
                }
                className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 text-left hover:shadow-md active:scale-[0.99] transition-all"
              >

                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${cor}15`
                  }}
                >
                  <User
                    size={20}
                    style={{
                      color: cor
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">

                  <p className="font-bold text-gray-800 text-sm truncate">
                    {cliente.nome}
                  </p>

                  {cliente.telefone && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cliente.telefone}
                    </p>
                  )}

                </div>

                <Sparkles
                  size={17}
                  className="text-gray-300 shrink-0"
                />

              </button>
            ))}

          </div>
        )}

      </div>
    </div>
  )
}