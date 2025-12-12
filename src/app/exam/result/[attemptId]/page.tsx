// src/app/exam/result/[attemptId]/page.tsx
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CheckCircle2, Trophy, Home, ArrowRight, XCircle, Clock, FileText } from 'lucide-react'
import Link from 'next/link'

export const runtime = 'nodejs'

export default async function ResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const { attemptId } = await params

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { ExamPackage: { select: { title: true } } },
  })

  if (!attempt) notFound()

  // Kalau attempt milik user login, pastikan yang akses adalah pemiliknya
  if (attempt.userId) {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).id !== attempt.userId) {
      redirect('/exam/join')
    }
  }

  // Kalau belum submit, arahkan balik ke halaman pengerjaan
  if (!attempt.submittedAt) {
    redirect(`/exam/${attemptId}`)
  }

  // Hitung fallback total & benar dari nilai (kalau perlu)
  const total =
    attempt.total ??
    (await prisma.question.count({ where: { examPackageId: attempt.examPackageId } }))
  const score = attempt.score ?? 0
  const correct =
    total > 0 && attempt.score != null ? Math.round((attempt.score * total) / 100) : null

  // Grade color logic
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-100'
    if (s >= 60) return 'text-indigo-600 bg-indigo-50 border-indigo-100'
    if (s >= 40) return 'text-amber-600 bg-amber-50 border-amber-100'
    return 'text-rose-600 bg-rose-50 border-rose-100'
  }

  const scoreColor = getScoreColor(score)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden py-16 md:py-24">
          {/* Background Decoration */}
          <div className="absolute inset-0 z-0 bg-white">
            <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-50 blur-3xl opacity-50" />
            <div className="absolute top-1/2 -left-24 h-64 w-64 rounded-full bg-blue-50 blur-3xl opacity-50" />
          </div>

          <div className="relative z-10 mx-auto max-w-3xl px-6 lg:px-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 ring-4 ring-white">
              <Trophy className="h-10 w-10" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Hasil Ujian Anda
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Anda telah menyelesaikan paket ujian <span className="font-semibold text-slate-900">"{attempt.ExamPackage?.title ?? '-'}"</span>.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-20 -mt-10 relative z-20">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Score Card */}
            <div className="md:col-span-1 rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200 text-center flex flex-col items-center justify-center">
              <div className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">Nilai Akhir</div>
              <div className={`flex h-32 w-32 items-center justify-center rounded-full border-4 text-5xl font-extrabold shadow-sm ${scoreColor}`}>
                {score}
              </div>
              <p className="mt-4 text-xs text-slate-400">Skala 0 - 100</p>
            </div>

            {/* Details Card */}
            <div className="md:col-span-2 rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-500" />
                Detail Pengerjaan
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Peserta</label>
                  <div className="mt-1 font-medium text-slate-900">{attempt.participantName ?? '-'}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email / Info</label>
                  <div className="mt-1 font-medium text-slate-900">{attempt.participantEmail ?? attempt.participantInfo ?? '-'}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Waktu Submit</label>
                  <div className="mt-1 font-medium text-slate-900 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {attempt.submittedAt?.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Statistik</label>
                  <div className="mt-1 font-medium text-slate-900">
                    {total} Soal · {correct ?? '-'} Benar
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all"
                >
                  <Home className="h-4 w-4" />
                  Kembali ke Beranda
                </Link>
                <Link
                  href="/exam/join"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Pilih Paket Lain
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
