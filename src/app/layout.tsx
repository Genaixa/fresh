import type { Metadata, Viewport } from 'next'
import './globals.css'
import { NavBar } from '@/components/ui/NavBar'

export const metadata: Metadata = {
  title: 'Fresh & Fruity',
  description: 'Business management for Fresh & Fruity greengrocer',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2D5F2D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <NavBar />
      </body>
    </html>
  )
}
