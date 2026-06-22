import type { Metadata } from 'next'
import './globals.css'

export const metadata = {
  title: 'Organiza Salão',
  description: 'Sistema de gestão para salões de beleza',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-512.png',
    apple: '/apple-icon.png',
  },
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
