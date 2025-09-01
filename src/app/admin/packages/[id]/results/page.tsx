import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export default async function PackageResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'ADMIN') redirect('/login')

  const pkg = await prisma.examPackage.findUnique({
    where: { id },
    select: { id: true, title: true, timeLimitMin: true },
  })
  if (!pkg) notFound()

  const attempts = await prisma.attempt.findMany({
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
  })

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-700 tracking-tight">
              Peserta &amp; Nilai — {pkg.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Ringkasan hasil ujian paket ini. {typeof pkg.timeLimitMin === 'number' && (
                <span className="inline-flex items-center ml-1 rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5 border border-blue-200">
                  ⏱️ {pkg.timeLimitMin} mnt
                </span>
              )}
            </p>
          </div>

          <a
            href={`/api/admin/packages/${pkg.id}/export`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            ⬇️ Export CSV
          </a>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 border-b sticky top-0">
                <tr className="[&>th]:text-left [&>th]:p-3">
                  <th scope="col" className="w-12">#</th>
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
                  attempts.map((a, i) => {
                    const correct = correctOf({ score: a.score, total: a.total })
                    const name = a.participantName ?? a.User?.name ?? '-'
                    const email = a.participantEmail ?? a.User?.email ?? '-'
                    const sumber = a.User ? 'Login' : 'Guest'

                    // Badge warna nilai (hanya tampilan)
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
                      <tr key={a.id} className="[&>td]:p-3 hover:bg-gray-50/60">
                        <td className="text-gray-600">{i + 1}</td>
                        <td className="font-medium text-gray-900 max-w-[220px] truncate">{name}</td>
                        <td className="text-gray-700 max-w-[240px] truncate">{email}</td>
                        <td className="text-gray-700 max-w-[200px] truncate">{a.participantInfo ?? '-'}</td>
                        <td className="text-gray-700 whitespace-nowrap">{a.startedAt.toLocaleString()}</td>
                        <td className="text-gray-700 whitespace-nowrap">{a.submittedAt ? a.submittedAt.toLocaleString() : '-'}</td>
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

        <p className="text-xs text-gray-500">
          *Durasi dihitung dari <i>startedAt → submittedAt</i>. Nilai = (benar/total) × 100.
        </p>
      </div>
    </div>
  )
}
