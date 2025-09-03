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

const QuestionTypeEnum = z.enum([
  'SINGLE_CHOICE',
  'MULTI_SELECT',
  'TRUE_FALSE',
  'SHORT_TEXT',
  'ESSAY',
  'NUMBER',
  'RANGE',
])

const BaseQSchema = z.object({
  order: z.coerce.number().int().positive(),
  text: z.string().min(3),
  image: z.any().optional(),
  type: QuestionTypeEnum,
  points: z.coerce.number().int().min(0).default(1),
  required: BoolFromCheckbox.default(false),
})

// ====== preprocess agar null -> '' untuk field opsional ======
const toEmpty = (v: unknown) => (v === null || v === undefined ? '' : v)

// string opsional tapi kalau ada harus non-empty
const OptionalNonEmpty = z.preprocess(
  toEmpty,
  z.union([z.literal(''), z.string().min(1)])
)

// enum atau empty string
const EnumOrEmpty = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(toEmpty, z.union([z.literal(''), z.enum(values as any)]))

// number helpers (menerima '' juga)
const NumOrEmpty = z.preprocess(
  toEmpty,
  z.union([z.literal(''), z.coerce.number()])
)
const NumMin0OrEmpty = z.preprocess(
  toEmpty,
  z.union([z.literal(''), z.coerce.number().min(0)])
)
const IntPosOrEmpty = z.preprocess(
  toEmpty,
  z.union([z.literal(''), z.coerce.number().int().positive()])
)

