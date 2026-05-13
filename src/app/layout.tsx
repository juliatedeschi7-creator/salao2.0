import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Organiza Salão',
  description: 'Sistema de gestão para salões de beleza',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
