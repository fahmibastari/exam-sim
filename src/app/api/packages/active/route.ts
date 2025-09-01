import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export async function GET() {
const pkgs = await prisma.examPackage.findMany({
where: { isActive: true },
select: { id: true, title: true, description: true, timeLimitMin: true }
})
return NextResponse.json(pkgs)
}
export const runtime = 'nodejs'