'use client'
import { useState } from 'react'
import { Heart, Scissors, Calendar, Star, Instagram, Phone, UserPlus, LogIn, Package, ChevronRight } from 'lucide-react'

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
  const corSec = salao.cor_secundaria || '#FCE4F3'

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

  const botoesExtras = [
    salao.instagram ? {
      id: 'instagram',
      icon: Instagram,
      titulo: 'Instagram',
      sub: `@${salao.instagram.replace('@', '')}`,
      href: `https://instagram.com/${salao.instagram.replace('@', '')}`,
      externo: true,
    } : null,
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
      <div className="min-h-screen flex flex-col items-center pb-12"
        style={{ background: `linear-gradient(160deg, ${cor} 0%, ${corSec} 45%, #ffffff 100%)` }}>

        {/* Header */}
        <div className="w-full flex flex-col items-center px-6 pt-16 pb-8">
          {/* Logo */}
          <div className="w-24 h-24 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-5 overflow-hidden">
            {salao.logo_url ? (
              <img src={salao.logo_url} alt={salao.nome} className="w-full h-full object-cover" />
            ) : (
              <img src="/logo.png" alt="Organiza Salão" className="w-16 h-16 object-contain"
                style={{ filter: `brightness(0) saturate(100%) hue-rotate(300deg)` }} />
            )}
          </div>

          {/* Nome em cursiva */}
          <h1 style={{
            fontFamily: "'Dancing Script', cursive",
            fontSize: '2.2rem',
            fontWeight: 700,
            color: 'white',
            textShadow: '0 2px 12px rgba(0,0,0,0.15)',
            textAlign: 'center',
            lineHeight: 1.2,
          }}>
            {nomePrincipal}
          </h1>
          {nomeSecundario && (
            <p className="text-white font-bold text-sm mt-1 text-center">{nomeSecundario}</p>
          )}
          {salao.descricao && (
            <p className="text-white/80 text-sm mt-3 text-center leading-relaxed max-w-xs">
              {salao.descricao}
            </p>
          )}
        </div>

        {/* Botões principais */}
        <div className="w-full max-w-sm px-5 flex flex-col gap-3">
          {botoesPrincipais.map(b => (
            <button key={b.id}
              onClick={() => navegar(b.href, b.id)}
              disabled={loading === b.id}
              className={`w-full rounded-2xl px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-all shadow-lg ${
                b.estilo === 'primario' ? 'bg-white' : 'bg-white/20 backdrop-blur border border-white/40'
              }`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                b.estilo === 'primario' ? '' : 'bg-white/20'
              }`}
                style={b.estilo === 'primario' ? { backgroundColor: `${cor}15` } : {}}>
                {loading === b.id
                  ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: cor }} />
                  : <b.icon size={22} style={{ color: b.estilo === 'primario' ? cor : 'white' }} />
                }
              </div>
              <div className="flex-1 text-left">
                <p className={`font-bold text-base ${b.estilo === 'primario' ? 'text-gray-900' : 'text-white'}`}>
                  {b.titulo}
                </p>
                <p className={`text-xs mt-0.5 ${b.estilo === 'primario' ? 'text-gray-400' : 'text-white/70'}`}>
                  {b.sub}
                </p>
              </div>
              <ChevronRight size={18} className={b.estilo === 'primario' ? 'text-gray-300' : 'text-white/50'} />
            </button>
          ))}

          {/* Divisor */}
          {botoesExtras.length > 0 && (
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-white/30" />
              <span className="text-white/50 text-xs">mais</span>
              <div className="flex-1 h-px bg-white/30" />
            </div>
          )}

          {/* Botões extras */}
          {botoesExtras.map((b: any) => (
            <a key={b.id} href={b.href} target="_blank" rel="noopener noreferrer"
              className="w-full bg-white/15 backdrop-blur border border-white/30 rounded-2xl px-5 py-3.5 flex items-center gap-4 active:scale-[0.98] transition-all">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <b.icon size={18} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-white text-sm">{b.titulo}</p>
                <p className="text-white/60 text-xs mt-0.5">{b.sub}</p>
              </div>
              <ChevronRight size={16} className="text-white/40" />
            </a>
          ))}
        </div>

        {/* Rodapé */}
        <div className="mt-12 flex flex-col items-center gap-1">
          <img src="/logo.png" alt="Organiza Salão" className="w-8 h-8 object-contain opacity-40" />
          <p className="text-white/40 text-xs">Powered by Organiza Salão</p>
        </div>
      </div>
    </>
  )
}
