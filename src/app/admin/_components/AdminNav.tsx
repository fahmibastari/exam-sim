'use client'
import { signOut, useSession } from 'next-auth/react'

export default function AdminNav() {
  const { data } = useSession()
  const email = data?.user?.email ?? 'Admin'
  const initial = (email?.[0] || 'A').toUpperCase()

  return (
    <header className="sticky top-0 z-20 w-full backdrop-blur bg-white/80 border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white font-bold"
            title="Admin"
          >
            ⚙️
          </span>
          <div className="leading-tight">
            <div className="font-extrabold text-blue-700">Dashboard Admin</div>
            <div className="text-[12px] text-gray-500">Kelola paket & ujian</div>
          </div>
        </div>

        {/* Right: User pill + Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-blue-100 bg-white shadow-sm px-2 py-1">
            <span
              aria-hidden
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold"
              title={email}
            >
              {initial}
            </span>
            <span className="text-sm text-gray-700 max-w-[180px] truncate">{email}</span>
            <span className="ml-1 hidden md:inline-flex items-center rounded-full bg-green-50 text-green-700 text-[10px] px-2 py-0.5 border border-green-200">
              ADMIN
            </span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 shadow-sm active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-blue-200"
            aria-label="Keluar dari akun admin"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
