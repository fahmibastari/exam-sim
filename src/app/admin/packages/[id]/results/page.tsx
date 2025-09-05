export const runtime = 'nodejs'

import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

type AttemptRow = {
  id: string
  participantName: string | null
  participantEmail: string | null
  participantInfo: string | null
  startedAt: Date
  submittedAt: Date | null
  score: number | null
  total: number | null
  User: { name: string | null; email: string | null } | null
}

export default async function PackageResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; size?: string }>
}) {
  const { id } = await params
  const { page = '1', size = '50' } = await searchParams
  const take = Math.min(Math.max(parseInt(size) || 50, 10), 200)
  const p = Math.max(parseInt(page) || 1, 1)
  const skip = (p - 1) * take

  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'ADMIN') redirect('/login')

  const [pkg, totalCount, attempts] = await Promise.all([
    prisma.examPackage.findUnique({
      where: { id },
      select: { id: true, title: true, timeLimitMin: true },
    }),
    prisma.attempt.count({ where: { examPackageId: id } }),
    prisma.attempt.findMany({
      where: { examPackageId: id },
      select: {
        id: true,
        participantName: true,
        participantEmail: true,
        participantInfo: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        total: true,
        User: { select: { name: true, email: true } },
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take,
    }),
  ])

  if (!pkg) notFound()

  // Narrowing untuk TypeScript
  const pkgId = pkg.id
  const pkgTitle = pkg.title
  const pkgTimeLimitMin = pkg.timeLimitMin

  function durationMs(a: { startedAt: Date; submittedAt: Date | null }) {
    if (!a.submittedAt) return null
    return a.submittedAt.getTime() - a.startedAt.getTime()
  }
  function fmtDur(ms: number | null) {
    if (ms == null) return '-'
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m}m ${s}s`
  }
  function correctOf(a: { score: number | null; total: number | null }) {
    if (a.score == null || !a.total) return null
    return Math.round((a.score * a.total) / 100)
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Header */}
        <a
            href="/admin/packages"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Kembali ke Daftar Paket
          </a>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Peserta &amp; Nilai — {pkgTitle}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Ringkasan hasil ujian paket ini.
              {typeof pkgTimeLimitMin === 'number' && (
                <span className="ml-2 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  Batas waktu: {pkgTimeLimitMin} menit
                </span>
              )}
            </p>
          </div>

          <a
            href={`/api/admin/packages/${pkgId}/export`}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Export CSV
          </a>
        </div>

        {/* Table Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 border-b bg-gray-50 text-gray-700">
                <tr className="[&>th]:p-3 [&>th]:text-left">
                  <th scope="col" className="w-14">#</th>
                  <th scope="col">Nama</th>
                  <th scope="col">Email</th>
                  <th scope="col">Info</th>
                  <th scope="col">Mulai</th>
                  <th scope="col">Submit</th>
                  <th scope="col">Durasi</th>
                  <th scope="col">Benar/Total</th>
                  <th scope="col">Nilai</th>
                  <th scope="col">Sumber</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attempts.length === 0 ? (
                  <tr>
                    <td className="p-4 text-gray-600" colSpan={10}>
                      Belum ada peserta.
                    </td>
                  </tr>
                ) : (
                  attempts.map((a: AttemptRow, i: number) => {
                    const correct = correctOf({ score: a.score, total: a.total })
                    const name = a.participantName ?? a.User?.name ?? '-'
                    const email = a.participantEmail ?? a.User?.email ?? '-'
                    const sumber = a.User ? 'Login' : 'Guest'

                    const scoreColor =
                      a.score == null ? 'bg-gray-100 text-gray-700 border-gray-200' :
                      a.score >= 80 ? 'bg-green-50 text-green-700 border-green-200' :
                      a.score >= 60 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      'bg-red-50 text-red-700 border-red-200'

                    const sourceBadge =
                      sumber === 'Login'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-gray-50 text-gray-700 border-gray-200'

                    return (
                      <tr key={a.id} className="hover:bg-gray-50/60 [&>td]:p-3">
                        <td className="text-gray-600">{skip + i + 1}</td>
                        <td className="max-w-[220px] truncate font-medium text-gray-900">{name}</td>
                        <td className="max-w-[240px] truncate text-gray-700">{email}</td>
                        <td className="max-w-[200px] truncate text-gray-700">{a.participantInfo ?? '-'}</td>
                        <td className="whitespace-nowrap text-gray-700">{a.startedAt.toLocaleString()}</td>
                        <td className="whitespace-nowrap text-gray-700">{a.submittedAt ? a.submittedAt.toLocaleString() : '-'}</td>
                        <td className="text-gray-800">{fmtDur(durationMs(a))}</td>
                        <td className="text-gray-800">
                          {a.total ? `${correct ?? 0}/${a.total}` : '-'}
                        </td>
                        <td>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreColor}`}>
                            {a.score ?? '-'}
                          </span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${sourceBadge}`}>
                            {sumber}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pager */}
        {totalCount > take && (
          <div className="flex items-center justify-between border-t border-gray-100 p-3 text-sm text-gray-700">
            <div>
              Halaman {p} dari {Math.ceil(totalCount / take)} •
              <span className="ml-1">Menampilkan {attempts.length} dari {totalCount} attempt</span>
            </div>
            <div className="flex gap-2">
              <a
                href={`?page=${Math.max(1, p - 1)}&size=${take}`}
                className={`rounded-lg border px-3 py-1.5 ${p > 1 ? 'bg-white hover:bg-gray-50' : 'pointer-events-none cursor-not-allowed bg-gray-100 text-gray-400'}`}
              >
                Prev
              </a>
              <a
                href={`?page=${p + 1}&size=${take}`}
                className={`rounded-lg border px-3 py-1.5 ${skip + take < totalCount ? 'bg-white hover:bg-gray-50' : 'pointer-events-none cursor-not-allowed bg-gray-100 text-gray-400'}`}
              >
                Next
              </a>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500">
          *Durasi dihitung dari <i>startedAt → submittedAt</i>. Nilai = (benar/total) × 100.
        </p>
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
