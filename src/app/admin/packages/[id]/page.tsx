// src/app/admin/packages/[id]/page.tsx
export const runtime = 'nodejs'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// ===== Zod helpers =====
const BoolFromCheckbox = z.preprocess(
  (v) => (v === 'on' || v === 'true' ? true : false),
  z.boolean()
)

// ====== preprocess agar null -> '' untuk field opsional ======
const toEmpty = (v: unknown) => (v === null || v === undefined ? '' : v)

const OptionalNonEmpty = z.preprocess(
  toEmpty,
  z.union([z.literal(''), z.string().min(1)])
)

const IdOrEmpty = z.preprocess(
  toEmpty,
  z.union([z.literal(''), z.string().min(1)]) // cuid, jadi cukup non-empty string
)

const EnumOrEmpty = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(toEmpty, z.union([z.literal(''), z.enum(values as any)]))

const NumOrEmpty = z.preprocess(toEmpty, z.union([z.literal(''), z.coerce.number()]))
const NumMin0OrEmpty = z.preprocess(toEmpty, z.union([z.literal(''), z.coerce.number().min(0)]))
const IntPosOrEmpty = z.preprocess(toEmpty, z.union([z.literal(''), z.coerce.number().int().positive()]))

const QuestionTypeEnum = z.enum([
  'SINGLE_CHOICE','MULTI_SELECT','TRUE_FALSE','SHORT_TEXT','ESSAY','NUMBER','RANGE',
])

const BaseQSchema = z.object({
  order: z.coerce.number().int().positive(),
  text: z.string().min(3),
  image: z.any().optional(),
  type: QuestionTypeEnum,
  points: z.coerce.number().int().min(0).default(1),
  required: BoolFromCheckbox.default(false),
  contextText: OptionalNonEmpty.optional(), // ✅ sekarang aman
})

// Tambahan field opsional per tipe
const OptionsSchema = z.object({
  A: OptionalNonEmpty.optional(),
  B: OptionalNonEmpty.optional(),
  C: OptionalNonEmpty.optional(),
  D: OptionalNonEmpty.optional(),
  E: OptionalNonEmpty.optional(),
  correctLabel: EnumOrEmpty(['A', 'B', 'C', 'D', 'E'] as const).optional(),
})

const TrueFalseSchema = z.object({
  tfTrueText: OptionalNonEmpty.optional(),
  tfFalseText: OptionalNonEmpty.optional(),
  correctTF: EnumOrEmpty(['TRUE', 'FALSE'] as const).optional(),
})

const NumberSchema = z.object({
  tolerance: NumMin0OrEmpty.optional(),
  targetNumber: NumOrEmpty.optional(),
})

const RangeSchema = z.object({
  min: NumOrEmpty.optional(),
  max: NumOrEmpty.optional(),
  step: z.preprocess(
    toEmpty,
    z.union([z.literal(''), z.coerce.number().positive()])
  ).optional(),
})

const ShortTextSchema = z.object({
  caseSensitive: BoolFromCheckbox.default(false).optional(),
  maxLength: IntPosOrEmpty.optional(),
})

const CreateSchema = BaseQSchema
  .merge(OptionsSchema)
  .merge(TrueFalseSchema)
  .merge(NumberSchema)
  .merge(RangeSchema)
  .merge(ShortTextSchema)
  .extend({
    passageId: IdOrEmpty.optional(),
  })

// EditSchema juga sekalian rapihin:
const EditSchema = CreateSchema.extend({ id: z.string().min(1) })

// tipe opsi, biar rapi
// ganti yang lama:
type OptionRow = { id: string; label: string; text: string; isCorrect: boolean }

// Infer TransactionClient TANPA mengimpor Prisma.* (aman di index-browser)
type Tx =
  Extract<Parameters<typeof prisma.$transaction>[0], (arg: any) => any> extends
    (arg: infer A) => any ? A : never

