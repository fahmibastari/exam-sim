'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

const JoinSchema = z.object({
  examPackageId: z.string().min(1),
  token: z.string().trim().min(4),
  participant: z.object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter'),
    email: z.string().trim().email('Email tidak valid').optional().or(z.literal('')).transform(v => v || undefined),
    info: z.string().trim().optional()
  })
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
    return () => { mounted.current = false; ac.abort() }
  }, [])

  const canSubmit = useMemo(() => pkg && token.trim().length >= 4 && name.trim().length >= 2 && !loading, [pkg, token, name, loading])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = JoinSchema.safeParse({
      examPackageId: pkg,
      token,
      participant: { name, email, info }
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
        body: JSON.stringify(parsed.data)
      })

      let data: any = null
      try { data = await res.json() } catch { /* mungkin HTML/error page */ }

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-3xl font-extrabold text-blue-700 tracking-tight flex items-center justify-center gap-2">
            <span aria-hidden>🎒</span> Gabung Ujian
          </h1>
          <p className="text-gray-600 mt-2 text-sm">
            Pilih paket, masukkan token, dan isi data diri dengan benar ya. Semangat! 💪
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-5">
          {pkgs.length === 0 ? (
            <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-2">
              <span aria-hidden>🕒</span>
              Belum ada paket aktif.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {/* Paket */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">
                  Paket Ujian <span className="text-red-500">*</span>
                </label>
                <select
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value)}
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black"
                  required
                >
                  <option value="">— Pilih paket aktif —</option>
                  {pkgs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} {p.timeLimitMin ? `(⌛ ${p.timeLimitMin} mnt)` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-black-500">Pilih paket yang disediakan gurumu/penyelenggara.</p>
              </div>

              {/* Token */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">
                  Token Paket <span className="text-red-500">*</span>
                </label>
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Contoh: ABCD"
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black"
                  required
                  inputMode="text"
                />
                <p className="text-xs text-gray-500">Minta token ke guru/panitia. Minimal 4 karakter.</p>
              </div>

              {/* Data peserta */}
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-800">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama lengkapmu"
                    className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-800">Email (opsional)</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black"
                  />
                  <p className="text-xs text-gray-500">Untuk pengiriman hasil (jika diaktifkan).</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-800">Kelas / NISN / No. HP (opsional)</label>
                  <input
                    value={info}
                    onChange={(e) => setInfo(e.target.value)}
                    placeholder="Contoh: 6A / 0123456789 / 0812xxxxxx"
                    className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3"
                >
                  ⚠️ {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 transition-all shadow-md active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-blue-200"
              >
                {loading ? 'Memproses…' : '🚀 Mulai Ujian'}
              </button>

              {/* Catatan kecil */}
              <p className="text-[12px] text-gray-500 text-center">
                Dengan menekan “Mulai Ujian”, kamu menyetujui tata tertib ujian.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
