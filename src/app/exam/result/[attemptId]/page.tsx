// src/app/exam/result/[attemptId]/page.tsx
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect, notFound } from 'next/navigation'

export const runtime = 'nodejs'

// params adalah Promise di Next.js 15 -> await
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
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Hasil Ujian</h1>
            <p className="mt-2 text-sm text-gray-600">
              Berikut ringkasan hasil ujian Anda. Tetap semangat belajar.
            </p>
          </div>

          {/* Ringkasan Identitas */}
          <div className="mb-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Paket</dt>
                <dd className="font-semibold text-gray-900">{attempt.ExamPackage.title}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Nama</dt>
                <dd className="font-semibold text-gray-900">{attempt.participantName ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900">{attempt.participantEmail ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Info</dt>
                <dd className="text-gray-900">{attempt.participantInfo ?? '-'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Waktu submit</dt>
                <dd className="text-gray-900">{attempt.submittedAt?.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* Skor */}
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-5">
              {/* Badge skor */}
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-extrabold text-white shadow-md"
                aria-label={`Nilai ${score}`}
                title={`Nilai ${score}`}
              >
                {score}
              </div>

              <div className="flex-1">
                <div className="text-lg font-semibold text-gray-900">Nilai Akhir</div>
                <div className="text-sm text-gray-600">
                  Total Soal: {total}{' '}
                  {correct != null && (
                    <>
                      · Benar: <span className="font-medium text-gray-800">{correct}</span>
                    </>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Gunakan hasil ini sebagai bahan evaluasi dan peningkatan berikutnya.
                </p>
              </div>
            </div>
          </div>

          {/* Aksi */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Kembali ke Beranda
            </a>
            <a
              href="/exam/join"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Pilih Paket Lain
            </a>
          </div>
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