// ===== Page component =====
export default async function EditPackagePage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') redirect('/login')

  const pkg = await prisma.examPackage.findUnique({ where: { id } })
  if (!pkg) redirect('/admin/packages')

  async function uploadImage(pkgId: string, file: File | null | undefined) {
    'use server'
    if (!file || (file as any).size === 0) return undefined

    const maxBytes = 2 * 1024 * 1024 // 2MB
    const okTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
    const mime = (file as any).type || ''

    if (!okTypes.has(mime)) throw new Error('Tipe gambar harus PNG/JPEG/WEBP')
    if ((file as any).size > maxBytes) throw new Error('Ukuran gambar maks 2MB')

    const safeName = String((file as any).name || 'img').replace(/[^\w.\-]+/g, '_')
    const fileName = `${pkgId}/${Date.now()}_${safeName}`

    const { data, error } = await supabaseAdmin
      .storage.from('exam-images')
      .upload(fileName, file as any, { upsert: false, contentType: mime })
    if (error) throw new Error('Upload gambar gagal: ' + error.message)

    const { data: pub } = supabaseAdmin.storage.from('exam-images').getPublicUrl(data.path)
    return pub.publicUrl
  }

  // ===== CREATE =====
  async function addQuestion(formData: FormData) {
    'use server'
    const correctMulti = formData.getAll('correctMulti').map(String) as Array<'A'|'B'|'C'|'D'|'E'>

    const raw = {
      order: formData.get('order'),
      text: formData.get('text'),
      image: formData.get('image') as unknown as File | null,
      type: formData.get('type'),
      points: formData.get('points'),
      required: formData.get('required'),
      contextText: formData.get('contextText'),
      passageId: formData.get('passageId'),

      // opsi
      A: formData.get('A'),
      B: formData.get('B'),
      C: formData.get('C'),
      D: formData.get('D'),
      E: formData.get('E'),
      correctLabel: formData.get('correctLabel'),

      // true/false
      tfTrueText: formData.get('tfTrueText') || 'Benar',
      tfFalseText: formData.get('tfFalseText') || 'Salah',
      correctTF: formData.get('correctTF'),

      // number
      tolerance: formData.get('tolerance'),
      targetNumber: formData.get('targetNumber'),

      // range
      min: formData.get('min'),
      max: formData.get('max'),
      step: formData.get('step'),

      // short/essay
      caseSensitive: formData.get('caseSensitive'),
      maxLength: formData.get('maxLength'),
    }

    const parsed = CreateSchema.safeParse(raw)
    if (!parsed.success) throw new Error('Data soal tidak valid')

    const p = parsed.data
    const imageUrl = await uploadImage(id, parsed.data.image as File | null)

    const last = await prisma.question.findFirst({
      where: { examPackageId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    
    let safeOrder = Number(p.order)
    if (!Number.isFinite(safeOrder) || safeOrder <= 0) {
      safeOrder = (last?.order ?? 0) + 1
    } else {
      const exists = await prisma.question.findFirst({
        where: { examPackageId: id, order: safeOrder },
        select: { id: true },
      })
      if (exists) {
        // kalau bentrok, dorong ke paling akhir
        safeOrder = (last?.order ?? 0) + 1
      }
    }

    type Opt = { label: string; text: string; isCorrect?: boolean }

    const type = p.type
    let options: Opt[] = []
    let settings: Record<string, any> | undefined = undefined

    if (type === 'SINGLE_CHOICE') {
      const labels4: Array<'A'|'B'|'C'|'D'> = ['A','B','C','D']
      for (const L of labels4) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') {
          throw new Error(`Opsi ${L} wajib diisi untuk tipe Single Choice`)
        }
      }
      if (!p.correctLabel) throw new Error('Pilih jawaban benar (Single Choice)')
    
      // validasi jika correctLabel = 'E', pastikan E terisi
      if (p.correctLabel === 'E') {
        if (!p.E || String(p.E).trim() === '') {
          throw new Error('Opsi E dipilih sebagai jawaban benar, tetapi kosong')
        }
      }
    
      options = [
        { label: 'A', text: String(p.A), isCorrect: p.correctLabel === 'A' },
        { label: 'B', text: String(p.B), isCorrect: p.correctLabel === 'B' },
        { label: 'C', text: String(p.C), isCorrect: p.correctLabel === 'C' },
        { label: 'D', text: String(p.D), isCorrect: p.correctLabel === 'D' },
      ]
      // Opsi E opsional: hanya dibuat jika diisi
      if (p.E && String(p.E).trim() !== '') {
        options.push({ label: 'E', text: String(p.E), isCorrect: p.correctLabel === 'E' })
      }
    }
    

    if (type === 'MULTI_SELECT') {
      const labels4: Array<'A'|'B'|'C'|'D'> = ['A','B','C','D']
      for (const L of labels4) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') {
          throw new Error(`Opsi ${L} wajib diisi untuk tipe Multi Select`)
        }
      }
      if (correctMulti.length === 0) throw new Error('Pilih minimal satu jawaban benar (Multi Select)')
    
      // jika E dicentang sebagai benar, pastikan E terisi
      if (correctMulti.includes('E') && (!p.E || String(p.E).trim() === '')) {
        throw new Error('Opsi E ditandai benar, tetapi kosong')
      }
    
      options = [
        { label: 'A', text: String(p.A), isCorrect: correctMulti.includes('A') },
        { label: 'B', text: String(p.B), isCorrect: correctMulti.includes('B') },
        { label: 'C', text: String(p.C), isCorrect: correctMulti.includes('C') },
        { label: 'D', text: String(p.D), isCorrect: correctMulti.includes('D') },
      ]
      if (p.E && String(p.E).trim() !== '') {
        options.push({ label: 'E', text: String(p.E), isCorrect: correctMulti.includes('E') })
      }
    }
    

    if (type === 'TRUE_FALSE') {
      const tTrue = (p.tfTrueText ?? 'Benar').toString()
      const tFalse = (p.tfFalseText ?? 'Salah').toString()
      if (!p.correctTF) throw new Error('Pilih jawaban benar (True/False)')
      options = [
        { label: 'A', text: tTrue,  isCorrect: p.correctTF === 'TRUE'  },
        { label: 'B', text: tFalse, isCorrect: p.correctTF === 'FALSE' },
      ]
    }

    if (type === 'NUMBER') {
      const tolerance = p.tolerance === '' || p.tolerance === undefined ? undefined : Number(p.tolerance)
      const target = p.targetNumber === '' || p.targetNumber === undefined ? undefined : Number(p.targetNumber)
      settings = { tolerance, target }
    }

    if (type === 'RANGE') {
      const min = p.min === '' || p.min === undefined ? undefined : Number(p.min)
      const max = p.max === '' || p.max === undefined ? undefined : Number(p.max)
      const step = p.step === '' || p.step === undefined ? undefined : Number(p.step)
      if (min == null || max == null) throw new Error('Range: min dan max wajib diisi')
      if (Number(min) >= Number(max)) throw new Error('Range: min harus < max')
      settings = { min: Number(min), max: Number(max), step: step ?? null }
    }

    if (type === 'SHORT_TEXT') {
      const caseSensitive = !!p.caseSensitive
      const maxLength = p.maxLength === '' || p.maxLength === undefined ? undefined : Number(p.maxLength)
      settings = { caseSensitive, maxLength }
    }

    if (type === 'ESSAY') {
      const caseSensitive = !!p.caseSensitive
      const maxLength = p.maxLength === '' || p.maxLength === undefined ? undefined : Number(p.maxLength)
      settings = { caseSensitive, maxLength }
    }

    await prisma.question.create({
      data: {
        examPackageId: id,
        order: safeOrder,
        text: p.text,
        imageUrl,
        type,
        contextText: p.contextText ? String(p.contextText) : undefined,
        passageId: p.passageId ? String(p.passageId) : undefined,
        points: p.points ?? 1,
        required: p.required ?? false,
        settings: settings ?? undefined,
        ...(options.length
          ? { options: { create: options.map(o => ({ label: o.label, text: o.text, isCorrect: !!o.isCorrect })) } }
          : {}),
      },
    })

    revalidatePath(`/admin/packages/${id}`)
  }

  // ===== UPDATE =====
  async function updateQuestion(formData: FormData) {
    'use server'
    const correctMulti = formData.getAll('correctMulti').map(String) as Array<'A'|'B'|'C'|'D'|'E'>

    const raw = {
      id: formData.get('id'),
      order: formData.get('order'),
      text: formData.get('text'),
      image: formData.get('image') as unknown as File | null,
      type: formData.get('type'),
      points: formData.get('points'),
      required: formData.get('required'),
      contextText: formData.get('contextText'),
      passageId: formData.get('passageId'),


      A: formData.get('A'),
      B: formData.get('B'),
      C: formData.get('C'),
      D: formData.get('D'),
      E: formData.get('E'),
      correctLabel: formData.get('correctLabel'),

      tfTrueText: formData.get('tfTrueText'),
      tfFalseText: formData.get('tfFalseText'),
      correctTF: formData.get('correctTF'),

      tolerance: formData.get('tolerance'),
      targetNumber: formData.get('targetNumber'),

      min: formData.get('min'),
      max: formData.get('max'),
      step: formData.get('step'),

      caseSensitive: formData.get('caseSensitive'),
      maxLength: formData.get('maxLength'),
    }
    const parsed = EditSchema.safeParse(raw)
    if (!parsed.success) {
      console.error(parsed.error.flatten())
      throw new Error('Data edit tidak valid')
    }
    const p = parsed.data

    const q = await prisma.question.findUnique({
      where: { id: String(p.id) },
      include: { options: true }
    })
    if (!q) throw new Error('Soal tidak ditemukan')

      let safeOrder = Number(p.order)
      if (!Number.isFinite(safeOrder) || safeOrder <= 0) {
        safeOrder = q.order // kalau invalid, pertahankan yg lama
      } else if (safeOrder !== q.order) {
        const conflict = await prisma.question.findFirst({
          where: { examPackageId: id, order: safeOrder, NOT: { id: q.id } },
          select: { id: true },
        })
        if (conflict) {
          const last = await prisma.question.findFirst({
            where: { examPackageId: id },
            orderBy: { order: 'desc' },
            select: { order: true },
          })
          safeOrder = (last?.order ?? 0) + 1
        }
      }

    let imageUrl = q.imageUrl ?? undefined
    if (p.image && (p.image as any).size > 0) {
      imageUrl = await uploadImage(id, p.image as File)
    }

    let optionsPayload: Array<{ id?: string; label: string; text: string; isCorrect?: boolean }> = []
    let settings: Record<string, any> | undefined = undefined
    const type = p.type

    const updateBase = {
      order: safeOrder,
      text: p.text,
      imageUrl,
      type,
      points: p.points ?? 1,
      required: p.required ?? false,
      contextText: p.contextText ? String(p.contextText) : null,
      passageId: p.passageId ? String(p.passageId) : null, // kosongkan = lepas dari passage
    }

    if (type === 'SINGLE_CHOICE') {
      const labels4: Array<'A'|'B'|'C'|'D'> = ['A','B','C','D']
      for (const L of labels4) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') throw new Error(`Opsi ${L} wajib diisi`)
      }
      if (!p.correctLabel) throw new Error('Pilih jawaban benar')
    
      // map id existing by label termasuk E
      const byLabel: Record<'A'|'B'|'C'|'D'|'E', string|undefined> = { A: undefined, B: undefined, C: undefined, D: undefined, E: undefined }
      q.options.forEach((o: OptionRow) => {
        if (['A','B','C','D','E'].includes(o.label)) (byLabel as any)[o.label] = o.id
      })
    
      // validasi correctLabel === 'E' ⇒ E wajib terisi
      if (p.correctLabel === 'E' && (!p.E || String(p.E).trim() === '')) {
        throw new Error('Opsi E dipilih sebagai jawaban benar, tetapi kosong')
      }
    
      optionsPayload = [
        { id: byLabel.A, label: 'A', text: String(p.A), isCorrect: p.correctLabel === 'A' },
        { id: byLabel.B, label: 'B', text: String(p.B), isCorrect: p.correctLabel === 'B' },
        { id: byLabel.C, label: 'C', text: String(p.C), isCorrect: p.correctLabel === 'C' },
        { id: byLabel.D, label: 'D', text: String(p.D), isCorrect: p.correctLabel === 'D' },
      ]
      if (p.E && String(p.E).trim() !== '') {
        optionsPayload.push({ id: byLabel.E, label: 'E', text: String(p.E), isCorrect: p.correctLabel === 'E' })
      }
    }
    
    

    if (type === 'MULTI_SELECT') {
      const labels4: Array<'A'|'B'|'C'|'D'> = ['A','B','C','D']
      for (const L of labels4) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') throw new Error(`Opsi ${L} wajib diisi`)
      }
    
      const byLabel: Record<'A'|'B'|'C'|'D'|'E', string|undefined> = { A: undefined, B: undefined, C: undefined, D: undefined, E: undefined }
      q.options.forEach((o: OptionRow) => {
        if (['A','B','C','D','E'].includes(o.label)) (byLabel as any)[o.label] = o.id
      })
    
      if (correctMulti.length === 0) throw new Error('Pilih minimal satu jawaban benar')
      if (correctMulti.includes('E') && (!p.E || String(p.E).trim() === '')) {
        throw new Error('Opsi E ditandai benar, tetapi kosong')
      }
    
      optionsPayload = [
        { id: byLabel.A, label: 'A', text: String(p.A), isCorrect: correctMulti.includes('A') },
        { id: byLabel.B, label: 'B', text: String(p.B), isCorrect: correctMulti.includes('B') },
        { id: byLabel.C, label: 'C', text: String(p.C), isCorrect: correctMulti.includes('C') },
        { id: byLabel.D, label: 'D', text: String(p.D), isCorrect: correctMulti.includes('D') },
      ]
      if (p.E && String(p.E).trim() !== '') {
        optionsPayload.push({ id: byLabel.E, label: 'E', text: String(p.E), isCorrect: correctMulti.includes('E') })
      }
    }
    
    

    if (type === 'TRUE_FALSE') {
      const tTrue = (p.tfTrueText ?? 'Benar').toString()
      const tFalse = (p.tfFalseText ?? 'Salah').toString()
      if (!p.correctTF) throw new Error('Pilih jawaban benar (True/False)')
      const optA = q.options.find((o: OptionRow) => o.label === 'A')
      const optB = q.options.find((o: OptionRow) => o.label === 'B')
      optionsPayload = [
        { id: optA?.id, label: 'A', text: tTrue,  isCorrect: p.correctTF === 'TRUE' },
        { id: optB?.id, label: 'B', text: tFalse, isCorrect: p.correctTF === 'FALSE' },
      ]
    }

    if (type === 'NUMBER') {
      const tolerance = p.tolerance === '' || p.tolerance === undefined ? undefined : Number(p.tolerance)
      const target = p.targetNumber === '' || p.targetNumber === undefined ? undefined : Number(p.targetNumber)
      settings = { tolerance, target }
    }

    if (type === 'RANGE') {
      const min = p.min === '' || p.min === undefined ? undefined : Number(p.min)
      const max = p.max === '' || p.max === undefined ? undefined : Number(p.max)
      const step = p.step === '' || p.step === undefined ? undefined : Number(p.step)
      if (min == null || max == null) throw new Error('Range: min dan max wajib diisi')
      if (Number(min) >= Number(max)) throw new Error('Range: min harus < max')
      settings = { min: Number(min), max: Number(max), step: step ?? null }
    }

    if (type === 'SHORT_TEXT' || type === 'ESSAY') {
      const caseSensitive = !!p.caseSensitive
      const maxLength = p.maxLength === '' || p.maxLength === undefined ? undefined : Number(p.maxLength)
      settings = { caseSensitive, maxLength }
    }

    await prisma.question.update({
      where: { id: q.id },
      data: { ...updateBase, settings },
    })

    if (['SINGLE_CHOICE', 'MULTI_SELECT', 'TRUE_FALSE'].includes(type)) {
      const labelsToKeep = optionsPayload.map(o => o.label)
      await prisma.$transaction(async (tx: Tx) => {
        for (const op of optionsPayload) {
          await tx.answerOption.upsert({
            where: { questionId_label: { questionId: q.id, label: op.label } },
            update: { text: op.text, isCorrect: !!op.isCorrect },
            create: { questionId: q.id, label: op.label, text: op.text, isCorrect: !!op.isCorrect },
          })
        }
        await tx.answerOption.deleteMany({
          where: { questionId: q.id, label: { notIn: labelsToKeep } },
        })
      })
    } else {
      await prisma.answerOption.deleteMany({ where: { questionId: q.id } })
    }

    revalidatePath(`/admin/packages/${id}`)
  }

  // ===== DELETE =====
  async function deleteQuestion(formData: FormData) {
    'use server'
    const qid = String(formData.get('id') ?? '')
    if (!qid) throw new Error('ID kosong')
    await prisma.question.delete({ where: { id: qid } })
    revalidatePath(`/admin/packages/${id}`)
  }
  
  // ===== PASSAGE: CREATE =====
