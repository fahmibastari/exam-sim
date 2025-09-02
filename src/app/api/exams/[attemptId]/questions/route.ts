// src/app/api/exams/[attemptId]/questions/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ... existing imports
export async function GET(_: Request, { params }: { params: { attemptId: string } }) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: params.attemptId },
    include: { ExamPackage: true },
  })
  if (!attempt) return NextResponse.json({ error: 'Attempt tidak ditemukan' }, { status: 404 })

  const questions = await prisma.question.findMany({
    where: { examPackageId: attempt.examPackageId },
    orderBy: { order: 'asc' },
    include: { options: { orderBy: { label: 'asc' } } },
  })

  // NEW: hitung endsAt (ISO) dari startedAt + timeLimitMin
  let endsAt: string | null = null
  const limit = attempt.ExamPackage.timeLimitMin
  if (typeof limit === 'number' && Number.isFinite(limit)) {
    const end = new Date(attempt.startedAt.getTime() + limit * 60_000)
    endsAt = end.toISOString()
  }

  return NextResponse.json({
    questions: questions.map(q => ({
      id: q.id,
      order: q.order,
      text: q.text,
      imageUrl: q.imageUrl,
      type: q.type,
      points: q.points,
      required: q.required,
      settings: q.settings,
      options: q.options.map(o => ({ id: o.id, label: o.label, text: o.text })),
    })),
    timeLimitMin: attempt.ExamPackage.timeLimitMin ?? null,
    endsAt, // NEW
  })
}
