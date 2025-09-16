import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Docker Bootcamp Chat',
  description: 'Real-time chat application for Docker bootcamp participants',
  keywords: ['docker', 'chat', 'bootcamp', 'real-time', 'socket.io'],
  authors: [{ name: 'Docker Bootcamp Team' }],
  viewport: 'width=device-width, initial-scale=1',
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
      </head>
      <body className="font-sans antialiased">
        <div id="root">
          {children}
        </div>
      </body>
    </html>
  )
}