async function createPassage(formData: FormData) {
  'use server'
  const title = String(formData.get('title') ?? '').trim() || null
  const content = String(formData.get('content') ?? '').trim()
  if (!content || content.length < 10) throw new Error('Isi passage minimal 10 karakter')
  await prisma.passage.create({
    data: { examPackageId: id, title, content },
  })
  revalidatePath(`/admin/packages/${id}`)
}

// ===== PASSAGE: UPDATE =====
async function updatePassage(formData: FormData) {
  'use server'
  const pid = String(formData.get('id') ?? '')
  if (!pid) throw new Error('ID passage kosong')
  const title = String(formData.get('title') ?? '').trim() || null
  const content = String(formData.get('content') ?? '').trim()
  if (!content || content.length < 10) throw new Error('Isi passage minimal 10 karakter')
  await prisma.passage.update({
    where: { id: pid },
    data: { title, content },
  })
  revalidatePath(`/admin/packages/${id}`)
}

  async function deletePassage(formData: FormData) {
    'use server'
    const pid = String(formData.get('id') ?? '')
    if (!pid) throw new Error('ID passage kosong')
    await prisma.passage.delete({ where: { id: pid } }) // Question.passageId -> null (onDelete: SetNull)
    revalidatePath(`/admin/packages/${id}`)
  }

  // ===== Fetch daftar soal =====
  const passages = await prisma.passage.findMany({
    where: { examPackageId: id },
    orderBy: { createdAt: 'asc' },
  })
  
  const questions = await prisma.question.findMany({
    where: { examPackageId: id },
    include: { options: true, passage: { select: { id: true, title: true } } }, // NEW
    orderBy: { order: 'asc' }
  }) as Array<{
    id: string
    order: number
    text: string
    imageUrl: string | null
    type: 'SINGLE_CHOICE'|'MULTI_SELECT'|'TRUE_FALSE'|'SHORT_TEXT'|'ESSAY'|'NUMBER'|'RANGE'
    points: number
    required: boolean
    settings: any | null
    contextText: string | null
    passage: { id: string; title: string | null } | null // NEW
    options: Array<{ id: string; label: string; text: string; isCorrect: boolean }>
  }>
  
  

  // UI helpers
  const inputCls =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'
  const fileCls =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-white'
  const cardCls = 'rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200'

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        {/* Header */}
        <a
            href="/admin/packages"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Kembali ke Daftar Paket
          </a>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Kelola Soal — {pkg.title}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Tambah, edit, dan hapus soal untuk paket ini.
          </p>
        </div>

        <a
    href={`/admin/packages/${id}/results`}
    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
  >
    Lihat Hasil
  </a>
        
