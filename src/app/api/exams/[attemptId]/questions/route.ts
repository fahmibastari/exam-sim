// src/app/api/exams/[attemptId]/questions/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ attemptId: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const { attemptId } = await ctx.params

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { ExamPackage: true },
  })
  if (!attempt) {
    return NextResponse.json({ error: 'Attempt tidak ditemukan' }, { status: 404 })
  }

  const questions = await prisma.question.findMany({
    where: { examPackageId: attempt.examPackageId },
    orderBy: { order: 'asc' },
    include: {
      options: { orderBy: { label: 'asc' } },
      passage: { select: { id: true, title: true, content: true, audioUrl: true } }, // ⬅️ passage ikut
    },
  })

  // endsAt dari startedAt + timeLimitMin
  let endsAt: string | null = null
  const limit = attempt.ExamPackage.timeLimitMin
  if (typeof limit === 'number' && Number.isFinite(limit)) {
    const end = new Date(attempt.startedAt.getTime() + limit * 60_000)
    endsAt = end.toISOString()
  }

  // Deterministic RNG + shuffle opsi saja
  function mulberry32(a: number) {
    return function rnd(): number {
      let t = (a += 0x6D2B79F5) >>> 0
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  function hashStr(s: string): number {
    let h = 2166136261 >>> 0
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }
  function shuffle<T>(arr: T[], rnd: () => number): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp
    }
    return a
  }

  const rnd = mulberry32(hashStr(attempt.id))
  const qShuffled = questions.map(q => ({
    ...q,
    // @ts-ignore
    options: shuffle(q.options, rnd),
  }))

  // Prefill jawaban yang sudah pernah tersimpan
  const existing = await prisma.attemptAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, selectedOptionIds: true, valueText: true, valueNumber: true },
  })
  const answers: Record<string, { selectedOptionIds?: string[]; valueText?: string; valueNumber?: number | null }> = {}
  for (const a of existing) {
    answers[a.questionId] = {
      ...(answers[a.questionId] ?? {}),
      ...(a.selectedOptionIds?.length ? { selectedOptionIds: a.selectedOptionIds } : {}),
      ...(a.valueText != null ? { valueText: a.valueText } : {}),
      ...(a.valueNumber != null ? { valueNumber: a.valueNumber } : {}),
    }
  }

  return NextResponse.json({
    questions: qShuffled.map(q => ({
      id: q.id,
      order: q.order,
      text: q.text,
      imageUrl: q.imageUrl,
      // @ts-ignore
      audioUrl: q.audioUrl, // NEW
      type: q.type,
      points: q.points,
      required: q.required,
      settings: q.settings,
      contextText: q.contextText ?? null,
      // @ts-ignore
      passage: q.passage ? { id: q.passage.id, title: q.passage.title, content: q.passage.content, audioUrl: q.passage.audioUrl } : null,
      // @ts-ignore
      options: q.options.map((o: { id: string; label: string; text: string }) => ({
        id: o.id, label: o.label, text: o.text
      })),
    })),
    timeLimitMin: attempt.ExamPackage.timeLimitMin ?? null,
    endsAt,
    answers,
  })
}
