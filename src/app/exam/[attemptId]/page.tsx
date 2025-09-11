export const runtime = 'nodejs'

import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import AttemptClient from './AttemptClient'

export default async function ExamAttemptPage({
  params,
}: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, submittedAt: true },
  })
  if (!attempt) notFound()
  if (attempt.submittedAt) redirect(`/exam/result/${attemptId}`)

  return <AttemptClient attemptId={attemptId} />
}