{/* === PASSAGE SECTION (Pindah ke sini, sebelum ADD QUESTION) === */}
<section className={cardCls}>
  <h2 className="text-lg font-semibold text-gray-900">Reading (Passage)</h2>
  <p className="mt-1 text-sm text-gray-600">
    Buat passage/story panjang, lalu tautkan ke beberapa soal.
  </p>

  <details className="group mt-3">
    <summary className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 group-open:bg-emerald-600 group-open:text-white group-open:border-emerald-600 cursor-pointer">
      <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <span className="group-open:hidden">Tambah Passage</span>
      <span className="hidden group-open:inline">Tutup</span>
    </summary>

    <form action={createPassage} className="mt-3 grid gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Judul (opsional)</label>
        <input name="title" placeholder="mis. Reading 1" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Isi Passage</label>
        <textarea name="content" rows={6} placeholder="Tempel cerita/artikel di sini…" className={inputCls} />
        <p className="mt-1 text-xs text-gray-500">Markdown/plain text; minimal 10 karakter.</p>
      </div>
      <div>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Simpan Passage
        </button>
      </div>
    </form>
  </details>

  <div className="mt-5 divide-y rounded-xl border">
    {passages.length === 0 && (
      <div className="p-4 text-sm text-gray-500">Belum ada passage.</div>
    )}
    {passages.map(p => (
      <div key={p.id} className="grid gap-3 p-4 md:grid-cols-12 md:items-start">
        <div className="md:col-span-8">
          <div className="font-medium text-gray-900">{p.title ?? '(Tanpa judul)'}</div>
          <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-gray-700">{(p as any).content}</div>
        </div>
        <div className="md:col-span-4 md:text-right">
          <form action={updatePassage} className="mb-2 space-y-2">
            <input type="hidden" name="id" value={p.id} />
            <input name="title" defaultValue={p.title ?? ''} className={inputCls} placeholder="Judul (opsional)" />
            <textarea name="content" defaultValue={(p as any).content ?? ''} rows={3} className={inputCls} />
            <button className="rounded-lg border px-3 py-1.5 text-sm">Update</button>
          </form>
          <form action={deletePassage}>
            <input type="hidden" name="id" value={p.id} />
            <button className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
              Hapus
            </button>
          </form>
        </div>
      </div>
    ))}
  </div>
</section>
        {/* CREATE (collapsed by default) */}
