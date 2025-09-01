import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

const BodySchema = z.object({
  examPackageId: z.string().min(1),
  token: z.string().trim().min(1),
  participant: z.object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    info: z.string().trim().optional(),
  }).optional()
})

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())

    const pkg = await prisma.examPackage.findUnique({
      where: { id: body.examPackageId },
      select: { id: true, isActive: true, tokenHash: true }
    })
    if (!pkg || !pkg.isActive) {
      return NextResponse.json({ error: 'paket tidak tersedia' }, { status: 400 })
    }

    const ok = await bcrypt.compare(body.token, pkg.tokenHash)
    if (!ok) return NextResponse.json({ error: 'token salah' }, { status: 403 })

    // kalau ada user login (admin), pakai attempt unik per user
    const session = await getServerSession(authOptions).catch(() => null)
    if (session?.user && (session.user as any).id) {
      const attempt = await prisma.attempt.upsert({
        where: {
          userId_examPackageId: {
            userId: (session.user as any).id,
            examPackageId: pkg.id
          }
        },
        update: {},
        create: {
          userId: (session.user as any).id,
          examPackageId: pkg.id
        }
      })
      return NextResponse.json({ attemptId: attempt.id })
    }

    // peserta tanpa login
    const attempt = await prisma.attempt.create({
      data: {
        examPackageId: pkg.id,
        participantName: body.participant?.name ?? null,
        participantEmail: body.participant?.email ?? null,
        participantInfo: body.participant?.info ?? null
      }
    })
    return NextResponse.json({ attemptId: attempt.id })
  } catch (e) {
    console.error('JOIN_ERROR', e)
    // Pastikan tetap JSON supaya client tidak gagal parse
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
export const runtime = 'nodejs'
