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
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-600 to-blue-400 shadow" />
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
      <footer className="mt-12 border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-center md:flex-row md:text-left">
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Simulasi Ujian.</p>
          <p className="text-xs text-gray-500">
            Dibuat oleh <span className="font-medium text-gray-700">fahmibastari</span> &{' '}
            <span className="font-medium text-gray-700">qorrieaina</span>.
          </p>
        </div>
      </footer>
    </main>
  )
}
