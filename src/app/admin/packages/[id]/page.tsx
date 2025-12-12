// src/app/admin/packages/[id]/page.tsx
export const runtime = 'nodejs'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ArrowLeft, Plus, Image as ImageIcon, Trash2, Edit2, GripVertical, FileText, CheckSquare, Save, X, ChevronDown, ChevronRight, LayoutList, AlertCircle } from 'lucide-react'
import ConfirmDeleteForm from '@/app/admin/_components/ConfirmDeleteForm'

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
  'SINGLE_CHOICE', 'MULTI_SELECT', 'TRUE_FALSE', 'SHORT_TEXT', 'ESSAY', 'NUMBER', 'RANGE',
])

const BaseQSchema = z.object({
  order: z.coerce.number().int().positive(),
  text: z.string().min(3),
  image: z.any().optional(),
  type: QuestionTypeEnum,
  points: z.coerce.number().int().min(0).default(1),
  required: BoolFromCheckbox.default(false),
  contextText: OptionalNonEmpty.optional(),
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
  props: { params: Promise<{ id: string }>, searchParams: Promise<{ q?: string }> }
) {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const query = searchParams.q?.toLowerCase() || ''
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

  async function uploadAudio(pkgId: string, file: File | null | undefined) {
    'use server'
    if (!file || (file as any).size === 0) return undefined

    const maxBytes = 10 * 1024 * 1024 // 10MB
    const okTypes = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'])
    const mime = (file as any).type || ''

    // Relaxed check: allow any audio/
    if (!mime.startsWith('audio/')) throw new Error('File harus berupa audio')
    if ((file as any).size > maxBytes) throw new Error('Ukuran audio maks 10MB')

    const safeName = String((file as any).name || 'audio').replace(/[^\w.\-]+/g, '_')
    const fileName = `${pkgId}/${Date.now()}_${safeName}`

    // Use 'exam-audio' bucket
    const { data, error } = await supabaseAdmin
      .storage.from('exam-audio')
      .upload(fileName, file as any, { upsert: false, contentType: mime })
    if (error) throw new Error('Upload audio gagal: ' + error.message)

    const { data: pub } = supabaseAdmin.storage.from('exam-audio').getPublicUrl(data.path)
    return pub.publicUrl
  }

  // ===== CREATE =====
  async function addQuestion(formData: FormData) {
    'use server'
    const correctMulti = formData.getAll('correctMulti').map(String) as Array<'A' | 'B' | 'C' | 'D' | 'E'>

    const raw = {
      order: formData.get('order'),
      text: formData.get('text'),
      image: formData.get('image') as unknown as File | null,
      type: formData.get('type'),
      points: formData.get('points'),
      required: formData.get('required'),
      contextText: formData.get('contextText'),
      passageId: formData.get('passageId'),
      audio: formData.get('audio') as unknown as File | null,

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
    const audioUrl = await uploadAudio(id, raw.audio)

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
      const labels4: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']
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
      const labels4: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']
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
        { label: 'A', text: tTrue, isCorrect: p.correctTF === 'TRUE' },
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
        // @ts-ignore
        audioUrl,
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
    const correctMulti = formData.getAll('correctMulti').map(String) as Array<'A' | 'B' | 'C' | 'D' | 'E'>

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
      audio: formData.get('audio') as unknown as File | null,


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

    let audioUrl = q.audioUrl ?? undefined
    // @ts-ignore
    if (raw.audio && raw.audio.size > 0) {
      // @ts-ignore
      audioUrl = await uploadAudio(id, raw.audio)
    }

    let optionsPayload: Array<{ id?: string; label: string; text: string; isCorrect?: boolean }> = []
    let settings: Record<string, any> | undefined = undefined
    const type = p.type

    const updateBase = {
      order: safeOrder,
      text: p.text,
      imageUrl,
      // @ts-ignore
      audioUrl,
      type,
      points: p.points ?? 1,
      required: p.required ?? false,
      contextText: p.contextText ? String(p.contextText) : null,
      passageId: p.passageId ? String(p.passageId) : null, // kosongkan = lepas dari passage
    }

    if (type === 'SINGLE_CHOICE') {
      const labels4: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']
      for (const L of labels4) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') throw new Error(`Opsi ${L} wajib diisi`)
      }
      if (!p.correctLabel) throw new Error('Pilih jawaban benar')

      // map id existing by label termasuk E
      const byLabel: Record<'A' | 'B' | 'C' | 'D' | 'E', string | undefined> = { A: undefined, B: undefined, C: undefined, D: undefined, E: undefined }
      q.options.forEach((o: OptionRow) => {
        if (['A', 'B', 'C', 'D', 'E'].includes(o.label)) (byLabel as any)[o.label] = o.id
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
      const labels4: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']
      for (const L of labels4) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') throw new Error(`Opsi ${L} wajib diisi`)
      }

      const byLabel: Record<'A' | 'B' | 'C' | 'D' | 'E', string | undefined> = { A: undefined, B: undefined, C: undefined, D: undefined, E: undefined }
      q.options.forEach((o: OptionRow) => {
        if (['A', 'B', 'C', 'D', 'E'].includes(o.label)) (byLabel as any)[o.label] = o.id
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
        { id: optA?.id, label: 'A', text: tTrue, isCorrect: p.correctTF === 'TRUE' },
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

    // @ts-ignore
    const audioFile = formData.get('audio') as File | null
    const audioUrl = await uploadAudio(id, audioFile)

    const last = await prisma.passage.findFirst({ where: { examPackageId: id }, orderBy: { order: 'desc' }, select: { order: true } })
    const newOrder = (last?.order ?? 0) + 1

    await prisma.passage.create({
      // @ts-ignore
      data: { examPackageId: id, title, content, audioUrl, order: newOrder },
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
    const order = Number(formData.get('order'))
    if (!content || content.length < 10) throw new Error('Isi passage minimal 10 karakter')

    // @ts-ignore
    const audioFile = formData.get('audio') as File | null
    let audioUrlUpdate = undefined
    if (audioFile && audioFile.size > 0) {
      audioUrlUpdate = await uploadAudio(id, audioFile)
    }

    await prisma.passage.update({
      where: { id: pid },
      data: {
        title,
        content,
        // @ts-ignore
        ...(Number.isFinite(order) ? { order } : {}),
        // @ts-ignore
        ...(audioUrlUpdate ? { audioUrl: audioUrlUpdate } : {})
      },
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
    // @ts-ignore
    orderBy: { order: 'asc' },
  })

  const questions = (await prisma.question.findMany({
    where: { examPackageId: id },
    include: { options: true, passage: { select: { id: true, title: true } } }, // NEW
    orderBy: { order: 'asc' }
  })) as unknown as Array<{
    id: string
    order: number
    text: string
    imageUrl: string | null
    audioUrl: string | null // NEW
    type: 'SINGLE_CHOICE' | 'MULTI_SELECT' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'ESSAY' | 'NUMBER' | 'RANGE'
    points: number
    required: boolean
    settings: any | null
    contextText: string | null
    passage: { id: string; title: string | null } | null // NEW
    options: Array<{ id: string; label: string; text: string; isCorrect: boolean }>
  }>

  // Filter questions if query exists
  // We filter effectively here:
  const filteredQuestions = query
    ? questions.filter(q => q.text.toLowerCase().includes(query))
    : questions

  // Use filteredQuestions for the UI rendering to sections
  const questionsToRender = filteredQuestions



  // UI helpers
  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'
  const fileCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-4 file:py-2.5 file:text-white file:font-semibold hover:file:bg-indigo-700'
  const cardCls = 'rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200'

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <section className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link
              href="/admin/packages"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar Paket
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Kelola Soal: {pkg.title}
              </h1>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                {questions.length} Soal
              </span>
            </div>

            <p className="text-sm text-slate-600">
              Tambah, edit, dan hapus soal untuk paket ini.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/admin/packages/${id}/results`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <LayoutList className="h-4 w-4" />
              Lihat Hasil
            </Link>
            <Link
              href={`/admin/packages/${id}/settings`}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <Edit2 className="h-4 w-4" />
              Edit Paket
            </Link>
          </div>
        </div>

        {/* === PASSAGE SECTION === */}
        <section className={cardCls}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Passage / Reading Section</h2>
              <p className="text-xs text-slate-500">Buat teks bacaan panjang yang dapat digunakan untuk referensi soal.</p>
            </div>
          </div>


          <details className="group mt-3">
            <summary className="inline-flex items-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 hover:border-indigo-400 cursor-pointer w-full justify-center sm:w-auto">
              <Plus className="h-4 w-4 transition-transform group-open:rotate-45" />
              <span className="group-open:hidden">Tambah Passage Baru</span>
              <span className="hidden group-open:inline">Batal / Tutup Form</span>
            </summary>

            <div className="mt-4 p-4 border border-indigo-100 rounded-xl bg-indigo-50/30">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">Buat Passage Baru</h3>
              <form action={createPassage} className="grid gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Judul (opsional)</label>
                  <input name="title" placeholder="Contoh: Bacaan tentang Sejarah Komputer" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Isi Passage</label>
                  <textarea name="content" rows={6} placeholder="Tempel teks bacaan di sini..." className={inputCls} />
                  <p className="mt-1 text-xs text-slate-500">Markdown didukung. Minimal 10 karakter.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">File Audio (Opsional)</label>
                  <input type="file" name="audio" accept="audio/*" className={fileCls} />
                  <p className="mt-1 text-xs text-slate-500">Format: MP3, WAV, M4A, AAC. Maks 10MB.</p>
                </div>
                <div>
                  <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm">
                    <Save className="h-4 w-4" />
                    Simpan Passage
                  </button>
                </div>
              </form>
            </div>
          </details>

          <div className="mt-6 space-y-4">
            {passages.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-500">Belum ada passage yang dibuat.</p>
              </div>
            )}
            {passages.map(p => (
              <div key={p.id} className="group relative rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:bg-white hover:shadow-md">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-100 text-xs font-bold text-indigo-700">
                        P
                      </div>
                      <span className="font-semibold text-slate-900">{p.title ?? '(Tanpa Judul)'}</span>
                    </div>
                    <div className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-600 font-mono bg-white p-3 rounded border border-slate-200 text-xs">{(p as any).content}</div>
                    {(p as any).audioUrl && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                        <div className="font-semibold">Audio Tersedia</div>
                        <audio controls src={(p as any).audioUrl} className="h-6 w-48" />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 self-start md:self-center">
                    <details className="relative">
                      <summary className="list-none">
                        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                          <Edit2 className="h-3 w-3" /> Edit
                        </div>
                      </summary>
                      <div className="absolute right-0 z-10 mt-2 w-[400px] max-w-[90vw] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                        <h4 className="font-semibold text-slate-900 mb-3">Edit Passage</h4>
                        <form action={updatePassage} className="space-y-3">
                          <input type="hidden" name="id" value={p.id} />
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">Judul</label>
                            <input name="title" defaultValue={p.title ?? ''} className={inputCls} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">Konten</label>
                            <textarea name="content" defaultValue={(p as any).content ?? ''} rows={5} className={inputCls} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">Update Audio</label>
                            <input type="file" name="audio" accept="audio/*" className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                          </div>
                          <div className="flex justify-end pt-2">
                            <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">Update</button>
                          </div>
                        </form>
                      </div>
                    </details>

                    <ConfirmDeleteForm action={deletePassage} id={p.id} confirmationMessage="Hapus passage ini? Soal terkait akan kehilangan referensi.">
                      <button className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3 w-3" /> Hapus
                      </button>
                    </ConfirmDeleteForm>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CREATE QUESTION SECTION */}
        <div id="create-question">
          <details className="group add-q" open={questions.length === 0}>
            <summary className="flex items-center justify-between w-full p-4 rounded-xl bg-indigo-600 text-white shadow-md cursor-pointer hover:bg-indigo-700 transition list-none">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                <span className="font-semibold">Tambah Soal Baru</span>
              </div>
              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-4 p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
              <form action={addQuestion} className="space-y-6" noValidate>
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Type Selection */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Tipe Soal</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { v: 'SINGLE_CHOICE', l: 'Pilihan Ganda' },
                        { v: 'MULTI_SELECT', l: 'Pilihan Ganda Kompleks' },
                        { v: 'TRUE_FALSE', l: 'Benar / Salah' },
                        { v: 'SHORT_TEXT', l: 'Isian Singkat' },
                        { v: 'ESSAY', l: 'Uraian' },
                        { v: 'NUMBER', l: 'Angka' },
                        { v: 'RANGE', l: 'Skala / Range' } // Fixed label
                      ].map(opt => (
                        <label key={opt.v} className="cursor-pointer relative">
                          <input type="radio" name="type" value={opt.v} className="peer sr-only" defaultChecked={opt.v === 'SINGLE_CHOICE'} />
                          <div className="rounded-lg border border-slate-200 p-3 text-center text-sm font-medium text-slate-600 transition-all peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 hover:border-indigo-300">
                            {opt.l}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Urutan</label>
                    <input name="order" placeholder="Otomatis (akhir)" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Poin / Bobot</label>
                    <input name="points" type="number" min={0} defaultValue={1} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input name="required" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                      <span className="text-sm font-medium text-slate-700">Wajib Diisi (Siswa harus menjawab)</span>
                    </label>
                  </div>

                  {/* Content */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pertanyaan</label>
                    <textarea name="text" rows={3} className={inputCls} placeholder="Tulis pertanyaan di sini (Markdown didukung)..." required />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Gambar Soal (Opsional)</label>
                    <input type="file" name="image" accept="image/*" className={fileCls} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Audio Soal (Opsional)</label>
                    <input type="file" name="audio" accept="audio/*" className={fileCls} />
                    <p className="mt-1 text-xs text-slate-500">Listening Section. MP3/WAV/AAC/M4A. Max 10MB.</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Passage Referensi (opsional)</label>
                    <select name="passageId" className={inputCls}>
                      <option value="">— Tidak menggunakan passage —</option>
                      {passages.map(p => (
                        <option key={p.id} value={p.id}>{p.title || '(Tanpa Judul)'} - {p.id.slice(0, 8)}...</option>
                      ))}
                    </select>
                  </div>

                  {/* OPTIONS SECTION AREA - Styled based on selection logic handled by JS ideally, but here CSS/Details */}
                  <div className="sm:col-span-2 border-t border-slate-100 pt-6">
                    <h4 className="font-semibold text-slate-900 mb-4">Opsi Jawaban & Kunci</h4>

                    <div className="space-y-6">
                      {/* Multiple Choice Blocks */}
                      <div className="grid gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Untuk Pilihan Ganda / Kompleks</p>
                        {['A', 'B', 'C', 'D', 'E'].map(label => (
                          <div key={label} className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-300 font-bold text-slate-600 shadow-sm">
                              {label}
                            </div>
                            <div className="flex-1 space-y-2">
                              <input name={label} placeholder={`Pilihan ${label}`} className={inputCls} />
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer" title="Benar untuk Single Choice">
                                <input type="radio" name="correctLabel" value={label} className="text-indigo-600 focus:ring-indigo-600" />
                                <span>Kunci (Satu)</span>
                              </label>
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer" title="Benar untuk Multi Select">
                                <input type="checkbox" name="correctMulti" value={label} className="rounded text-indigo-600 focus:ring-indigo-600" />
                                <span>Kunci (Multi)</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* True False */}
                      <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="sm:col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Untuk True / False</p>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Label Benar</label>
                          <input name="tfTrueText" defaultValue="Benar" className={inputCls} />
                          <label className="mt-2 flex items-center gap-2">
                            <input type="radio" name="correctTF" value="TRUE" className="text-indigo-600" />
                            <span className="text-sm font-medium">Ini Jawaban Benar</span>
                          </label>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Label Salah</label>
                          <input name="tfFalseText" defaultValue="Salah" className={inputCls} />
                          <label className="mt-2 flex items-center gap-2">
                            <input type="radio" name="correctTF" value="FALSE" className="text-indigo-600" />
                            <span className="text-sm font-medium">Ini Jawaban Benar</span>
                          </label>
                        </div>
                      </div>

                      {/* Numeric / Range */}
                      <div className="grid sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="sm:col-span-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Untuk Angka, Range, & Text</p>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Target Angka</label>
                          <input name="targetNumber" type="number" step="any" className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Toleransi (+/-)</label>
                          <input name="tolerance" type="number" step="any" className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Min (Range)</label>
                          <input name="min" type="number" step="any" className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Max (Range)</label>
                          <input name="max" type="number" step="any" className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Step (Range)</label>
                          <input name="step" type="number" step="any" className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Max Length (Text)</label>
                          <input name="maxLength" type="number" className={inputCls} />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="caseSensitive" className="rounded text-indigo-600" />
                            <span className="text-sm text-slate-700">Case Sensitive (Huruf Besar/Kecil berpengaruh)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]">
                    <Plus className="h-5 w-5" />
                    Tambahkan Soal
                  </button>
                </div>
              </form>
            </div>
          </details>
        </div>


        {/* QUESTIONS LIST */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <CheckSquare className="h-5 w-5 text-slate-500" />
            <h3 className="text-lg font-bold text-slate-900">Daftar Soal</h3>
          </div>

          {questions.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
              <div className="rounded-full bg-indigo-50 p-4 mb-4">
                <FileText className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Belum ada soal</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-xs mx-auto">Mulai tambahkan soal pertama Anda menggunakan formulir di atas.</p>
            </div>
          )}

          <div className="grid gap-6">
            {questions.map((q) => (
              <div key={q.id} className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-200">
                <div className="absolute right-4 top-4 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <details className="relative">
                    <summary className="list-none">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-indigo-600 hover:border-indigo-200 cursor-pointer">
                        <Edit2 className="h-4 w-4" />
                      </div>
                    </summary>
                    {/* Edit Form Popup (Simplified for brevity, could be modal) */}
                    <div className="absolute right-0 z-20 mt-2 w-[600px] max-w-[90vw] rounded-xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-black/5">
                      <h4 className="font-bold text-slate-900 mb-4 border-b pb-2">Edit Soal #{q.order}</h4>
                      <form action={updateQuestion} className="space-y-4">
                        <input type="hidden" name="id" value={q.id} />
                        <input type="hidden" name="type" value={q.type} />

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-500">Urutan</label>
                            <input name="order" defaultValue={q.order} className={inputCls} />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-500">Poin</label>
                            <input name="points" type="number" defaultValue={q.points} className={inputCls} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500">Pertanyaan</label>
                          <textarea name="text" defaultValue={q.text} rows={3} className={inputCls} />
                        </div>

                        {/* Minimal field support for editing - fully supporting all fields in a small dropdown is hard, usually needs separate page or modal. Adding essentials here. */}
                        <div className="p-3 bg-amber-50 rounded border border-amber-100 text-xs text-amber-800">
                          <AlertCircle className="inline h-3 w-3 mr-1" />
                          Fitur edit cepat terbatas. Hapus dan buat ulang jika ingin mengubah Tipe Soal secara drastis.
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Simpan Perubahan</button>
                        </div>
                      </form>
                    </div>
                  </details>

                  <ConfirmDeleteForm action={deleteQuestion} id={q.id} confirmationMessage="Hapus soal ini?">
                    <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 shadow-sm hover:bg-red-50 hover:border-red-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </ConfirmDeleteForm>
                </div>

                <div className="flex items-start gap-4 pr-16">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-lg font-bold text-indigo-700">
                    {q.order}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {q.type.replace('_', ' ')}
                        </span>
                        {q.required && (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
                            Required
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {q.points} Poin
                        </span>
                      </div>
                      <p className="text-slate-900 font-medium whitespace-pre-wrap">{q.text}</p>
                    </div>

                    {q.imageUrl && (
                      <div className="relative h-40 w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={q.imageUrl} alt="Soal" className="h-full w-full object-contain" />
                      </div>
                    )}

                    {q.passage && (
                      <div className="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-1.5 text-xs text-indigo-700">
                        <FileText className="h-3 w-3" />
                        Referensi: {q.passage.title || 'Passage'}
                      </div>
                    )}

                    {/* Options View */}
                    {q.options.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.options.map(opt => (
                          <div key={opt.id} className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${opt.isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-white text-slate-600'}`}>
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold ${opt.isCorrect ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                              {opt.label}
                            </span>
                            <span>{opt.text}</span>
                            {opt.isCorrect && <CheckSquare className="ml-auto h-4 w-4 text-emerald-500" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Settings View for non-option types */}
                    {q.settings && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 font-mono border border-slate-200">
                        {JSON.stringify(q.settings).replace(/["{}]/g, '').replace(/,/g, ', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>
    </main>
  )
}
