import type { Metadata } from 'next'
import Providers from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'ExamLent',
    template: '%s — ExamLent',
  },
  description: 'Simulasi ujian',
  applicationName: 'ExamLent',
  themeColor: '#111827',
  // Favicon & Apple Touch Icon (PWA icons lain sudah di handle oleh app/manifest.ts)
  icons: {
    icon: '/favicon.ico?v=2',                 // ganti ikon Vercel di tab browser
    apple: '/icons/apple-touch-icon.v2.png',  // 180x180 untuk iOS "Add to Home Screen"
  },
}


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
