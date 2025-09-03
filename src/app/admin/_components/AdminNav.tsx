'use client'
import { signOut, useSession } from 'next-auth/react'

export default function AdminNav() {
  const { data } = useSession()
  const email = data?.user?.email ?? 'Admin'
  const initial = (email?.[0] || 'A').toUpperCase()

  return (
<header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-600 to-blue-400 shadow" />
            <div className="flex flex-col">
              <span className="text-sm font-medium uppercase tracking-wide text-blue-700">
                Platform Simulasi Ujian
              </span>
              <span className="text-xs text-gray-500">Admin</span>
            </div>
          </div>
          <button
onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Logout
          </button>
        </div>
      </header>
  )
}