<details className="group mt-2 add-q">
  {/* Tombol buka/tutup */}
  <summary
    className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition
               hover:border-blue-400 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50
               group-open:bg-blue-600 group-open:text-white group-open:border-blue-600 select-none cursor-pointer"
    role="button"
  >
    {/* ikon plus → chevron saat open */}
    <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <span className="group-open:hidden">Tambah Soal</span>
    <span className="hidden group-open:inline">Tutup Form Tambah</span>
  </summary>

  {/* Kartu/form tambah soal muncul saat dibuka */}
  <form action={addQuestion} className={`${cardCls} form-add mt-3`} noValidate>
    <h2 className="text-lg font-semibold text-gray-900">Tambah Soal</h2>

    {/* Pilih tipe soal (Dropdown) + deskripsi dinamis */}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="type" className="mb-1 block text-sm font-medium text-gray-800">
          Tipe Soal
        </label>
        <select id="type" name="type" defaultValue="SINGLE_CHOICE" className={inputCls}>
          <option value="SINGLE_CHOICE">Single Choice</option>
          <option value="MULTI_SELECT">Multi Select</option>
          <option value="TRUE_FALSE">True / False</option>
          <option value="NUMBER">Number</option>
          <option value="RANGE">Range</option>
          <option value="SHORT_TEXT">Short Text</option>
          <option value="ESSAY">Essay</option>
        </select>
        
        {/* Deskripsi per tipe (dinamis) */}
        <div className="mt-2 space-y-2 text-xs">
          <div className="tip tip-single rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
            <b>Single Choice:</b> Satu jawaban benar. Isi opsi A–D, lalu pilih 1 yang benar.
          </div>
          <div className="tip tip-multi rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
            <b>Multi Select:</b> Bisa lebih dari satu jawaban benar. Isi A–D, centang yang benar.
          </div>
          <div className="tip tip-tf rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
            <b>True/False:</b> Dua pilihan (Benar/Salah). Pilih salah satunya. Label bisa diubah.
          </div>
          <div className="tip tip-number rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
            <b>Number:</b> Jawaban angka. <i>Target</i> = nilai benar, <i>Tolerance</i> = selisih yang masih benar.
          </div>
          <div className="tip tip-range rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
            <b>Range:</b> Input angka dalam rentang <i>min</i>–<i>max</i> (step opsional).
          </div>
          <div className="tip tip-short rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
            <b>Short Text:</b> Isian singkat. Case sensitive & max length opsional.
          </div>
          <div className="tip tip-essay rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
            <b>Essay:</b> Jawaban panjang. Umumnya dinilai manual.
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="order" className="mb-1 block text-sm font-medium text-gray-800">
          Urutan (angka)
        </label>
        <input id="order" name="order" placeholder="mis. 1" className={inputCls} />
      </div>

      <div>
        <label htmlFor="points" className="mb-1 block text-sm font-medium text-gray-800">Poin</label>
        <input id="points" name="points" type="number" min={0} step={1} defaultValue={1} className={inputCls} />
        <p className="mt-1 text-xs text-gray-500">Nilai yang diberikan jika jawaban benar.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Wajib diisi?</label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input id="required" name="required" type="checkbox" /> Required
        </label>
      </div>
      
      <div className="sm:col-span-2">
        <label htmlFor="image" className="mb-1 block text-sm font-medium text-gray-800">Gambar (opsional)</label>
        <input id="image" name="image" type="file" accept="image/*" className={fileCls} />
        <p className="mt-1 text-xs text-gray-500">PNG/JPEG/WEBP, maks 2MB.</p>
      </div>
      
{/* ⬇️ Tambahkan ini */}
<div className="sm:col-span-2">
  <label className="mb-1 block text-sm font-medium text-gray-800">
    Tautkan ke Passage (opsional)
  </label>
  <select name="passageId" defaultValue="" className={inputCls}>
  <option value="">— Tidak ditautkan —</option>
  {passages.map(p => (
    <option key={`passopt-${p.id}`} value={p.id}>
      {p.title ?? 'Tanpa judul'}
    </option>
  ))}
</select>
  <p className="mt-1 text-xs text-gray-500">
    Soal akan tampil di bawah passage tersebut pada tampilan peserta.
  </p>
</div>
{/* ⬆️ Sampai sini */}

      <div className="sm:col-span-2">
        <label htmlFor="text" className="mb-1 block text-sm font-medium text-gray-800">Teks soal</label>
        <textarea id="text" name="text" placeholder="Tuliskan pertanyaan di sini…" rows={3} className={inputCls} />
      </div>
    </div>

    <div className="sm:col-span-2">
  <label htmlFor="contextText" className="mb-1 block text-sm font-medium text-gray-800">
    Teks pendukung (opsional)
  </label>
  <textarea id="contextText" name="contextText" placeholder="Paragraf/penjelasan singkat sebelum pertanyaan…" rows={3} className={inputCls} />
  <p className="mt-1 text-xs text-gray-500">Contoh: mini-passage, deskripsi studi kasus, atau tabel ringkas.</p>
