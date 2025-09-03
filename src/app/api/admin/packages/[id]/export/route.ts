import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pkg = await prisma.examPackage.findUnique({
    where: { id: params.id },
    select: { id: true, title: true }
  })
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const attempts = await prisma.attempt.findMany({
    where: { examPackageId: pkg.id },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      participantName: true, participantEmail: true, participantInfo: true,
      startedAt: true, submittedAt: true,
      score: true, total: true,
      User: { select: { name: true, email: true } }
    }
  })

  const header = [
    'attempt_id','name','email','info','started_at','submitted_at','duration_sec','score','total','percent','source'
  ]
  const rows = [header.join(',')]
  for (const a of attempts) {
    const name = a.participantName ?? a.User?.name ?? ''
    const email = a.participantEmail ?? a.User?.email ?? ''
    const info = a.participantInfo ?? ''
    const started = a.startedAt.toISOString()
    const submitted = a.submittedAt ? a.submittedAt.toISOString() : ''
    const duration = a.submittedAt ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime())/1000) : ''
    const score = typeof a.score === 'number' ? a.score.toFixed(2) : ''
    const total = typeof a.total === 'number' ? a.total.toFixed(2) : ''
    const percent = (typeof a.score==='number' && typeof a.total==='number' && a.total>0)
      ? ((a.score/a.total)*100).toFixed(2) : ''
    const source = a.User ? 'Login' : 'Guest'

    // CSV escape
    const esc = (s: string) => `"${String(s).replace(/"/g,'""')}"`
    rows.push([
      esc(a.id), esc(name), esc(email), esc(info),
      esc(started), esc(submitted), duration,
      score, total, percent, source
    ].join(','))
  }

  const body = rows.join('\r\n')
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="results_${pkg.title.replace(/[^\w]+/g,'_')}.csv"`,
      'Cache-Control': 'no-store',
    }
  })
}
