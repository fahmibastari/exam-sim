import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/auth'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  await requireAdmin()
  const body = await req.json() as {
    title: string; description?: string; token: string; timeLimitMin?: number
  }
  const tokenHash = await bcrypt.hash(body.token, 10)
  const pkg = await prisma.examPackage.create({
    data: {
      title: body.title,
      description: body.description,
      tokenHash,
      timeLimitMin: body.timeLimitMin
    }
  })
  return NextResponse.json(pkg)
}
export const runtime = 'nodejs'
