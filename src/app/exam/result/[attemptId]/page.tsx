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
    include: { ExamPackage: { select: { title: true } } }
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-blue-700 tracking-tight flex items-center justify-center gap-2">
            <span aria-hidden>🎉</span> Hasil Ujian
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Mantap! Berikut rangkuman hasil ujianmu. Tetap semangat belajar ya! 💪
          </p>
        </div>

        {/* Ringkasan Identitas */}
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-5 mb-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-5 mb-6">
          <div className="flex items-center gap-4">
            {/* Circle badge skor sederhana */}
            <div
              className="flex items-center justify-center w-20 h-20 rounded-full bg-blue-600 text-white font-extrabold text-2xl shadow-md"
              aria-label={`Nilai ${score}`}
              title={`Nilai ${score}`}
            >
              {score}
            </div>

            <div className="flex-1">
              <div className="text-lg font-semibold text-gray-900">
                Nilai Akhir
              </div>
              <div className="text-sm text-gray-600">
                Total Soal: {total}{' '}
                {correct != null && (
                  <>
                    · Benar: <span className="font-medium text-gray-800">{correct}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Terus tingkatkan hasilmu di percobaan berikutnya. Kamu pasti bisa! 🌟
              </p>
            </div>
          </div>
        </div>

        {/* Aksi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-4 py-3 border border-gray-200 transition"
          >
            ⏮️ Ke Halaman Depan
          </a>
          <a
            href="/exam/join"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 shadow-md transition"
          >
            📚 Pilih Paket Lain
          </a>
        </div>
      </div>
    </div>
  )
}
