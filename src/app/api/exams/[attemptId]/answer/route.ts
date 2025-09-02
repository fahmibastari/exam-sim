// src/app/api/exams/[attemptId]/answer/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Body = {
  questionId: string
  selectedOptionIds?: string[] // single/multi/true-false (single isi 1)
  valueText?: string           // short/essay
  valueNumber?: number | null  // number/range
}

export async function POST(req: Request, { params }: { params: { attemptId: string } }) {
  const attemptId = params.attemptId
  const body = (await req.json()) as Body

  // Validasi minimal
  if (!body?.questionId) {
    return NextResponse.json({ error: 'questionId wajib diisi' }, { status: 400 })
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { ExamPackage: true },
  })
  if (!attempt) return NextResponse.json({ error: 'Attempt tidak ditemukan' }, { status: 404 })

  const q = await prisma.question.findUnique({
    where: { id: body.questionId },
    include: { options: true },
  })
  if (!q || q.examPackageId !== attempt.examPackageId) {
    return NextResponse.json({ error: 'Soal tidak valid untuk attempt ini' }, { status: 400 })
  }
  const limit = attempt.ExamPackage.timeLimitMin
if (typeof limit === 'number' && Number.isFinite(limit)) {
  const expiresAt = new Date(attempt.startedAt.getTime() + limit * 60_000)
  if (new Date() > expiresAt) {
    return NextResponse.json({ error: 'Waktu ujian sudah habis' }, { status: 403 })
  }
}

  // Normalisasi isi jawaban sesuai tipe
  let selectedOptionIds: string[] | undefined = undefined
  let valueText: string | undefined = undefined
  let valueNumber: number | null | undefined = undefined

  switch (q.type) {
    case 'SINGLE_CHOICE':
    case 'TRUE_FALSE': {
      // ambil 1 id
      const arr = Array.isArray(body.selectedOptionIds) ? body.selectedOptionIds : []
      if (arr.length !== 1) {
        return NextResponse.json({ error: 'Harus memilih satu jawaban' }, { status: 400 })
      }
      // validasi id opsi milik soal
      const validIds = new Set(q.options.map(o => o.id))
      if (!validIds.has(arr[0])) {
        return NextResponse.json({ error: 'Opsi tidak valid' }, { status: 400 })
      }
      selectedOptionIds = arr
      break
    }
    case 'MULTI_SELECT': {
      const arr = Array.isArray(body.selectedOptionIds) ? body.selectedOptionIds : []
      const validIds = new Set(q.options.map(o => o.id))
      if (arr.some(id => !validIds.has(id))) {
        return NextResponse.json({ error: 'Opsi tidak valid' }, { status: 400 })
      }
      selectedOptionIds = arr
      break
    }
    case 'SHORT_TEXT':
    case 'ESSAY': {
      valueText = (body.valueText ?? '').toString()
      // (opsional) batasi panjang sesuai settings.maxLength
      const ml = (q.settings as any)?.maxLength
      if (ml && typeof ml === 'number' && valueText.length > ml) {
        valueText = valueText.slice(0, ml)
      }
      break
    }
    case 'NUMBER':
    case 'RANGE': {
      const n = body.valueNumber
      if (typeof n !== 'number' || !Number.isFinite(n)) {
        return NextResponse.json({ error: 'Nilai angka tidak valid' }, { status: 400 })
      }
      valueNumber = n
      break
    }
    default:
      return NextResponse.json({ error: 'Tipe soal tidak didukung' }, { status: 400 })
  }

  // Upsert jawaban per (attemptId, questionId)
  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId: q.id } },
    update: {
      selectedOptionIds: selectedOptionIds ?? [],   // <— DEFAULT []
      valueText,
      valueNumber,
    },
    create: {
      attemptId,
      questionId: q.id,
      selectedOptionIds: selectedOptionIds ?? [],   // <— DEFAULT []
      valueText,
      valueNumber,
    },
  })

  return NextResponse.json({ ok: true })
}
