export const dynamic = 'force-dynamic'    // ⬅️ jangan di-cache
export const revalidate = 0               // ⬅️ hard no-cache

// src/app/api/exams/[attemptId]/questions/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ... existing imports
export async function GET(_req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await ctx.params

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
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

  function mulberry32(a: number) {
    return function() {
      let t = (a += 0x6D2B79F5)
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  function hashStr(s: string) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
    }
    return h >>> 0
  }
  function shuffle<T>(arr: T[], rnd: () => number) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const seed = hashStr(attempt.id)
const rnd = mulberry32(seed)

const qShuffled = questions.map(q => ({
  ...q,
  options: shuffle(q.options, rnd) // hanya mengacak opsi
}))


return NextResponse.json({
  questions: qShuffled.map(q => ({
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
  endsAt,
})
}
