import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
const prisma = new PrismaClient()

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await requireAdmin()
  const { id } = params
  const body = await req.json() as {
    order: number; text: string; imageUrl?: string;
    options: { label: string; text: string }[]; correctLabel: string
  }
  const q = await prisma.question.create({
    data: {
      examPackageId: id,
      order: body.order,
      text: body.text,
      imageUrl: body.imageUrl,
      options: { create: body.options },
      correctOptionId: '' // set nanti setelah opsi ada
    },
    include: { options: true }
  })
  const correct = q.options.find(o => o.label === body.correctLabel)
  if (!correct) return NextResponse.json({ error: 'correctLabel invalid' }, { status: 400 })
  await prisma.question.update({
    where: { id: q.id },
    data: { correctOptionId: correct.id }
  })
  return NextResponse.json({ ok: true })
}
export const runtime = 'nodejs'
