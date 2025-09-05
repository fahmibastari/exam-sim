// components/site-header.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const isActive = pathname === href
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        isActive
          ? 'font-medium text-gray-900 dark:text-gray-100'
          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
      ].join(' ')}
    >
      {label}
    </Link>
  )
}

function InitialAvatar({ name }: { name?: string | null }) {
  const initials =
    (name?.match(/\b\w/g) || ['U']).slice(0, 2).join('').toUpperCase()
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
      {initials}
    </span>
  )
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role as string | undefined

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-gray-800 dark:bg-gray-950/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
        {/* Brand */}
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
              <path fill="currentColor" d="M12 3 2 8l10 5 8-4.1V15h2V8L12 3zm-6 9.2V16c0 2.2 3.1 4 6 4s6-1.8 6-4v-3.8l-6 3-6-3z"/>
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Simulasi Ujian
          </span>
        </Link>

        {/* Actions (Desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          {status === 'authenticated' ? (
            <>
              {role === 'ADMIN' && (
                <Link
                  href="/admin/packages"
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm text-gray-700 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-200 dark:hover:text-white"
                >
                  Admin
                </Link>
              )}
              <span className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-200">
                <InitialAvatar name={session.user?.name ?? session.user?.email} />
                {session.user?.name ?? session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-gray-900"
              >
                Logout
              </button>
            </>
          ) : status === 'loading' ? null : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center rounded-md px-3 py-2 text-sm text-gray-700 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-200 dark:hover:text-white"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Daftar
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="inline-flex items-center rounded-md p-2 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-300 dark:hover:bg-gray-900 md:hidden"
        >
          <span className="sr-only">Toggle menu</span>
          {open ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="currentColor" d="M19 6 6 19M6 6l13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="currentColor" d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z"/>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        id="mobile-menu"
        className={['md:hidden', open ? 'block' : 'hidden'].join(' ')}
      >
        <div className="space-y-1 border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          {status === 'authenticated' ? (
            <>
              <div className="flex items-center gap-3 px-1 py-2">
                <InitialAvatar name={session.user?.name ?? session.user?.email} />
                <div className="text-sm text-gray-800 dark:text-gray-200">
                  {session.user?.name ?? session.user?.email}
                </div>
              </div>

              {role === 'ADMIN' && (
                <Link
                  href="/admin/packages"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900"
                >
                  Admin
                </Link>
              )}

              <button
                onClick={() => { setOpen(false); signOut({ callbackUrl: '/login' }) }}
                className="mt-1 w-full rounded-md border px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-900"
              >
                Logout
              </button>
            </>
          ) : status === 'loading' ? null : (
            <div className="mt-2 flex items-center gap-2 px-1">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="inline-flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="inline-flex flex-1 items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Daftar
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
