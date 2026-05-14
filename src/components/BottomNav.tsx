'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LucideIcon } from 'lucide-react'

interface NavItem {
  icon: LucideIcon
  label: string
  href: string
}

interface BottomNavProps {
  items: NavItem[]
  corPrimaria?: string
}

export default function BottomNav({ items, corPrimaria = '#E91E8C' }: BottomNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 flex items-center justify-around z-30">
      {items.map(({ icon: Icon, label, href }) => {
        const ativo = pathname === href
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all"
            style={ativo ? { color: corPrimaria } : { color: '#9ca3af' }}
          >
            <Icon size={22} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
