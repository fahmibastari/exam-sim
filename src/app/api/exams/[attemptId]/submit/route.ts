import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
const prisma = new PrismaClient()


export async function POST(req: NextRequest, ctx: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await ctx.params  // ⬅️ await
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { answers: true, ExamPackage: true },
  })
  if (!attempt) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (attempt.userId) {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).id !== attempt.userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
    }
  }

  if (attempt.submittedAt) {
    return NextResponse.json({ error: 'sudah disubmit' }, { status: 400 })
  }

  const questions = await prisma.question.findMany({
    where: { examPackageId: attempt.examPackageId },
    select: { id: true, correctOptionId: true }
  })

  const correctSet = new Map(questions.map(q => [q.id, q.correctOptionId]))
  let correct = 0
  for (const ans of attempt.answers) {
    const key = correctSet.get(ans.questionId)
    if (key && key === ans.optionId) correct++
  }

  const total = questions.length
  const score = Math.round((correct / total) * 100)

  await prisma.attempt.update({
    where: { id: attempt.id },
    data: { submittedAt: new Date(), score, total }
  })

  return NextResponse.json({ score, correct, total })
}
export const runtime = 'nodejs'
