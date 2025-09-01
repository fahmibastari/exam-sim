import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
const prisma = new PrismaClient()

export async function POST(req: NextRequest, ctx: { params: Promise<{ attemptId: string }> }) {
  const { questionId, optionId } = (await req.json()) as { questionId: string; optionId: string }
  const { attemptId } = await ctx.params  // ⬅️ await
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } })
  if (!attempt) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (attempt.userId) {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).id !== attempt.userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
    }
  }

  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
    update: { optionId },
    create: { attemptId: attempt.id, questionId, optionId }
  })

  return NextResponse.json({ ok: true })
}
export const runtime = 'nodejs'