</div>


    {/* ====== OPSI A–D (Single/Multi) ====== */}
    <div className="section section-single section-multi mt-4">
      <div className="grid gap-3 sm:grid-cols-2">
      {(['A','B','C','D','E'] as const).map(L => (
  <div key={L}>
    <label className="mb-1 block text-sm font-medium text-gray-800">Opsi {L}{L==='E' ? ' (opsional)' : ''}</label>
    <input name={L} placeholder={`Opsi ${L}`} className={inputCls} />
  </div>
))}

      </div>

      {/* Single Choice: pilih 1 benar */}
      <div className="mt-3 section section-single">
        <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (Single Choice)</label>
        <select name="correctLabel" className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">—</option>
          <option value="A">A</option><option value="B">B</option>
          <option value="C">C</option><option value="D">D</option><option value="E">E</option>
        </select>
      </div>

      {/* Multi Select: bisa >1 benar */}
      <div className="mt-3 section section-multi">
        <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (Multi Select)</label>
        <div className="flex gap-4 text-sm">
        {(['A','B','C','D','E'] as const).map(L => (
  <label key={`cm-${L}`} className="inline-flex items-center gap-2">
    <input type="checkbox" name="correctMulti" value={L} /> {L}
  </label>
))}

        </div>
      </div>
    </div>

    {/* ====== TRUE / FALSE ====== */}
    <div className="section section-tf mt-4 grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Teks untuk TRUE</label>
        <input name="tfTrueText" defaultValue="Benar" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Teks untuk FALSE</label>
        <input name="tfFalseText" defaultValue="Salah" className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (True/False)</label>
        <div className="flex gap-6 text-sm">
          <label className="inline-flex items-center gap-2"><input type="radio" name="correctTF" value="TRUE" /> TRUE</label>
          <label className="inline-flex items-center gap-2"><input type="radio" name="correctTF" value="FALSE" /> FALSE</label>
        </div>
      </div>
    </div>

    {/* ====== NUMBER ====== */}
    <div className="section section-number mt-4 grid gap-3 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Target (Number)</label>
        <input name="targetNumber" type="number" step="any" placeholder="mis. 42" className={inputCls} />
        <p className="mt-1 text-xs text-gray-500">Nilai benar (boleh desimal).</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Tolerance (Number)</label>
        <input name="tolerance" type="number" step="any" placeholder="mis. 0.5" className={inputCls} />
        <p className="mt-1 text-xs text-gray-500">Selisih yang masih dianggap benar (≥ 0).</p>
      </div>
    </div>

    {/* ====== RANGE ====== */}
    <div className="section section-range mt-4 grid gap-3 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Min (Range)</label>
        <input name="min" type="number" step="any" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Max (Range)</label>
        <input name="max" type="number" step="any" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Step (Range)</label>
        <input name="step" type="number" step="any" placeholder="opsional" className={inputCls} />
        <p className="mt-1 text-xs text-gray-500">Besaran kenaikan slider (opsional).</p>
      </div>
    </div>

    {/* ====== SHORT / ESSAY ====== */}
    <div className="section section-short section-essay mt-4 grid gap-3 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Case sensitive</label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="caseSensitive" /> Aktifkan
        </label>
        <p className="mt-1 text-xs text-gray-500">Perhatikan huruf besar/kecil saat evaluasi.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Max length</label>
        <input name="maxLength" type="number" step={1} min={1} placeholder="opsional" className={inputCls} />
        <p className="mt-1 text-xs text-gray-500">Batas karakter jawaban (opsional).</p>
      </div>
    </div>

    <div className="pt-4">
      <button className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        Simpan Soal
      </button>
    </div>

    {/* ====== CSS toggle per tipe (dropdown) ====== */}
    <style>{`
      /* Fallback: kalau :has tidak didukung, tampilkan semua agar nggak 'kosong' */
      .form-add .section { display: block; }
      .form-add .tip { display: block; }

      @supports selector(:has(*)) {
        /* Sembunyikan semua dulu */
        .form-add .section { display: none; }
        .form-add .tip { display: none; }

        /* Default state (kalau belum ada pilihan) -> Single Choice */
        .form-add:not(:has(select[name="type"] option:checked)) .section-single,
        .form-add:not(:has(select[name="type"] option:checked)) .tip-single { display: block; }

        /* Tampilkan sesuai option yang sedang dipilih */
        .form-add:has(select[name="type"] option[value="SINGLE_CHOICE"]:checked) .section-single { display: block; }
        .form-add:has(select[name="type"] option[value="SINGLE_CHOICE"]:checked) .tip-single { display: block; }

        .form-add:has(select[name="type"] option[value="MULTI_SELECT"]:checked) .section-multi { display: block; }
        .form-add:has(select[name="type"] option[value="MULTI_SELECT"]:checked) .tip-multi { display: block; }

        .form-add:has(select[name="type"] option[value="TRUE_FALSE"]:checked) .section-tf { display: grid; }
        .form-add:has(select[name="type"] option[value="TRUE_FALSE"]:checked) .tip-tf { display: block; }

        .form-add:has(select[name="type"] option[value="NUMBER"]:checked) .section-number { display: grid; }
        .form-add:has(select[name="type"] option[value="NUMBER"]:checked) .tip-number { display: block; }

        .form-add:has(select[name="type"] option[value="RANGE"]:checked) .section-range { display: grid; }
        .form-add:has(select[name="type"] option[value="RANGE"]:checked) .tip-range { display: block; }

        .form-add:has(select[name="type"] option[value="SHORT_TEXT"]:checked) .section-short { display: grid; }
        .form-add:has(select[name="type"] option[value="SHORT_TEXT"]:checked) .tip-short { display: block; }

        .form-add:has(select[name="type"] option[value="ESSAY"]:checked) .section-essay { display: grid; }
        .form-add:has(select[name="type"] option[value="ESSAY"]:checked) .tip-essay { display: block; }

        /* Shared block (SHORT_TEXT & ESSAY) */
        .form-add:has(select[name="type"] option[value="SHORT_TEXT"]:checked) .section-short.section-essay { display: grid; }
        .form-add:has(select[name="type"] option[value="ESSAY"]:checked) .section-short.section-essay { display: grid; }
      }
    `}</style>
  </form>
</details>

