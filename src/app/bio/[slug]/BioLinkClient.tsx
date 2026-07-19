'use client'
import { useState } from 'react'
import { Heart, Scissors, Calendar, Star, Phone, UserPlus, LogIn, Package, ChevronRight } from 'lucide-react'

interface Props {
  salao: {
    id: string
    nome: string
    slug: string
    cor_primaria: string
    cor_secundaria: string
    descricao?: string
    logo_url?: string
    instagram?: string
    telefone?: string
  }
}

export default function BioLinkClient({ salao }: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  const cor = salao.cor_primaria || '#E91E8C'

  const partes = salao.nome?.split(' - ')
  const nomePrincipal = partes?.[0]
  const nomeSecundario = partes?.[1]

  function navegar(href: string, id: string) {
    setLoading(id)
    window.location.href = href
  }

  const botoesPrincipais = [
    {
      id: 'cliente',
      icon: LogIn,
      titulo: 'Já sou cliente',
      sub: 'Acesse sua conta e seus agendamentos',
      href: `/login?salao=${salao.slug}`,
      estilo: 'primario',
    },
    {
      id: 'novo',
      icon: UserPlus,
      titulo: 'Quero ser cliente',
      sub: 'Crie sua conta e agende seu horário',
      href: `/cadastro?salao=${salao.slug}`,
      estilo: 'secundario',
    },
  ]

  // Só WhatsApp por enquanto (Instagram removido a pedido)
  const botoesExtras = [
    salao.telefone ? {
      id: 'whatsapp',
      icon: Phone,
      titulo: 'WhatsApp',
      sub: 'Fale com a gente',
      href: `https://wa.me/55${salao.telefone.replace(/\D/g, '')}`,
      externo: true,
    } : null,
  ].filter(Boolean) as any[]

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet" />
      <div className="min-h-screen flex flex-col items-center pb-12 bg-white">

        {/* Header */}
        <div className="w-full flex flex-col items-center px-6 pt-16 pb-8">
          {/* Logo — recolorida dinamicamente na cor do salão via máscara CSS */}
          <div
            className="w-24 h-24 mb-5"
            style={{
              backgroundColor: cor,
              WebkitMaskImage: `url(${salao.logo_url || '/logo.png'})`,
              maskImage: `url(${salao.logo_url || '/logo.png'})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />

          {/* Nome em cursiva */}
          <h1 style={{
            fontFamily: "'Dancing Script', cursive",
            fontSize: '2.2rem',
            fontWeight: 700,
            color: cor,
            textAlign: 'center',
            lineHeight: 1.2,
          }}>
            {nomePrincipal}
          </h1>
          {nomeSecundario && (
            <p className="text-gray-900 font-bold text-sm mt-1 text-center">{nomeSecundario}</p>
          )}
          {salao.descricao && (
            <p className="text-gray-500 text-sm mt-3 text-center leading-relaxed max-w-xs">
              {salao.descricao}
            </p>
          )}
        </div>

        {/* Botões principais */}
        <div className="w-full max-w-sm px-5 flex flex-col gap-3">
          {botoesPrincipais.map(b => (
            <button
              key={b.id}
              onClick={() => navegar(b.href, b.id)}
              disabled={loading === b.id}
              className={`w-full rounded-2xl px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-all shadow-lg bg-white border ${
                b.estilo === 'secundario' ? 'border-2' : 'border-gray-100'
              }`}
              style={b.estilo === 'secundario' ? { borderColor: cor } : {}}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: cor }}
              >
                {loading === b.id ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <b.icon size={22} className="text-white" />
                )}
              </div>

              <div className="flex-1 text-left">
                <p className="font-bold text-base text-gray-900">
                  {b.titulo}
                </p>
                <p className="text-xs mt-0.5 text-gray-400">
                  {b.sub}
                </p>
              </div>

              <ChevronRight size={18} className="text-gray-300" />
            </button>
          ))}

          {/* Divisor */}
          {botoesExtras.length > 0 && (
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-xs">mais</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}

          {/* Botões extras (WhatsApp) */}
          {botoesExtras.map((b: any) => (
            <a
              key={b.id}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-3.5 flex items-center gap-4 active:scale-[0.98] transition-all shadow-lg"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: cor }}
              >
                <b.icon size={18} className="text-white" />
              </div>

              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900 text-sm">
                  {b.titulo}
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {b.sub}
                </p>
              </div>

              <ChevronRight size={16} className="text-gray-300" />
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
