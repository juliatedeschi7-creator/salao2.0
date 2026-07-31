import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Organiza Salão',
  description: 'Sistema de gestão para salões de beleza',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Organiza Salão',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Organiza Salão" />
        <meta name="theme-color" content="#111827" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                  registration.unregister();
                }
              });
              navigator.serviceWorker.register('/sw.js').catch(function(err) {
                console.log('SW erro:', err);
              });
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
