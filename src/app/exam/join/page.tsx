'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

const JoinSchema = z.object({
  examPackageId: z.string().min(1),
  token: z.string().trim().min(4),
  participant: z.object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter'),
    email: z
      .string()
      .trim()
      .email('Email tidak valid')
      .optional()
      .or(z.literal(''))
      .transform((v) => v || undefined),
    info: z.string().trim().optional(),
  }),
})

type Pkg = { id: string; title: string; description?: string | null; timeLimitMin?: number | null }

export default function JoinExamPage() {
  const router = useRouter()
  const [pkgs, setPkgs] = useState<Pkg[]>([])
  const [pkg, setPkg] = useState('')
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [info, setInfo] = useState('') // kelas/nisn/no hp, opsional
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/packages/active', { signal: ac.signal })
        if (!res.ok) throw new Error('Gagal memuat paket')
        const data: Pkg[] = await res.json()
        if (mounted.current) setPkgs(data)
      } catch {
        if (mounted.current) setPkgs([])
      }
    })()
    return () => {
      mounted.current = false
      ac.abort()
    }
  }, [])

  const canSubmit = useMemo(
    () => pkg && token.trim().length >= 4 && name.trim().length >= 2 && !loading,
    [pkg, token, name, loading]
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = JoinSchema.safeParse({
      examPackageId: pkg,
      token,
      participant: { name, email, info },
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Data tidak valid')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/exams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      let data: any = null
      try {
        data = await res.json()
      } catch {
        /* mungkin HTML/error page */
      }

      if (!res.ok) {
        setError(data?.error || `Gagal (${res.status})`)
        setLoading(false)
        return
      }

      router.push(`/exam/${data.attemptId}`)
    } catch {
      setError('Terjadi masalah jaringan')
      setLoading(false)
    }
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
            href="/login"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Admin Login
          </a>
        </div>
      </header>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mx-auto max-w-xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Gabung Ujian</h1>
            <p className="mt-2 text-sm text-gray-600">
              Pilih paket, masukkan token, dan isi data diri dengan benar.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            {pkgs.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                Belum ada paket aktif yang tersedia.
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                {/* Paket */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-800">
                    Paket Ujian <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={pkg}
                    onChange={(e) => setPkg(e.target.value)}
                    className={inputCls}
                    required
                  >
                    <option value="">— Pilih paket aktif —</option>
                    {pkgs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} {p.timeLimitMin ? `(${p.timeLimitMin} menit)` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Pilih paket yang disediakan guru/penyelenggara.</p>
                </div>

                {/* Token */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-800">
                    Token Paket <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Contoh: ABCD"
                    className={inputCls}
                    required
                    inputMode="text"
                  />
                  <p className="mt-1 text-xs text-gray-500">Minta token ke guru/panitia. Minimal 4 karakter.</p>
                </div>

                {/* Data peserta */}
                <div className="grid gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-800">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama lengkapmu"
                      className={inputCls}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-800">Email (opsional)</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className={inputCls}
                    />
                    <p className="mt-1 text-xs text-gray-500">Digunakan untuk pengiriman hasil (jika diaktifkan).</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-800">
                      Kelas / NISN / No. HP (opsional)
                    </label>
                    <input
                      value={info}
                      onChange={(e) => setInfo(e.target.value)}
                      placeholder="Contoh: 6A / 0123456789 / 0812xxxxxx"
                      className={inputCls}
                    />
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
                  disabled={!canSubmit}
                  className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {loading ? 'Memproses…' : 'Mulai Ujian'}
                </button>

                <p className="text-center text-[12px] text-gray-500">
                  Dengan menekan “Mulai Ujian”, Anda menyetujui tata tertib ujian.
                </p>
              </form>
            )}
          </div>
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
