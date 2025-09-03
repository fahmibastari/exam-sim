import type { Metadata } from 'next'
import Providers from './providers'
import './globals.css'

export const metadata: Metadata = { title: 'Exam Sim', description: 'Simulasi ujian' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
