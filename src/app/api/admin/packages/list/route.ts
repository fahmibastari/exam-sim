import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'


export async function GET() {
const session = await getServerSession(authOptions)
if (!session || (session.user as any)?.role !== 'ADMIN') {
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
const pkgs = await prisma.examPackage.findMany({
orderBy: { createdAt: 'desc' },
select: { id: true, title: true, isActive: true, timeLimitMin: true, _count: { select: { questions: true, attempts: true } } }
})
return NextResponse.json(pkgs)
}
export const runtime = 'nodejs'