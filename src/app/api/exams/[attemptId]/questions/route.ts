import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
const prisma = new PrismaClient()

export async function GET(req: NextRequest, ctx: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await ctx.params  // ⬅️ await dulu
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { ExamPackage: true },
  })
  if (!attempt) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // kalau attempt milik user login → wajib cocok
  if (attempt.userId) {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).id !== attempt.userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
    }
  }

  const questions = await prisma.question.findMany({
    where: { examPackageId: attempt.examPackageId },
    include: { options: true },
    orderBy: { order: 'asc' }
  })
  return NextResponse.json({ questions, timeLimitMin: attempt.ExamPackage.timeLimitMin ?? null })
}
export const runtime = 'nodejs'
