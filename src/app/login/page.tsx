'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const router = useRouter()

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
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-600 to-blue-400 shadow" />
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
      <footer className="mt-12 border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-center md:flex-row md:text-left">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Simulasi Ujian — Platform simulasi ujian untuk siswa.
          </p>
          <p className="text-xs text-gray-500">
            Dibuat oleh <span className="font-medium text-gray-700">fahmibastari</span> &{' '}
            <span className="font-medium text-gray-700">qorrieaina</span>.
          </p>
        </div>
      </footer>
    </main>
  )
}