// Tambahan field opsional per tipe
const OptionsSchema = z.object({
  A: OptionalNonEmpty.optional(),
  B: OptionalNonEmpty.optional(),
  C: OptionalNonEmpty.optional(),
  D: OptionalNonEmpty.optional(),
  correctLabel: EnumOrEmpty(['A', 'B', 'C', 'D'] as const).optional(),
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
  .and(OptionsSchema)
  .and(TrueFalseSchema)
  .and(NumberSchema)
  .and(RangeSchema)
  .and(ShortTextSchema)

const EditSchema = CreateSchema.and(z.object({ id: z.string().min(1) }))

// tipe opsi, biar rapi
type OptionRow = { id: string; label: 'A'|'B'|'C'|'D'; text: string; isCorrect: boolean }

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
    const correctMulti = formData.getAll('correctMulti').map(String) as Array<'A'|'B'|'C'|'D'>

    const raw = {
      order: formData.get('order'),
      text: formData.get('text'),
      image: formData.get('image') as unknown as File | null,
      type: formData.get('type'),
      points: formData.get('points'),
      required: formData.get('required'),

      // opsi
      A: formData.get('A'),
      B: formData.get('B'),
      C: formData.get('C'),
      D: formData.get('D'),
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

    type Opt = { label: string; text: string; isCorrect?: boolean }

    const type = p.type
    let options: Opt[] = []
    let settings: Record<string, any> | undefined = undefined

    if (type === 'SINGLE_CHOICE') {
      const labels: Array<'A'|'B'|'C'|'D'> = ['A','B','C','D']
      for (const L of labels) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') {
          throw new Error(`Opsi ${L} wajib diisi untuk tipe Single Choice`)
        }
      }
      if (!p.correctLabel) throw new Error('Pilih jawaban benar (Single Choice)')
      options = [
        { label: 'A', text: String(p.A), isCorrect: p.correctLabel === 'A' },
        { label: 'B', text: String(p.B), isCorrect: p.correctLabel === 'B' },
        { label: 'C', text: String(p.C), isCorrect: p.correctLabel === 'C' },
        { label: 'D', text: String(p.D), isCorrect: p.correctLabel === 'D' },
      ]
    }

    if (type === 'MULTI_SELECT') {
      const labels: Array<'A'|'B'|'C'|'D'> = ['A','B','C','D']
      for (const L of labels) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') {
          throw new Error(`Opsi ${L} wajib diisi untuk tipe Multi Select`)
        }
      }
      if (correctMulti.length === 0) throw new Error('Pilih minimal satu jawaban benar (Multi Select)')
      options = [
        { label: 'A', text: String(p.A), isCorrect: correctMulti.includes('A') },
        { label: 'B', text: String(p.B), isCorrect: correctMulti.includes('B') },
        { label: 'C', text: String(p.C), isCorrect: correctMulti.includes('C') },
        { label: 'D', text: String(p.D), isCorrect: correctMulti.includes('D') },
      ]
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
        order: p.order,
        text: p.text,
        imageUrl,
        type,
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
    const correctMulti = formData.getAll('correctMulti').map(String) as Array<'A'|'B'|'C'|'D'>

    const raw = {
      id: formData.get('id'),
      order: formData.get('order'),
      text: formData.get('text'),
      image: formData.get('image') as unknown as File | null,
      type: formData.get('type'),
      points: formData.get('points'),
      required: formData.get('required'),

      A: formData.get('A'),
      B: formData.get('B'),
      C: formData.get('C'),
      D: formData.get('D'),
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

    let imageUrl = q.imageUrl ?? undefined
    if (p.image && (p.image as any).size > 0) {
      imageUrl = await uploadImage(id, p.image as File)
    }

    let optionsPayload: Array<{ id?: string; label: string; text: string; isCorrect?: boolean }> = []
    let settings: Record<string, any> | undefined = undefined
    const type = p.type

    const updateBase = {
      order: p.order,
      text: p.text,
      imageUrl,
      type,
      points: p.points ?? 1,
      required: p.required ?? false,
    }

    if (type === 'SINGLE_CHOICE') {
      const labels: Array<'A'|'B'|'C'|'D'> = ['A','B','C','D']
      for (const L of labels) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') throw new Error(`Opsi ${L} wajib diisi`)
      }
      if (!p.correctLabel) throw new Error('Pilih jawaban benar')
      const byLabel: Record<'A'|'B'|'C'|'D', string|undefined> = { A: undefined, B: undefined, C: undefined, D: undefined }
      q.options.forEach((o: OptionRow) => {
        if (['A','B','C','D'].includes(o.label)) (byLabel as any)[o.label] = o.id
      })
      optionsPayload = [
        { id: byLabel.A, label: 'A', text: String(p.A), isCorrect: p.correctLabel === 'A' },
        { id: byLabel.B, label: 'B', text: String(p.B), isCorrect: p.correctLabel === 'B' },
        { id: byLabel.C, label: 'C', text: String(p.C), isCorrect: p.correctLabel === 'C' },
        { id: byLabel.D, label: 'D', text: String(p.D), isCorrect: p.correctLabel === 'D' },
      ]
    }

    if (type === 'MULTI_SELECT') {
      const labels: Array<'A'|'B'|'C'|'D'> = ['A','B','C','D']
      for (const L of labels) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') throw new Error(`Opsi ${L} wajib diisi`)
      }
      const byLabel: Record<'A'|'B'|'C'|'D', string|undefined> = { A: undefined, B: undefined, C: undefined, D: undefined }
      q.options.forEach((o: OptionRow) => {
        if (['A','B','C','D'].includes(o.label)) (byLabel as any)[o.label] = o.id
      })
      optionsPayload = [
        { id: byLabel.A, label: 'A', text: String(p.A), isCorrect: correctMulti.includes('A') },
        { id: byLabel.B, label: 'B', text: String(p.B), isCorrect: correctMulti.includes('B') },
        { id: byLabel.C, label: 'C', text: String(p.C), isCorrect: correctMulti.includes('C') },
        { id: byLabel.D, label: 'D', text: String(p.D), isCorrect: correctMulti.includes('D') },
      ]
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

  // ===== Fetch daftar soal =====
  const questions = await prisma.question.findMany({
    where: { examPackageId: id },
    include: { options: true },
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
        

        {/* CREATE */}
        <form action={addQuestion} className={cardCls} noValidate>
          <h2 className="text-lg font-semibold text-gray-900">Tambah Soal</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="order" className="mb-1 block text-sm font-medium text-gray-800">Urutan (angka)</label>
              <input id="order" name="order" placeholder="mis. 1" className={inputCls} />
            </div>

            <div>
              <label htmlFor="type" className="mb-1 block text-sm font-medium text-gray-800">Tipe Soal</label>
              <select id="type" name="type" className={inputCls}>
                <option value="SINGLE_CHOICE">Single Choice</option>
                <option value="MULTI_SELECT">Multi Select</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="SHORT_TEXT">Short Text</option>
                <option value="ESSAY">Essay</option>
                <option value="NUMBER">Number</option>
                <option value="RANGE">Range</option>
              </select>
            </div>

            <div>
              <label htmlFor="points" className="mb-1 block text-sm font-medium text-gray-800">Poin</label>
              <input id="points" name="points" type="number" min={0} step={1} defaultValue={1} className={inputCls} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">Wajib diisi?</label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                <input id="required" name="required" type="checkbox" /> Required
              </label>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="image" className="mb-1 block text-sm font-medium text-gray-800">Gambar (opsional)</label>
              <input id="image" name="image" type="file" accept="image/*" className={fileCls} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="text" className="mb-1 block text-sm font-medium text-gray-800">Teks soal</label>
              <textarea id="text" name="text" placeholder="Tuliskan pertanyaan di sini…" rows={3} className={inputCls} />
            </div>

            {/* Bagian Opsi (A-D) */}
            <div className="sm:col-span-2">
              <div className="grid gap-3 sm:grid-cols-2">
                {(['A','B','C','D'] as const).map(L => (
                  <div key={L}>
                    <label className="mb-1 block text-sm font-medium text-gray-800">Opsi {L}</label>
                    <input name={L} placeholder={`Opsi ${L}`} className={inputCls} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (Single Choice)</label>
                  <select name="correctLabel" className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="">—</option>
                    <option value="A">A</option><option value="B">B</option>
                    <option value="C">C</option><option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (Multi Select)</label>
                  <div className="flex gap-4 text-sm">
                    {(['A','B','C','D'] as const).map(L => (
                      <label key={`cm-${L}`} className="inline-flex items-center gap-2">
                        <input type="checkbox" name="correctMulti" value={L} /> {L}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* True/False */}
            <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Teks untuk TRUE</label>
                <input name="tfTrueText" defaultValue="Benar" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Teks untuk FALSE</label>
                <input name="tfFalseText" defaultValue="Salah" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (True/False)</label>
                <div className="flex gap-6 text-sm">
                  <label className="inline-flex items-center gap-2"><input type="radio" name="correctTF" value="TRUE" /> TRUE</label>
                  <label className="inline-flex items-center gap-2"><input type="radio" name="correctTF" value="FALSE" /> FALSE</label>
                </div>
              </div>
            </div>

            {/* Number/Range/ShortText settings */}
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Tolerance (Number)</label>
                <input name="tolerance" type="number" step="any" placeholder="mis. 0.5" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Target (Number)</label>
                <input name="targetNumber" type="number" step="any" placeholder="mis. 42" className={inputCls} />
              </div>
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
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Case sensitive (Short/Essay)</label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" name="caseSensitive" /> Aktifkan
                </label>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Max length (Short/Essay)</label>
                <input name="maxLength" type="number" step={1} min={1} placeholder="opsional" className={inputCls} />
              </div>
            </div>
          </div>

          <div className="pt-3">
            <button className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              Simpan Soal
            </button>
          </div>
        </form>

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
                    <summary className="inline-flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-blue-700">
                      Edit soal ini
                    </summary>

                    <form action={updateQuestion} className="mt-3 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4" noValidate>
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
                          <label className="mb-1 block text-sm font-medium text-gray-800">Teks soal</label>
                          <textarea name="text" defaultValue={q.text} rows={3} className={inputCls} />
                        </div>

                        {/* Opsi A-D */}
                        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                          {(['A','B','C','D'] as const).map(L => (
                            <div key={`edit-${q.id}-${L}`}>
                              <label className="mb-1 block text-sm font-medium text-gray-800">Opsi {L}</label>
                              <input
                                name={L}
                                defaultValue={q.options.find((o) => o.label === L)?.text ?? ''}
                                className={inputCls}
                              />
                            </div>
                          ))}
                        </div>

                        {/* Correct single & multi */}
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (Single Choice)</label>
                          <select
                            name="correctLabel"
                            defaultValue={q.options.find(o => o.isCorrect)?.label ?? ''}
                            className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          >
                            <option value="">—</option>
                            <option value="A">A</option><option value="B">B</option>
                            <option value="C">C</option><option value="D">D</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-800">Jawaban benar (Multi Select)</label>
                          <div className="flex gap-4 text-sm">
                            {(['A','B','C','D'] as const).map(L => {
                              const isC = q.options.find(o => o.label === L)?.isCorrect ?? false
                              return (
                                <label key={`edit-cm-${q.id}-${L}`} className="inline-flex items-center gap-2">
                                  <input type="checkbox" name="correctMulti" value={L} defaultChecked={isC} /> {L}
                                </label>
                              )
                            })}
                          </div>
                        </div>

                        {/* True/False */}
                        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
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
                          <div>
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

                        {/* Number/Range/Short/Essay settings */}
                        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-800">Tolerance (Number)</label>
                            <input name="tolerance" type="number" step="any" defaultValue={q.settings?.tolerance ?? ''} className={inputCls} />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-800">Target (Number)</label>
                            <input name="targetNumber" type="number" step="any" defaultValue={q.settings?.target ?? ''} className={inputCls} />
                          </div>
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
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-800">Case sensitive (Short/Essay)</label>
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input type="checkbox" name="caseSensitive" defaultChecked={q.settings?.caseSensitive === true} /> Aktifkan
                            </label>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-800">Max length (Short/Essay)</label>
                            <input name="maxLength" type="number" step={1} min={1} defaultValue={q.settings?.maxLength ?? ''} className={inputCls} />
                          </div>
                        </div>
                      </div>

                      <div className="pt-1">
                        <button className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          Simpan Perubahan
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-center md:flex-row md:text-left">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Simulasi Ujian — Platform simulasi ujian untuk siswa.
          </p>
          <p className="text-xs text-gray-500">
            Dibuat oleh <span className="font-medium text-gray-700">fahmibastari</span> &{' '}
            <span className="font-medium text-gray-700">qorrieaina</span>.
          </p>
        </div>
      </footer>
    </main>
  )
}
