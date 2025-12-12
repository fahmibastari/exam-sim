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
import { ArrowLeft, Plus, Image as ImageIcon, Trash2, Edit2, GripVertical, FileText, CheckSquare, Save, X, ChevronDown, ChevronRight, LayoutList, AlertCircle, ListChecks, ToggleLeft, Type, AlignLeft, Hash, SlidersHorizontal } from 'lucide-react'
import ConfirmDeleteForm from '@/app/admin/_components/ConfirmDeleteForm'
import QuestionFilter from '@/app/admin/_components/QuestionFilter'
import ClientActionForm from '@/app/admin/_components/ClientActionForm'
import DynamicQuestionForm from '@/app/admin/_components/DynamicQuestionForm'

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
  props: { params: Promise<{ id: string }>, searchParams: Promise<{ q?: string; type?: string }> }
) {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const query = searchParams.q?.toLowerCase() || ''
  const typeFilter = searchParams.type || ''
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
    if (!parsed.success) {
      return { error: 'Data soal tidak valid. Pastikan semua field wajib terisi.' }
    }

    const p = parsed.data
    let imageUrl, audioUrl
    try {
      imageUrl = await uploadImage(id, parsed.data.image as File | null)
      audioUrl = await uploadAudio(id, raw.audio)
    } catch (e: any) {
      return { error: e.message }
    }



    try {
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
    } catch (e: any) {
      console.error(e)
      return { error: 'Gagal membuat soal: ' + e.message }
    }

    revalidatePath(`/admin/packages/${id}`)
    return { success: true }
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
      include: {
        options: true,
        _count: { select: { answers: true } } // Cek apakah sudah ada yang jawab
      }
    })
    if (!q) throw new Error('Soal tidak ditemukan')

    // 🛡️ PROTEKSI: Jangan izinkan ganti Tipe jika sudah ada attempt (jawaban)
    // Karena ganti tipe akan menghapus opsi lama (cascade/manual delete) dan bikin jawaban siswa jadi invalid
    if (q.type !== p.type && q._count.answers > 0) {
      throw new Error(
        `Tidak bisa mengubah Tipe Soal karena sudah ada ${q._count.answers} jawaban siswa yang tersimpan. Hapus jawaban siswa dulu atau buat soal baru.`
      )
    }

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
    passageId: string | null // FIX: Added to resolve TS Error
    passage: { id: string; title: string | null } | null // NEW
    options: Array<{ id: string; label: string; text: string; isCorrect: boolean }>
  }>

  // Filter questions if query exists
  // We filter effectively here:
  const filteredQuestions = questions.filter(q => {
    const matchText = query ? q.text.toLowerCase().includes(query) : true
    const matchType = typeFilter ? q.type === typeFilter : true
    return matchText && matchType
  })

  // Use filteredQuestions for the UI rendering to sections
  const questionsToRender = filteredQuestions



  // UI helpers
  // UI helpers
  const inputCls =
    'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'
  const fileCls =
    'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-4 file:py-2.5 file:text-white file:font-semibold hover:file:bg-indigo-700'
  const cardCls = 'rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800'

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
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
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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

        {/* === FILTER & SEARCH === */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <QuestionFilter initialQuery={query} initialType={typeFilter} />

          <details className="relative z-10">
            <summary className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 cursor-pointer list-none">
              <Plus className="h-4 w-4" /> Tambah Section / Passage
            </summary>
            <div className="absolute right-0 mt-2 w-[500px] max-w-[90vw] p-5 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-white dark:bg-slate-900 shadow-xl">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3 block">Buat Section Baru</h3>
              <ClientActionForm action={createPassage} className="space-y-4" successMessage="Section berhasil dibuat">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Judul Section</label>
                  <input name="title" placeholder="e.g. Reading Section 1" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Urutan</label>
                  <input name="order" type="number" placeholder="1" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Konten Teks</label>
                  <textarea name="content" rows={4} className={inputCls} placeholder="Isi bacaan..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Audio (Opsional)</label>
                  <input type="file" name="audio" className={fileCls} />
                </div>
                <button className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-700">Simpan Section</button>
              </ClientActionForm>
            </div>
          </details>
        </div>

        {/* === SECTIONS RENDERER === */}
        <div className="space-y-12">
          {/* 1. Map Passages (Sections) */}
          {passages.map((p) => {
            // Use filteredQuestions here to respect search
            const sectionQuestions = filteredQuestions.filter(q => q.passageId === p.id)

            // If searching and no questions match in this section, and section title doesn't match query, maybe hide?
            // For now, let's always show sections to allow adding questions, unless query is strict.
            // But simpler is to just render.

            return (
              <section key={p.id} className="rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-indigo-50/50 dark:ring-indigo-900/10 overflow-hidden">
                {/* Section Header */}
                <div className="border-b border-indigo-50 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                      {/* @ts-ignore */}
                      {p.audioUrl ? <div className="font-bold text-xs">MP3</div> : <FileText className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{p.title || 'Untitled Section'}</h3>
                        {/* @ts-ignore */}
                        <span className="rounded bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">#{p.order}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{sectionQuestions.length} Soal</span>
                        {/* @ts-ignore */}
                        {(p as any).audioUrl && <span className="flex items-center gap-1 text-emerald-600 font-medium"><div className="h-2 w-2 rounded-full bg-emerald-500" /> Audio Enabled</span>}
                      </div>
                    </div>
                  </div>

                  {/* Section Actions */}
                  <div className="flex gap-2">
                    <details className="relative">
                      <summary className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer list-none shadow-sm">
                        <Edit2 className="h-3 w-3" /> Edit Section
                      </summary>
                      {/* Edit Passage Form Overlay */}
                      <div className="absolute right-0 top-full z-20 mt-2 w-[400px] max-w-[85vw] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xl">
                        <h4 className="font-bold mb-3 text-slate-900 dark:text-white">Edit Section</h4>
                        <ClientActionForm action={updatePassage} className="space-y-3" successMessage="Section updated">
                          <input type="hidden" name="id" value={p.id} />
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Judul</label><input name="title" defaultValue={p.title ?? ''} className={inputCls} /></div>
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Urutan</label><input name="order" type="number" defaultValue={(p as any).order ?? 0} className={inputCls} /></div>
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Konten</label><textarea name="content" defaultValue={(p as any).content} rows={3} className={inputCls} /></div>
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Update Audio</label><input type="file" name="audio" className={fileCls} /></div>
                          <div className="pt-2"><button className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white">Simpan Perubahan</button></div>
                        </ClientActionForm>
                      </div>
                    </details>
                    <ConfirmDeleteForm action={deletePassage} id={p.id} confirmationMessage="Hapus section ini? Soal di dalamnya akan menjadi orphaned (tanpa section).">
                      <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/20 px-3 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 shadow-sm">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </ConfirmDeleteForm>
                  </div>
                </div>

                {/* Section Content Preview */}
                <div className="bg-slate-50/50 dark:bg-slate-900/50 p-5 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                  <details className="group">
                    <summary className="cursor-pointer font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 inline-flex items-center gap-1">Lihat Konten Passage <ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" /></summary>
                    <div className="mt-3 bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 font-serif leading-relaxed whitespace-pre-wrap">{(p as any).content}</div>
                    {/* @ts-ignore */}
                    {(p as any).audioUrl && <div className="mt-3"><audio controls src={(p as any).audioUrl} className="w-full h-8" /></div>}
                  </details>
                </div>

                {/* Questions in this Section */}
                <div className="p-5 bg-slate-50/30 dark:bg-slate-950/30">
                  <div className="space-y-4">
                    {sectionQuestions.map(q => (
                      <div key={q.id} className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all">
                        {/* Question Item Render (Simplified Reuse) */}
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-400 text-sm">{q.order}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{q.type}</span>
                              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{q.points} Poin</span>
                            </div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">{q.text}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Just Edit/Delete Buttons for Question */}
                            <details className="relative">
                              <summary className="list-none inline-flex p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 cursor-pointer"><Edit2 className="h-4 w-4" /></summary>
                              <div className="absolute right-0 z-10 mt-2 w-[400px] bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800">
                                <h4 className="font-bold mb-4 text-slate-900 dark:text-white">Edit Soal {q.order}</h4>
                                <ClientActionForm action={updateQuestion} className="space-y-3" successMessage="Soal updated">
                                  <input type="hidden" name="id" value={q.id} />
                                  <input type="hidden" name="type" value={q.type} />
                                  <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Urutan</label><input name="order" defaultValue={q.order} className={inputCls} /></div>
                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Poin</label><input name="points" defaultValue={q.points} className={inputCls} /></div>
                                  </div>
                                  <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Pertanyaan</label><textarea name="text" defaultValue={q.text} rows={2} className={inputCls} /></div>
                                  <div className="flex justify-end pt-2"><button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white text-xs font-bold">Simpan</button></div>
                                </ClientActionForm>
                              </div>
                            </details>
                            <ConfirmDeleteForm action={deleteQuestion} id={q.id} confirmationMessage="Hapus soal ini?"><button className="inline-flex p-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40"><Trash2 className="h-4 w-4" /></button></ConfirmDeleteForm>
                          </div>
                        </div>
                      </div>
                    ))}
                    {sectionQuestions.length === 0 && <div className="text-center py-6 text-sm text-slate-400 italic">Belum ada soal di section ini.</div>}
                  </div>

                  {/* Add Question to Section Button */}
                  <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                    <details className="group add-q">
                      <summary className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 font-semibold text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer list-none transition-colors">
                        <Plus className="h-4 w-4" /> Tambah Soal di Section ini
                      </summary>
                      <div className="mt-4 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900 shadow-lg p-6">
                        {/* REUSE CREATE FORM BUT PRESET passageId */}
                        <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-4 border-b dark:border-slate-800 pb-2">Tambah Soal ke: {p.title}</h4>
                        <DynamicQuestionForm
                          action={addQuestion}
                          passageId={p.id}
                          successMessage="Soal berhasil ditambahkan"
                        />
                      </div>
                    </details>
                  </div>
                </div>
              </section>
            )
          })}

          {/* 2. Orphaned Questions */}
          {filteredQuestions.filter(q => !q.passageId).length > 0 && (
            <section className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-6">
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-lg mb-4 flex items-center gap-2"><LayoutList className="h-5 w-5" /> Soal Tanpa Section</h3>
              <div className="grid gap-4">
                {filteredQuestions.filter(q => !q.passageId).map(q => (
                  <div key={q.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-4">
                    <div className="font-bold text-slate-500 dark:text-slate-400">#{q.order}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{q.text}</p>
                      <div className="mt-2 flex gap-2">
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400">{q.type}</span>
                      </div>
                    </div>
                    <ConfirmDeleteForm action={deleteQuestion} id={q.id} confirmationMessage="Hapus soal?">
                      <button className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-2 rounded"><Trash2 className="h-4 w-4" /></button>
                    </ConfirmDeleteForm>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                {/* Add Standalone Question Button logic similar to above but passageId=null */}
                <details className="group">
                  <summary className="inline-flex items-center gap-2 rounded-lg bg-slate-200 dark:bg-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer list-none">
                    <Plus className="h-4 w-4" /> Tambah Soal Standalone
                  </summary>
                  <div className="mt-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-300 dark:border-slate-700 shadow-lg">
                    <DynamicQuestionForm
                      action={addQuestion}
                      passageId=""
                      successMessage="Soal standalone berhasil ditambahkan"
                    />
                  </div>
                </details>
              </div>
            </section>
          )}
        </div>

      </section>
    </main>
  )
}
