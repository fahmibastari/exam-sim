export const runtime = 'nodejs'

import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft, Download, Clock, User, CheckCircle, XCircle, AlertCircle, HelpCircle } from 'lucide-react'

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
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link
              href={`/admin/packages/${id}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Paket
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Hasil Ujian
              </h1>
              {typeof pkgTimeLimitMin === 'number' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Clock className="h-3 w-3" />
                  {pkgTimeLimitMin} menit
                </span>
              )}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Daftar peserta dan nilai untuk paket <span className="font-semibold text-slate-900 dark:text-white">{pkgTitle}</span>.
            </p>

          </div>

          <a
            href={`/api/admin/packages/${pkgId}/export`}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </div>


        {/* Table Card */}
        <div className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/50 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th scope="col" className="px-4 py-3 w-14">#</th>
                  <th scope="col" className="px-4 py-3">Peserta</th>
                  <th scope="col" className="px-4 py-3">Waktu</th>
                  <th scope="col" className="px-4 py-3">Durasi</th>
                  <th scope="col" className="px-4 py-3">Skor</th>
                  <th scope="col" className="px-4 py-3 text-center">Nilai Akhir</th>
                  <th scope="col" className="px-4 py-3">Tipe</th>
                  <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attempts.length === 0 ? (
                  <tr>
                    <td className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50" colSpan={8}>
                      <div className="flex flex-col items-center justify-center gap-2">
                        <User className="h-8 w-8 text-slate-300" />
                        <p>Belum ada peserta yang mengerjakan ujian ini.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  attempts.map((a: AttemptRow, i: number) => {
                    const correct = correctOf({ score: a.score, total: a.total })
                    const name = a.participantName ?? a.User?.name ?? 'Tanpa Nama'
                    const email = a.participantEmail ?? a.User?.email ?? '-'
                    const sumber = a.User ? 'Registered' : 'Guest'

                    const scoreColor =
                      a.score == null ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' :
                        a.score >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                          a.score >= 60 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                            'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'

                    const scoreIcon = a.score == null ? <HelpCircle className="h-3 w-3" /> :
                      a.score >= 60 ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />

                    return (
                      <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{skip + i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{email}</div>
                          {a.participantInfo && <div className="text-xs text-slate-400 mt-0.5">{a.participantInfo}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span>Mulai: {a.startedAt.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            {a.submittedAt && <span className="text-slate-400">Selesai: {a.submittedAt.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium tabular-nums">{fmtDur(durationMs(a))}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {a.total ? `${correct ?? 0} / ${a.total}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreColor}`}>
                            {scoreIcon}
                            {a.score ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {sumber === 'Registered' ? (
                            <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-700/10 dark:ring-indigo-400/20">Member</span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-slate-500/10 dark:ring-slate-400/20">Guest</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/admin/attempts/${a.id}`}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            Detail
                          </a>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pager visible inside card if needed, or outside */}
          {totalCount > take && (
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
              <div>
                Halaman {p} dari {Math.ceil(totalCount / take)}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`?page=${Math.max(1, p - 1)}&size=${take}`}
                  className={`rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-700 ${p <= 1 ? 'pointer-events-none opacity-50' : ''}`}
                >
                  Prev
                </Link>
                <Link
                  href={`?page=${p + 1}&size=${take}`}
                  className={`rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-700 ${skip + take >= totalCount ? 'pointer-events-none opacity-50' : ''}`}
                >
                  Next
                </Link>
              </div>
            </div>
          )}
        </div>


        <p className="text-xs text-slate-500">
          *Durasi dihitung dari waktu mulai hingga submit. Nilai akhir dihitung dari (jawaban benar / total soal) × 100.
        </p>
      </section>
    </main>
  )
}

