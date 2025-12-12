export const runtime = 'nodejs'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { ReactNode } from 'react'

type QType = 'SINGLE_CHOICE' | 'MULTI_SELECT' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'ESSAY' | 'NUMBER' | 'RANGE'

export default async function ReviewAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const { attemptId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'ADMIN') redirect('/login')

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      examPackageId: true,
      participantName: true,
      participantEmail: true,
      participantInfo: true,
      startedAt: true,
      submittedAt: true,
      score: true, // persen 0–100
      total: true, // total poin
      ExamPackage: { select: { id: true, title: true } },
    }
  })
  if (!attempt) notFound()

  // ambil semua soal paket + semua jawaban attempt
  const [questions, answers] = await Promise.all([
    prisma.question.findMany({
      where: { examPackageId: attempt.examPackageId },
      include: { options: true },
      orderBy: { order: 'asc' },
    }),
    prisma.attemptAnswer.findMany({
      where: { attemptId: attempt.id },
      select: {
        id: true,
        questionId: true,
        selectedOptionIds: true,
        valueText: true,
        valueNumber: true,
        score: true,
        gradedAt: true,
      },
    }),
  ])

  const ansByQ = new Map(answers.map(a => [a.questionId, a]))
  const totalPoints = questions.reduce((s, q) => s + q.points, 0)

  // ====== SERVER ACTION: simpan skor manual + recalc attempt ======
  async function saveGrades(formData: FormData) {
    'use server'
    const attemptNow = await prisma.attempt.findUnique({ where: { id: attemptId } })
    if (!attemptNow) throw new Error('Attempt tidak ditemukan')

    const qs = await prisma.question.findMany({
      where: { examPackageId: attemptNow.examPackageId },
      select: { id: true, points: true, type: true },
    })
    const qPoints = new Map(qs.map(q => [q.id, { points: q.points, type: q.type as QType }]))

    const entries = Array.from(formData.entries())
    const updates: Array<ReturnType<typeof prisma.attemptAnswer.update>> = []

    for (const [key, val] of entries) {
      if (!key.startsWith('score_')) continue
      const answerId = key.substring('score_'.length)
      const raw = String(val ?? '').trim()
      if (raw === '') continue

      const num = Number(raw)
      if (Number.isNaN(num)) continue

      const ans = await prisma.attemptAnswer.findUnique({
        where: { id: answerId },
        select: { id: true, questionId: true }
      })
      if (!ans) continue

      const meta = qPoints.get(ans.questionId)
      const max = meta?.points ?? 0
      const safe = Math.max(0, Math.min(num, max))

      updates.push(
        prisma.attemptAnswer.update({
          where: { id: answerId },
          data: { score: safe, gradedAt: new Date() }
        })
      )
    }

    if (updates.length) {
      await prisma.$transaction(updates)
    }

    const [allAnswers, allQuestions] = await Promise.all([
      prisma.attemptAnswer.findMany({
        where: { attemptId: attemptId },
        select: { score: true },
      }),
      prisma.question.findMany({
        where: { examPackageId: attemptNow.examPackageId },
        select: { points: true },
      })
    ])

    const obtained = allAnswers.reduce((s, a) => s + (a.score ?? 0), 0)
    const total = allQuestions.reduce((s, q) => s + q.points, 0)
    const percent = total > 0 ? Math.round((obtained / total) * 10000) / 100 : 0 // 2 desimal

    await prisma.attempt.update({
      where: { id: attemptId },
      data: { score: percent, total }
    })

    revalidatePath(`/admin/attempts/${attemptId}`)
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'
  const numCls =
    'w-28 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  function formatDate(d: Date | null) {
    return d ? new Date(d).toLocaleString() : '-'
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <a
          href="/admin/packages"
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Kembali ke Daftar Paket
        </a>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Review Attempt — {attempt.ExamPackage?.title}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {attempt.participantName ?? '-'} • {attempt.participantEmail ?? '-'}
              {attempt.participantInfo ? <> • {attempt.participantInfo}</> : null}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Mulai: {formatDate(attempt.startedAt)} • Submit: {formatDate(attempt.submittedAt)}
            </p>
          </div>

          <div className="text-right">
            <div className="text-sm text-slate-600 dark:text-slate-400">Total Poin: <b>{totalPoints}</b></div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Skor Saat Ini{' '}
              <span className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                {attempt.score ?? 0}% (
                {Math.round(((attempt.score ?? 0) / 100) * (attempt.total ?? totalPoints))}
                /{attempt.total ?? totalPoints})
              </span>
            </div>
          </div>
        </div>

        {/* Form penilaian manual */}
        <form action={saveGrades} className="space-y-4">
          {questions.map(q => {
            const a = ansByQ.get(q.id)
            const type = q.type as QType

            let answerBlock: ReactNode = null
            if (!a) {
              answerBlock = <div className="text-sm text-slate-500 dark:text-slate-500 italic">Belum ada jawaban.</div>
            } else if (type === 'SINGLE_CHOICE' || type === 'MULTI_SELECT' || type === 'TRUE_FALSE') {
              const byId = new Map(q.options.map(o => [o.id, o]))
              const chosen = (a.selectedOptionIds ?? []).map(id => byId.get(id)?.label ?? '—')
              const correct = q.options.filter(o => o.isCorrect).map(o => o.label).join(', ')
              answerBlock = (
                <div className="text-sm text-slate-800 dark:text-slate-200">
                  Dipilih: <b>{chosen.join(', ') || '—'}</b>
                  <span className="ml-3 text-slate-600 dark:text-slate-400">• Benar: <b>{correct || '—'}</b></span>
                </div>
              )
            } else if (type === 'NUMBER' || type === 'RANGE') {
              const s = (q.settings as any) || {}
              answerBlock = (
                <div className="text-sm text-slate-800 dark:text-slate-200">
                  Jawaban: <b>{typeof a?.valueNumber === 'number' ? a.valueNumber : '—'}</b>
                  <span className="ml-3 text-slate-600 dark:text-slate-400">
                    • {type === 'NUMBER' ? `Target=${s.target} Tol=${s.tolerance ?? 0}` : `Range=[${s.min}–${s.max}]`}
                  </span>
                </div>
              )
            } else {
              // SHORT_TEXT / ESSAY
              answerBlock = (
                <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {a?.valueText ?? '—'}
                </div>
              )
            }

            const isManual = type === 'SHORT_TEXT' || type === 'ESSAY'
            const help = isManual
              ? 'Nilai manual untuk soal ini.'
              : 'Otomatis dinilai. Isi jika ingin override (opsional).'
            const current = a?.score ?? ''

            return (
              <div key={q.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">
                    {q.order}
                  </span>
                  <div className="font-semibold text-slate-900 dark:text-white flex-1">
                    {q.type.replace(/_/g, ' ')} • {q.points} poin
                  </div>
                </div>

                <div className="mt-2 text-slate-900 dark:text-slate-100">{q.text}</div>
                {q.imageUrl && (
                  <img
                    src={q.imageUrl}
                    alt="gambar soal"
                    className="mt-3 max-h-64 rounded-xl border border-slate-200 dark:border-slate-700 object-contain"
                  />
                )}

                <div className="mt-3">{answerBlock}</div>

                <div className="mt-3 flex items-center gap-3">
                  {a ? (
                    <>
                      <input
                        name={`score_${a.id}`}
                        type="number"
                        step="0.01"
                        min={0}
                        max={q.points}
                        defaultValue={current as number | undefined}
                        className={numCls}
                        placeholder={`0 - ${q.points}`}
                      />
                      <span className="text-xs text-slate-600 dark:text-slate-400">{help}</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-500">Tidak ada jawaban — tidak bisa dinilai.</span>
                  )}
                </div>
              </div>
            )
          })}

          <div className="pt-2">
            <button
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Simpan Nilai & Recalculate
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