{/* Sembunyikan marker default summary → beneran berasa tombol */}
<style>{`
  details.add-q > summary { list-style: none; }
  details.add-q > summary::-webkit-details-marker { display: none; }
`}</style>

        {/* LIST + EDIT/DELETE */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Daftar Soal</h2>

          <ol className="space-y-4">
            {questions.map((q) => {
              const correctIds = new Set(q.options.filter(o => o.isCorrect).map(o => o.id))
              return (
                <li key={q.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                        {q.order}
                      </span>
                      <div className="font-semibold text-gray-900">Soal #{q.order}</div>
                      <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                        {q.type.replace(/_/g, ' ')}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {q.points} poin {q.required ? '• wajib' : ''}
                      </span>
                    </div>
                    <form>
                      <input type="hidden" name="id" value={q.id} />
                      <button
                        formAction={deleteQuestion}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    </form>
                  </div>

                  <div className="mt-2 leading-relaxed text-gray-800">{q.text}</div>

                  {(q as any).contextText && (
  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    {(q as any).contextText}
  </div>
)}


                  {q.imageUrl && (
                    <img
                      src={q.imageUrl}
                      alt="gambar soal"
                      className="mt-3 max-h-64 rounded-xl border border-gray-200 object-contain"
                    />
                  )}

                  {q.options.length > 0 && (
                    <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      {q.options.map((o) => (
                        <li
                          key={o.id}
                          className={`rounded-lg border px-3 py-2 ${
                            correctIds.has(o.id)
                              ? 'border-green-300 bg-green-50 font-semibold'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          {o.label}. {o.text}
                        </li>
                      ))}
                    </ul>
                  )}

                  {q.settings && (
                    <div className="mt-2 text-xs text-gray-600">
                      <code className="rounded bg-gray-100 px-2 py-1">{JSON.stringify(q.settings)}</code>
                    </div>
                  )}

                  {/* EDIT */}
                  <details className="group mt-3">
                  <summary
  className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition
             hover:border-blue-400 hover:bg-blue-100
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50
             group-open:bg-blue-600 group-open:text-white group-open:border-blue-600 select-none cursor-pointer"
  role="button"
>
  {/* ikon chevron */}
  <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>

  {/* label berubah saat dibuka/ditutup */}
  <span className="group-open:hidden">Edit soal ini</span>
  <span className="hidden group-open:inline">Tutup edit</span>
</summary>


                    <form action={updateQuestion} className="mt-3 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 form-edit" noValidate>
  <input type="hidden" name="id" value={q.id} />

  <div className="grid gap-3 sm:grid-cols-2">
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Urutan</label>
      <input name="order" defaultValue={q.order} className={inputCls} />
    </div>

    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Tipe Soal</label>
      <select name="type" defaultValue={q.type} className={inputCls}>
        <option value="SINGLE_CHOICE">Single Choice</option>
        <option value="MULTI_SELECT">Multi Select</option>
        <option value="TRUE_FALSE">True / False</option>
        <option value="SHORT_TEXT">Short Text</option>
        <option value="ESSAY">Essay</option>
        <option value="NUMBER">Number</option>
        <option value="RANGE">Range</option>
      </select>

      {/* Deskripsi per tipe (dinamis) */}
      <div className="mt-2 space-y-2 text-xs">
        <div className="tip tip-single rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
          <b>Single Choice:</b> Satu jawaban benar. Isi opsi A–D, lalu pilih 1 yang benar.
        </div>
        <div className="tip tip-multi rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
          <b>Multi Select:</b> Bisa lebih dari satu jawaban benar. Isi A–D, centang yang benar.
        </div>
        <div className="tip tip-tf rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
          <b>True/False:</b> Dua pilihan (Benar/Salah). Pilih salah satunya. Label bisa diubah.
        </div>
        <div className="tip tip-number rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
          <b>Number:</b> Jawaban angka. <i>Target</i> = nilai benar, <i>Tolerance</i> = selisih yang masih benar.
        </div>
        <div className="tip tip-range rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
          <b>Range:</b> Input angka dalam rentang <i>min</i>–<i>max</i> (step opsional).
        </div>
        <div className="tip tip-short rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
          <b>Short Text:</b> Isian singkat. Case sensitive & max length opsional.
        </div>
        <div className="tip tip-essay rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
          <b>Essay:</b> Jawaban panjang. Umumnya dinilai manual.
        </div>
      </div>
    </div>

    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Poin</label>
      <input name="points" type="number" min={0} step={1} defaultValue={q.points} className={inputCls} />
    </div>

    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Wajib diisi?</label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name="required" defaultChecked={q.required} /> Required
      </label>
    </div>

    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Gambar (opsional)</label>
      <input name="image" type="file" accept="image/*" className={fileCls} />
    </div>

    <div className="sm:col-span-2">
  <label className="mb-1 block text-sm font-medium text-gray-800">
    Tautkan ke Passage (opsional)
  </label>
  <select name="passageId" defaultValue={q.passage?.id ?? ''} className={inputCls}>
    <option value="">— Tidak ditautkan —</option>
    {passages.map(p => (
      <option key={`passopt-${q.id}-${p.id}`} value={p.id}>
        {p.title ?? 'Tanpa judul'}
      </option>
    ))}
  </select>
</div>

    <div className="sm:col-span-2">
      <label className="mb-1 block text-sm font-medium text-gray-800">Teks soal</label>
      <textarea name="text" defaultValue={q.text} rows={3} className={inputCls} />
    </div>
  </div>

  <div className="sm:col-span-2">
  <label className="mb-1 block text-sm font-medium text-gray-800">Teks pendukung (opsional)</label>
  <textarea name="contextText" defaultValue={(q as any).contextText ?? ''} rows={3} className={inputCls} />
  <p className="mt-1 text-xs text-gray-500">Kosongkan untuk menghapus teks pendukung.</p>
</div>


  {/* ====== OPSI A–D (Single/Multi) ====== */}
  <div className="section section-single section-multi grid gap-3 sm:grid-cols-2">
  {(['A','B','C','D','E'] as const).map(L => (
  <div key={`edit-${q.id}-${L}`}>
    <label className="mb-1 block text-sm font-medium text-gray-800">Opsi {L}{L==='E' ? ' (opsional)' : ''}</label>
    <input
      name={L}
      defaultValue={q.options.find((o) => o.label === L)?.text ?? ''}
      className={inputCls}
    />
  </div>
))}


    {/* Single Choice: pilih 1 benar */}
    <div className="sm:col-span-2 section section-single">
      <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (Single Choice)</label>
      <select
        name="correctLabel"
        defaultValue={q.options.find(o => o.isCorrect)?.label ?? ''}
        className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <option value="">—</option>
        <option value="A">A</option><option value="B">B</option>
        <option value="C">C</option><option value="D">D</option><option value="E">E</option>
      </select>
    </div>

    {/* Multi Select: bisa >1 benar */}
    <div className="sm:col-span-2 section section-multi">
      <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (Multi Select)</label>
      <div className="flex flex-wrap gap-4 text-sm">
      {(['A','B','C','D','E'] as const).map(L => {
  const isC = q.options.find(o => o.label === L)?.isCorrect ?? false
  return (
    <label key={`edit-cm-${q.id}-${L}`} className="inline-flex items-center gap-2">
      <input type="checkbox" name="correctMulti" value={L} defaultChecked={isC} /> {L}
    </label>
  )
})}

      </div>
    </div>
  </div>

  {/* ====== TRUE / FALSE ====== */}
  <div className="section section-tf grid gap-3 sm:grid-cols-2">
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Teks TRUE</label>
      <input
        name="tfTrueText"
        defaultValue={q.options.find(o=>o.label==='A')?.text ?? 'Benar'}
        className={inputCls}
      />
    </div>
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Teks FALSE</label>
      <input
        name="tfFalseText"
        defaultValue={q.options.find(o=>o.label==='B')?.text ?? 'Salah'}
        className={inputCls}
      />
    </div>
    <div className="sm:col-span-2">
      <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (True/False)</label>
      <div className="flex gap-6 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="correctTF"
            value="TRUE"
            defaultChecked={q.options.find(o=>o.label==='A')?.isCorrect === true}
          /> TRUE
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="correctTF"
            value="FALSE"
            defaultChecked={q.options.find(o=>o.label==='B')?.isCorrect === true}
          /> FALSE
        </label>
      </div>
    </div>
  </div>

  {/* ====== NUMBER ====== */}
  <div className="section section-number grid gap-3 sm:grid-cols-3">
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Target (Number)</label>
      <input name="targetNumber" type="number" step="any" defaultValue={q.settings?.target ?? ''} className={inputCls} />
      <p className="mt-1 text-xs text-gray-500">Nilai benar (boleh desimal).</p>
    </div>
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Tolerance (Number)</label>
      <input name="tolerance" type="number" step="any" defaultValue={q.settings?.tolerance ?? ''} className={inputCls} />
      <p className="mt-1 text-xs text-gray-500">Selisih yang masih dianggap benar (≥ 0).</p>
    </div>
  </div>

  {/* ====== RANGE ====== */}
  <div className="section section-range grid gap-3 sm:grid-cols-3">
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Min (Range)</label>
      <input name="min" type="number" step="any" defaultValue={q.settings?.min ?? ''} className={inputCls} />
    </div>
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Max (Range)</label>
      <input name="max" type="number" step="any" defaultValue={q.settings?.max ?? ''} className={inputCls} />
    </div>
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Step (Range)</label>
      <input name="step" type="number" step="any" defaultValue={q.settings?.step ?? ''} className={inputCls} />
      <p className="mt-1 text-xs text-gray-500">Besaran kenaikan slider (opsional).</p>
    </div>
  </div>

  {/* ====== SHORT / ESSAY ====== */}
  <div className="section section-short section-essay grid gap-3 sm:grid-cols-3">
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Case sensitive</label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name="caseSensitive" defaultChecked={q.settings?.caseSensitive === true} /> Aktifkan
      </label>
      <p className="mt-1 text-xs text-gray-500">Perhatikan huruf besar/kecil saat evaluasi.</p>
    </div>
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800">Max length</label>
      <input name="maxLength" type="number" step={1} min={1} defaultValue={q.settings?.maxLength ?? ''} className={inputCls} />
      <p className="mt-1 text-xs text-gray-500">Batas karakter jawaban (opsional).</p>
    </div>
  </div>

  <div className="pt-1">
    <button className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      Simpan Perubahan
    </button>
  </div>

  {/* ====== CSS toggle per tipe (dropdown) ====== */}
  <style>{`
    /* Fallback: kalau :has tidak didukung, tampilkan semua agar tidak 'kosong' */
    .form-edit .section { display: block; }
    .form-edit .tip { display: block; }

    @supports selector(:has(*)) {
      /* Sembunyikan semua dulu */
      .form-edit .section { display: none; }
      .form-edit .tip { display: none; }

      /* Tampilkan sesuai option yang dipilih pada select[name="type"] */
      .form-edit:has(select[name="type"] option[value="SINGLE_CHOICE"]:checked) .section-single { display: grid; }
      .form-edit:has(select[name="type"] option[value="SINGLE_CHOICE"]:checked) .tip-single { display: block; }

      .form-edit:has(select[name="type"] option[value="MULTI_SELECT"]:checked) .section-multi { display: grid; }
      .form-edit:has(select[name="type"] option[value="MULTI_SELECT"]:checked) .tip-multi { display: block; }

      .form-edit:has(select[name="type"] option[value="TRUE_FALSE"]:checked) .section-tf { display: grid; }
      .form-edit:has(select[name="type"] option[value="TRUE_FALSE"]:checked) .tip-tf { display: block; }

      .form-edit:has(select[name="type"] option[value="NUMBER"]:checked) .section-number { display: grid; }
      .form-edit:has(select[name="type"] option[value="NUMBER"]:checked) .tip-number { display: block; }

      .form-edit:has(select[name="type"] option[value="RANGE"]:checked) .section-range { display: grid; }
      .form-edit:has(select[name="type"] option[value="RANGE"]:checked) .tip-range { display: block; }

      .form-edit:has(select[name="type"] option[value="SHORT_TEXT"]:checked) .section-short { display: grid; }
      .form-edit:has(select[name="type"] option[value="SHORT_TEXT"]:checked) .tip-short { display: block; }

      .form-edit:has(select[name="type"] option[value="ESSAY"]:checked) .section-essay { display: grid; }
      .form-edit:has(select[name="type"] option[value="ESSAY"]:checked) .tip-essay { display: block; }

      /* Shared block (SHORT_TEXT & ESSAY) */
      .form-edit:has(select[name="type"] option[value="SHORT_TEXT"]:checked) .section-short.section-essay { display: grid; }
      .form-edit:has(select[name="type"] option[value="ESSAY"]:checked) .section-short.section-essay { display: grid; }

        /* Hilangkan marker default summary biar bener-bener mirip tombol */
  details > summary { list-style: none; }
  details > summary::-webkit-details-marker { display: none; }
    }
  `}</style>
</form>

                  </details>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* Footer */}
<footer className="mt-16 border-t border-gray-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-gray-800 dark:bg-gray-950/70">
  <div className="mx-auto max-w-7xl px-6">
    {/* Top: brand + nav columns */}
    <div className="grid gap-10 py-12 md:grid-cols-4">
      {/* Brand */}
      <div className="md:col-span-1">
        <a href="/" className="inline-flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            {/* Simple mark (graduation cap) */}
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path fill="currentColor" d="M12 3 2 8l10 5 8-4.1V15h2V8L12 3zm-6 9.2V16c0 2.2 3.1 4 6 4s6-1.8 6-4v-3.8l-6 3-6-3z"/>
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Simulasi Ujian
          </span>
        </a>
        <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-400">
          Platform simulasi ujian untuk siswa & institusi—stabil, aman, dan mudah digunakan.
        </p>
      </div>

      {/* Columns */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Produk
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><a href="/features" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Fitur</a></li>
          <li><a href="/pricing" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Harga</a></li>
          <li><a href="/docs" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Dokumentasi</a></li>
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Perusahaan
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><a href="/about" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Tentang</a></li>
          <li><a href="/careers" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Karier</a></li>
          <li><a href="/contact" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Kontak</a></li>
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Dukungan
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><a href="/status" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Status Layanan</a></li>
          <li><a href="/privacy" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Kebijakan Privasi</a></li>
          <li><a href="/terms" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Syarat & Ketentuan</a></li>
        </ul>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="flex flex-col-reverse items-center justify-between gap-4 border-t border-gray-200 py-6 text-sm md:flex-row dark:border-gray-800">
      <p className="text-gray-600 dark:text-gray-400">
        © {new Date().getFullYear()} Simulasi Ujian. All rights reserved.
      </p>

      <div className="flex flex-col items-center gap-3 md:flex-row">
        <p className="text-gray-600 dark:text-gray-400">
          Dibuat oleh
        </p>

        <span className="hidden h-4 w-px bg-gray-200 md:block dark:bg-gray-800" aria-hidden="true" />

        {/* Social icons */}
        <div className="flex items-center gap-2">
  <a
    href="https://instagram.com/fahmibastari"
    target="_blank"
    rel="noopener noreferrer"
    title="Instagram @fahmibastari"
    aria-label="Instagram @fahmibastari"
    className="group inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-900/50"
  >
    <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-80 transition group-hover:opacity-100" aria-hidden="true">
      <path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7m9.5 2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/>
    </svg>
    <span className="underline decoration-gray-300/70 underline-offset-4 group-hover:decoration-gray-400">
      Fahmi Bastari
    </span>
  </a>

  <span className="h-4 w-px bg-gray-200 dark:bg-gray-800" aria-hidden="true" />

  <a
    href="https://instagram.com/qorrieaa"
    target="_blank"
    rel="noopener noreferrer"
    title="Instagram @qorriea"
    aria-label="Instagram @qorriea"
    className="group inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-900/50"
  >
    <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-80 transition group-hover:opacity-100" aria-hidden="true">
      <path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7m9.5 2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/>
    </svg>
    <span className="underline decoration-gray-300/70 underline-offset-4 group-hover:decoration-gray-400">
      Qorrie Aina
    </span>
  </a>
</div>

      </div>
    </div>
  </div>
</footer>

    </main>
  )
}
