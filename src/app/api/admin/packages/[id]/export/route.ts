import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  const pkg = await prisma.examPackage.findUnique({
    where: { id },
    select: { title: true },
  })
  if (!pkg) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const attempts = await prisma.attempt.findMany({
    where: { examPackageId: id },
    select: {
      id: true,
      participantName: true,
      participantEmail: true,
      participantInfo: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      total: true,
      User: { select: { name: true, email: true } },
    },
    orderBy: { startedAt: 'desc' },
  })

  const esc = (v: any) => {
    if (v == null) return ''
    const s = String(v).replace(/"/g, '""')
    return `"${s}"`
  }

  const rows = [
    ['No', 'AttemptID', 'Nama', 'Email', 'Info', 'Mulai', 'Submit', 'Durasi (s)', 'Benar', 'Total', 'Nilai', 'Sumber'],
    ...attempts.map((a, i) => {
      const name = a.participantName ?? a.User?.name ?? ''
      const email = a.participantEmail ?? a.User?.email ?? ''
      const dur = a.submittedAt ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000) : ''
      const correct = a.score != null && a.total ? Math.round((a.score * a.total) / 100) : ''
      return [
        i + 1,
        a.id,
        name,
        email,
        a.participantInfo ?? '',
        a.startedAt.toISOString(),
        a.submittedAt ? a.submittedAt.toISOString() : '',
        dur,
        correct,
        a.total ?? '',
        a.score ?? '',
        a.User ? 'Login' : 'Guest',
      ]
    }),
  ]

  const csv = rows.map(r => r.map(esc).join(',')).join('\r\n')
  const filename = `results-${pkg.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
