// src/app/api/admin/packages/[id]/questions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await requireAdmin()
  const { id: examPackageId } = params
  const body = await req.json() as {
    order: number
    text: string
    imageUrl?: string
    type: 'SINGLE_CHOICE'|'MULTI_SELECT'|'TRUE_FALSE'|'SHORT_TEXT'|'ESSAY'|'NUMBER'|'RANGE'
    points?: number
    required?: boolean
    settings?: any
    contextText?: string | null
    passageId?: string | null
    options?: { label: 'A'|'B'|'C'|'D'|'E'; text: string; isCorrect?: boolean }[]
  }

  const q = await prisma.question.create({
    data: {
      examPackageId,
      order: body.order,
      text: body.text,
      imageUrl: body.imageUrl,
      type: body.type,
      points: body.points ?? 1,
      required: body.required ?? false,
      settings: body.settings ?? undefined,
      contextText: body.contextText ?? undefined,
      passageId: body.passageId ?? undefined,
      ...(Array.isArray(body.options) && body.options.length
        ? { options: { create: body.options.map(o => ({ label: o.label, text: o.text, isCorrect: !!o.isCorrect })) } }
        : {}),
    },
  })

  return NextResponse.json({ ok: true, id: q.id })
}
