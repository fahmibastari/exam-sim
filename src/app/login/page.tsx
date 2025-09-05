'use client'
import { signIn, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/post-login') // serahkan ke server page untuk routing per role
    }
  }, [status, router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)

    if (!res || res.error) {
      setError('Email/password salah atau Anda bukan admin.')
      return
    }
    router.replace('/post-login')
  }

  const inputCls =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Top Nav */}
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
              <path fill="currentColor" d="M12 3 2 8l10 5 8-4.1V15h2V8L12 3zm-6 9.2V16c0 2.2 3.1 4 6 4s6-1.8 6-4v-3.8l-6 3-6-3z"/>
            </svg>
          </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium uppercase tracking-wide text-blue-700">
                Platform Simulasi Ujian
              </span>
              <span className="text-xs text-gray-500">Untuk Siswa</span>
            </div>
          </div>

          <a
            href="/"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Beranda
          </a>
        </div>
      </header>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Masuk Admin</h1>
            <p className="mt-2 text-sm text-gray-600">
              Gunakan akun admin untuk mengelola paket &amp; hasil ujian.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-800">
                Email
              </label>
              <input
                id="email"
                className={inputCls}
                placeholder="nama@domain.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-800">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  className={`${inputCls} pr-20`}
                  placeholder="••••••••"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-pressed={showPwd}
                  aria-label={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                  title={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute inset-y-0 right-2 my-1 rounded-md px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {showPwd ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {loading ? 'Memproses…' : 'Masuk'}
            </button>

            <p className="text-center text-[12px] text-gray-500">
              Butuh bantuan? Hubungi super admin untuk reset akses.
            </p>
          </form>
        </div>
      </section>

  {/* Footer */}
<footer className="mt-16 border-t border-gray-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-gray-800 dark:bg-gray-950/70">
  <div className="mx-auto max-w-7xl px-6">
    {/* Top: brand + nav columns */}
    <div className="grid gap-10 py-12 md:grid-cols-4">
      {/* Brand */}
      <div className="md:col-span-1">
        <a href="/" className="inline-flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            {/* Simple mark (graduation cap) */}
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path fill="currentColor" d="M12 3 2 8l10 5 8-4.1V15h2V8L12 3zm-6 9.2V16c0 2.2 3.1 4 6 4s6-1.8 6-4v-3.8l-6 3-6-3z"/>
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Simulasi Ujian
          </span>
        </a>
        <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-400">
          Platform simulasi ujian untuk siswa & institusi—stabil, aman, dan mudah digunakan.
        </p>
      </div>

      {/* Columns */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Produk
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><a href="/features" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Fitur</a></li>
          <li><a href="/pricing" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Harga</a></li>
          <li><a href="/docs" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Dokumentasi</a></li>
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Perusahaan
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><a href="/about" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Tentang</a></li>
          <li><a href="/careers" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Karier</a></li>
          <li><a href="/contact" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Kontak</a></li>
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Dukungan
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><a href="/status" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Status Layanan</a></li>
          <li><a href="/privacy" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Kebijakan Privasi</a></li>
          <li><a href="/terms" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Syarat & Ketentuan</a></li>
        </ul>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="flex flex-col-reverse items-center justify-between gap-4 border-t border-gray-200 py-6 text-sm md:flex-row dark:border-gray-800">
      <p className="text-gray-600 dark:text-gray-400">
        © {new Date().getFullYear()} Simulasi Ujian. All rights reserved.
      </p>

      <div className="flex flex-col items-center gap-3 md:flex-row">
        <p className="text-gray-600 dark:text-gray-400">
          Dibuat oleh
        </p>

        <span className="hidden h-4 w-px bg-gray-200 md:block dark:bg-gray-800" aria-hidden="true" />

        {/* Social icons */}
        <div className="flex items-center gap-2">
  <a
    href="https://instagram.com/fahmibastari"
    target="_blank"
    rel="noopener noreferrer"
    title="Instagram @fahmibastari"
    aria-label="Instagram @fahmibastari"
    className="group inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-900/50"
  >
    <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-80 transition group-hover:opacity-100" aria-hidden="true">
      <path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7m9.5 2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/>
    </svg>
    <span className="underline decoration-gray-300/70 underline-offset-4 group-hover:decoration-gray-400">
      Fahmi Bastari
    </span>
  </a>

  <span className="h-4 w-px bg-gray-200 dark:bg-gray-800" aria-hidden="true" />

  <a
    href="https://instagram.com/qorrieaa"
    target="_blank"
    rel="noopener noreferrer"
    title="Instagram @qorriea"
    aria-label="Instagram @qorriea"
    className="group inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-900/50"
  >
    <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-80 transition group-hover:opacity-100" aria-hidden="true">
      <path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7m9.5 2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/>
    </svg>
    <span className="underline decoration-gray-300/70 underline-offset-4 group-hover:decoration-gray-400">
      Qorrie Aina
    </span>
  </a>
</div>

      </div>
    </div>
  </div>
</footer>
    </main>
  )
}
