export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

function csvEscape(v: any) {
  const s = v == null ? '' : String(v)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params

  const session = (await getServerSession(authOptions)) as any
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return new Response('Unauthorized', { status: 401 })
  }

  const pkg = await prisma.examPackage.findUnique({
    where: { id },
    select: { id: true, title: true },
  })
  if (!pkg) return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 404 })

  const attempts = await prisma.attempt.findMany({
    where: { examPackageId: id },
    select: {
      id: true,
      participantName: true,
      participantEmail: true,
      participantInfo: true,
      startedAt: true,
      submittedAt: true,
      score: true,   // persen 0–100
      total: true,   // total poin
      User: { select: { name: true, email: true } },
    },
    orderBy: { startedAt: 'desc' },
  })

  const header = [
    'AttemptID','Name','Email','Info','StartedAt','SubmittedAt','DurationSec','CorrectOfTotal','ScorePercent','Source',
  ].join(',')

  const rows = attempts.map(a => {
    const name = a.participantName ?? a.User?.name ?? ''
    const email = a.participantEmail ?? a.User?.email ?? ''
    const info = a.participantInfo ?? ''
    const started = a.startedAt?.toISOString() ?? ''
    const submitted = a.submittedAt?.toISOString() ?? ''
    const durationSec = a.submittedAt ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime())/1000) : ''
    // kalau ingin angka "benar/total" sebenarnya, simpan saat submit; di sini tetap '-'
    const correctOfTotal = a.total ? '-' : '-'
    const scorePercent = a.score ?? ''
    const source = a.User ? 'Login' : 'Guest'

    return [
      a.id, name, email, info, started, submitted, durationSec, correctOfTotal, scorePercent, source,
    ].map(csvEscape).join(',')
  })

  const csv = [header, ...rows].join('\n')
  const fnameBase = (pkg.title || 'results').replace(/[^\w.-]+/g, '_').slice(0, 60)
  const headers = new Headers({
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${fnameBase}.csv"`,
  })
  return new NextResponse(csv, { headers })
}
