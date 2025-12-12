import type { Metadata, Viewport } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import Providers from './providers'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#4f46e5',
}

export const metadata: Metadata = {
  title: {
    default: 'ExamSim - Platform Ujian Online',
    template: '%s — ExamSim',
  },
  description: 'Simulasi ujian online yang modern & aman.',
  applicationName: 'ExamSim',
  icons: {
    icon: '/favicon.ico?v=2',
    apple: '/icons/apple-touch-icon.v2.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="scroll-smooth" suppressHydrationWarning>
      <body
        className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 antialiased selection:bg-indigo-100 selection:text-indigo-700"
        suppressHydrationWarning
      >
        <Providers>
          <Header />
          <main className="flex-1 w-full">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
