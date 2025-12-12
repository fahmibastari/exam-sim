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
      ; (async () => {
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
    'block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-xl ring-1 ring-slate-900/5 dark:ring-slate-100/10 transition-all">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Gabung Ujian</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Pilih paket, masukkan token, dan isi data diri dengan benar.
          </p>
        </div>

        {pkgs.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-6 text-center text-sm text-slate-700 dark:text-slate-300">
            <p className="font-medium">Belum ada paket aktif yang tersedia.</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">Silakan hubungi pengawas ujian Anda.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6" noValidate>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Paket */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pilih paket yang disediakan guru/penyelenggara.</p>
              </div>

              {/* Token */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Token Paket <span className="text-red-500">*</span>
                </label>
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Contoh: ABCD"
                  className={`${inputCls} font-mono uppercase tracking-wider`}
                  required
                  inputMode="text"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Minta token ke guru/panitia. Minimal 4 karakter.</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-slate-900 px-2 text-xs font-medium text-slate-500 dark:text-slate-400">Data Peserta</span>
              </div>
            </div>

            {/* Data peserta */}
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email (opsional)</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-slate-500">Digunakan untuk pengiriman hasil (jika diaktifkan).</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {loading ? 'Memproses…' : 'Mulai Ujian'}
            </button>

            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Dengan menekan “Mulai Ujian”, Anda menyetujui tata tertib ujian.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
