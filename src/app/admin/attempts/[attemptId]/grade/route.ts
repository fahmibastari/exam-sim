export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params

  const session = (await getServerSession(authOptions)) as any
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as {
    updates?: Array<{ answerId: string; score: number }>
  } | null
  if (!body?.updates || !Array.isArray(body.updates)) {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 })
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true },
  })
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

  await prisma.$transaction(
    body.updates.map((u) =>
      prisma.attemptAnswer.update({
        where: { id: u.answerId },
        data: {
          score: Number.isFinite(u.score) ? Number(u.score) : 0,
          gradedAt: new Date(),
        },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
