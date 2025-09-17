import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Docker Bootcamp Chat',
  description: 'Real-time chat application for Docker bootcamp participants',
  keywords: ['docker', 'chat', 'bootcamp', 'real-time', 'socket.io', 'pwa'],
  authors: [{ name: 'Docker Bootcamp Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bootcamp Chat',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Bootcamp Chat',
    'application-name': 'Docker Bootcamp Chat',
    'msapplication-TileColor': '#0db7ed',
    'msapplication-config': '/browserconfig.xml',
    'theme-color': '#0db7ed',
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0db7ed' },
    { media: '(prefers-color-scheme: dark)', color: '#0a9bc7' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" 
          rel="stylesheet" 
        />
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0db7ed" />
        <meta name="background-color" content="#667eea" />
        
        {/* Apple Touch Icons - using existing favicon */}
        <link rel="apple-touch-icon" href="/favicon.png" />
        
        {/* Apple Web App Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bootcamp Chat" />
        
        {/* Windows Tiles */}
        <meta name="msapplication-TileImage" content="/favicon.png" />
        <meta name="msapplication-TileColor" content="#0db7ed" />
        
        {/* Additional PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Docker Bootcamp Chat" />
        
        {/* Prevent zoom on form inputs */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="font-sans antialiased">
        <div id="root">
          {children}
        </div>
      </body>
    </html>
  )
}