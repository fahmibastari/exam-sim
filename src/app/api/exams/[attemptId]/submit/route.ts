// src/app/api/exams/[attemptId]/submit/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(_: Request, { params }: { params: { attemptId: string } }) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: params.attemptId },
    include: {
      ExamPackage: true,
      answers: true,
    },
  })
  if (!attempt) return NextResponse.json({ error: 'Attempt tidak ditemukan' }, { status: 404 })

  // Ambil soal+opsi untuk paket attempt ini
  const questions = await prisma.question.findMany({
    where: { examPackageId: attempt.examPackageId },
    include: { options: true },
    orderBy: { order: 'asc' },
  })
  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId: attempt.id },
  })
  const ansByQ = new Map(answers.map(a => [a.questionId, a]))

  let totalPoints = 0
  let obtained = 0

// Cek yang wajib terjawab
const unansweredRequired: Array<{ order: number; id: string }> = []
for (const q of questions) {
  if (!q.required) continue
  const a = ansByQ.get(q.id)
  const isAnswered =
    (q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE') ? (a?.selectedOptionIds?.length === 1) :
    (q.type === 'MULTI_SELECT') ? ((a?.selectedOptionIds?.length ?? 0) > 0) :
    (q.type === 'SHORT_TEXT' || q.type === 'ESSAY') ? ((a?.valueText?.trim()?.length ?? 0) > 0) :
    (q.type === 'NUMBER' || q.type === 'RANGE') ? (typeof a?.valueNumber === 'number') :
    false

  if (!isAnswered) unansweredRequired.push({ order: q.order, id: q.id })
}

if (unansweredRequired.length > 0) {
  return NextResponse.json(
    { error: 'Masih ada soal wajib yang belum dijawab', missing: unansweredRequired },
    { status: 400 }
  )
}

function grade(q: typeof questions[number], a: (typeof answers)[number] | undefined): number {
  totalPoints += q.points
  switch (q.type) {
    case 'SINGLE_CHOICE':
    case 'TRUE_FALSE': {
      const correctIds = new Set(q.options.filter(o => o.isCorrect).map(o => o.id))
      const chosen = a?.selectedOptionIds?.[0]
      return chosen && correctIds.has(chosen) ? q.points : 0
    }
    case 'MULTI_SELECT': {
      const correct = new Set(q.options.filter(o => o.isCorrect).map(o => o.id))
      const chosen = new Set(a?.selectedOptionIds ?? [])
      if (correct.size === 0) return 0
      let correctChosen = 0
      let wrongChosen = 0
      for (const id of chosen) {
        if (correct.has(id)) correctChosen++
        else wrongChosen++
      }
      const frac = Math.max(0, (correctChosen - wrongChosen) / correct.size)
      return q.points * frac
    }
    case 'RANGE': {
      const { min, max } = (q.settings as any) || {}
      const v = a?.valueNumber
      if (typeof min !== 'number' || typeof max !== 'number' || typeof v !== 'number') return 0
      return v >= min && v <= max ? q.points : 0
    }
    case 'NUMBER': {
      const { target, tolerance } = (q.settings as any) || {}
      const v = a?.valueNumber
      if (typeof v !== 'number' || typeof target !== 'number') return 0
      const tol = typeof tolerance === 'number' ? tolerance : 0
      return Math.abs(v - target) <= tol ? q.points : 0
    }
    default:
      return 0 // SHORT_TEXT/ESSAY → 0 dulu (manual nanti)
  }
}

// Hitung & catat score per jawaban
const updates: Array<ReturnType<typeof prisma.attemptAnswer.update>> = []
for (const q of questions) {
  const ans = ansByQ.get(q.id)
  const s = grade(q, ans)
  obtained += s
  if (ans) {
    updates.push(
      prisma.attemptAnswer.update({
        where: { id: ans.id },
        data: { score: s, gradedAt: new Date() },
      })
    )
  }
}

// Commit score per answer + update attempt
await prisma.$transaction([
  ...updates,
  prisma.attempt.update({
    where: { id: attempt.id },
    data: { submittedAt: new Date(), score: obtained, total: totalPoints },
  })
])

return NextResponse.json({ ok: true, score: obtained, total: totalPoints })
}