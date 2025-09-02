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
  image: z.any().optional(), // akan dipersempit saat upload
  type: QuestionTypeEnum,
  points: z.coerce.number().int().min(0).default(1),
  required: BoolFromCheckbox.default(false),
})

// Tambahan field opsional per tipe (akan dipakai sesuai branch):
const OptionsSchema = z.object({
  A: z.string().min(1).optional(),
  B: z.string().min(1).optional(),
  C: z.string().min(1).optional(),
  D: z.string().min(1).optional(),
  correctLabel: z.enum(['A', 'B', 'C', 'D']).optional(),        // SINGLE_CHOICE
  // MULTI_SELECT: checkbox bernama "correctMulti"
})

const TrueFalseSchema = z.object({
  tfTrueText: z.string().min(1).default('Benar').optional(),
  tfFalseText: z.string().min(1).default('Salah').optional(),
  correctTF: z.enum(['TRUE', 'FALSE']).optional(),
})

const NumberSchema = z.object({
  tolerance: z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  targetNumber: z.union([z.literal(''), z.coerce.number()]).optional(), // NEW
})

const RangeSchema = z.object({
  min: z.union([z.literal(''), z.coerce.number()]).optional(),
  max: z.union([z.literal(''), z.coerce.number()]).optional(),
  step: z.union([z.literal(''), z.coerce.number().positive()]).optional(),
})

const ShortTextSchema = z.object({
  caseSensitive: BoolFromCheckbox.default(false).optional(),
  maxLength: z.union([z.literal(''), z.coerce.number().int().positive()]).optional(),
})

const CreateSchema = BaseQSchema
  .and(OptionsSchema)
  .and(TrueFalseSchema)
  .and(NumberSchema)
  .and(RangeSchema)
  .and(ShortTextSchema)

  const EditSchema = CreateSchema.and(z.object({ id: z.string().min(1) }))


// ===== Page component =====
export default async function EditPackagePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') redirect('/login')

  const pkg = await prisma.examPackage.findUnique({ where: { id: params.id } })
  if (!pkg) redirect('/admin/packages')

  async function uploadImage(pkgId: string, file: File | null | undefined) {
    'use server'
    if (!file || (file as any).size === 0) return undefined

    // Validasi ringan
    const size = (file as any).size as number
    const type = (file as any).type as string | undefined
    if (size > 5 * 1024 * 1024) throw new Error('Maksimal ukuran gambar 5MB')
    if (type && !/^image\/(png|jpe?g|webp|gif)$/.test(type)) {
      throw new Error('Format gambar tidak didukung')
    }

    const safeName = ((file as any).name ?? 'img').toString().replace(/[^\w.\-]+/g, '_')
    const fileName = `${pkgId}/${Date.now()}_${safeName}`

    const { data, error } = await supabaseAdmin
      .storage.from('exam-images')
      .upload(fileName, file as any, {
        upsert: false,
        contentType: type || 'application/octet-stream',
      })
    if (error) throw new Error('Upload gambar gagal: ' + error.message)
    const { data: pub } = supabaseAdmin.storage.from('exam-images').getPublicUrl(data.path)
    return pub.publicUrl
  }

  // ===== CREATE =====
  async function addQuestion(formData: FormData) {
    'use server'
    // Kumpulkan array checkbox untuk MULTI_SELECT
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
targetNumber: formData.get('targetNumber'), // NEW

      // range
      min: formData.get('min'),
      max: formData.get('max'),
      step: formData.get('step'),

      // short text
      caseSensitive: formData.get('caseSensitive'),
      maxLength: formData.get('maxLength'),
    }

    const parsed = CreateSchema.safeParse(raw)
    if (!parsed.success) throw new Error('Data soal tidak valid')

    const p = parsed.data
    const imageUrl = await uploadImage(params.id, p.image as File | null)

    // Siapkan payload per tipe
    type Opt = { label: string; text: string; isCorrect?: boolean }

    let type = p.type
    let options: Opt[] = []
    let settings: Record<string, any> | undefined = undefined

    if (type === 'SINGLE_CHOICE') {
      // Wajib A-D terisi dan 1 correct
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
      const target = p.targetNumber === '' || p.targetNumber === undefined ? undefined : Number(p.targetNumber) // NEW
      settings = { tolerance, target } // NEW
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

    // Simpan
    await prisma.question.create({
      data: {
        examPackageId: params.id,
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

    revalidatePath(`/admin/packages/${params.id}`)
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
targetNumber: formData.get('targetNumber'), // NEW

      min: formData.get('min'),
      max: formData.get('max'),
      step: formData.get('step'),

      caseSensitive: formData.get('caseSensitive'),
      maxLength: formData.get('maxLength'),
    }
    const parsed = EditSchema.safeParse(raw)
    if (!parsed.success) throw new Error('Data edit tidak valid')
    const p = parsed.data

    const q = await prisma.question.findUnique({
      where: { id: String(p.id) },
      include: { options: true }
    })
    if (!q) throw new Error('Soal tidak ditemukan')

    let imageUrl = q.imageUrl ?? undefined
    if (p.image && (p.image as any).size > 0) {
      imageUrl = await uploadImage(params.id, p.image as File)
    }

    // Hitung settings & options baru berdasarkan tipe
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
      settings: undefined as any,
    }

    if (type === 'SINGLE_CHOICE') {
      const labels: Array<'A'|'B'|'C'|'D'> = ['A','B','C','D']
      for (const L of labels) {
        const text = (p as any)[L]
        if (!text || String(text).trim() === '') throw new Error(`Opsi ${L} wajib diisi`)
      }
      if (!p.correctLabel) throw new Error('Pilih jawaban benar')
      const byLabel: Record<'A'|'B'|'C'|'D', string|undefined> = { A: undefined, B: undefined, C: undefined, D: undefined }
      q.options.forEach(o => {
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
      q.options.forEach(o => {
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

      // cari opsi existing (pakai label A/B)
      const optA = q.options.find(o => o.label === 'A')
      const optB = q.options.find(o => o.label === 'B')
      optionsPayload = [
        { id: optA?.id, label: 'A', text: tTrue,  isCorrect: p.correctTF === 'TRUE' },
        { id: optB?.id, label: 'B', text: tFalse, isCorrect: p.correctTF === 'FALSE' },
      ]
    }

    if (type === 'NUMBER') {
      const tolerance = p.tolerance === '' || p.tolerance === undefined ? undefined : Number(p.tolerance)
      const target = p.targetNumber === '' || p.targetNumber === undefined ? undefined : Number(p.targetNumber) // NEW
      settings = { tolerance, target } // NEW
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

    // Lakukan update question dulu
    await prisma.question.update({
      where: { id: q.id },
      data: { ...updateBase, settings },
    })

    // Kelola opsi:
    if (['SINGLE_CHOICE', 'MULTI_SELECT', 'TRUE_FALSE'].includes(type)) {
      const labelsToKeep = optionsPayload.map(o => o.label)
    
      await prisma.$transaction(async (tx) => {
        // Upsert tiap label (A/B/C/D atau A/B untuk True/False)
        for (const op of optionsPayload) {
          await tx.answerOption.upsert({
            where: { questionId_label: { questionId: q.id, label: op.label } },
            update: { text: op.text, isCorrect: !!op.isCorrect },
            create: { questionId: q.id, label: op.label, text: op.text, isCorrect: !!op.isCorrect },
          })
        }
    
        // Hapus opsi yang label-nya tidak dipakai lagi
        await tx.answerOption.deleteMany({
          where: {
            questionId: q.id,
            label: { notIn: labelsToKeep },
          },
        })
      })
    } else {
      // Tipe tanpa opsi → hapus semua opsi lama
      await prisma.answerOption.deleteMany({ where: { questionId: q.id } })
    }    

    revalidatePath(`/admin/packages/${params.id}`)
  }

  // ===== DELETE =====
  async function deleteQuestion(formData: FormData) {
    'use server'
    const id = String(formData.get('id') ?? '')
    if (!id) throw new Error('ID kosong')
    await prisma.question.delete({ where: { id } })
    revalidatePath(`/admin/packages/${params.id}`)
  }

  // ===== Fetch daftar soal =====
  const questions = await prisma.question.findMany({
    where: { examPackageId: params.id },
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-blue-700 tracking-tight">
            Kelola Soal — {pkg.title}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Tambah, edit, dan hapus soal untuk paket ini.
          </p>
        </div>

        {/* CREATE */}
        <form action={addQuestion} className="bg-white rounded-2xl shadow-lg border border-blue-100 p-5 grid gap-4" noValidate>
          <h2 className="text-lg font-semibold text-gray-900">Tambah Soal</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="order" className="block text-sm font-medium text-gray-800">Urutan (angka)</label>
              <input id="order" name="order" placeholder="mis. 1"
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="type" className="block text-sm font-medium text-gray-800">Tipe Soal</label>
              <select id="type" name="type"
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5">
                <option value="SINGLE_CHOICE">Single Choice</option>
                <option value="MULTI_SELECT">Multi Select</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="SHORT_TEXT">Short Text</option>
                <option value="ESSAY">Essay</option>
                <option value="NUMBER">Number</option>
                <option value="RANGE">Range</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="points" className="block text-sm font-medium text-gray-800">Poin</label>
              <input id="points" name="points" type="number" min={0} step={1} defaultValue={1}
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-800">Wajib diisi?</label>
              <input id="required" name="required" type="checkbox" className="mr-2" /> <label htmlFor="required">Required</label>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="image" className="block text-sm font-medium text-gray-800">Gambar (opsional)</label>
              <input id="image" name="image" type="file" accept="image/*"
                     className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="text" className="block text-sm font-medium text-gray-800">Teks soal</label>
              <textarea id="text" name="text" placeholder="Tuliskan pertanyaan di sini…"
                        className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" rows={3} />
            </div>

            {/* Bagian Opsi (A-D) */}
            <div className="sm:col-span-2">
              <div className="grid sm:grid-cols-2 gap-3">
                {(['A','B','C','D'] as const).map(L => (
                  <div key={L} className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-800">Opsi {L}</label>
                    <input name={L} placeholder={`Opsi ${L}`}
                      className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800">Jawaban benar (Single Choice)</label>
                  <select name="correctLabel"
                    className="w-40 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5">
                    <option value="">—</option>
                    <option value="A">A</option><option value="B">B</option>
                    <option value="C">C</option><option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800">Jawaban benar (Multi Select)</label>
                  <div className="flex gap-3">
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
            <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">Teks untuk TRUE</label>
                <input name="tfTrueText" defaultValue="Benar"
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">Teks untuk FALSE</label>
                <input name="tfFalseText" defaultValue="Salah"
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">Jawaban benar (True/False)</label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2"><input type="radio" name="correctTF" value="TRUE" /> TRUE</label>
                  <label className="inline-flex items-center gap-2"><input type="radio" name="correctTF" value="FALSE" /> FALSE</label>
                </div>
              </div>
            </div>

            {/* Number/Range/ShortText settings */}
            <div className="sm:col-span-2 grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">Tolerance (Number)</label>
                <input name="tolerance" type="number" step="any" placeholder="mis. 0.5"
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
              </div>
              <div className="space-y-1.5">
    <label className="block text-sm font-medium text-gray-800">Target (Number)</label>
    <input name="targetNumber" type="number" step="any" placeholder="mis. 42"
      className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
  </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">Min (Range)</label>
                <input name="min" type="number" step="any"
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">Max (Range)</label>
                <input name="max" type="number" step="any"
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">Step (Range)</label>
                <input name="step" type="number" step="any" placeholder="opsional"
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">Case sensitive (Short/Eessay)</label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" name="caseSensitive" /> Aktifkan
                </label>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">Max length (Short/Essay)</label>
                <input name="maxLength" type="number" step={1} min={1} placeholder="opsional"
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200">
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
                <li key={q.id} className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold">
                        {q.order}
                      </span>
                      <div className="font-semibold text-gray-900">Soal #{q.order}</div>
                      <span className="ml-2 inline-flex items-center rounded-full bg-violet-50 text-violet-700 text-xs px-2 py-0.5 border border-violet-200">
                      {q.type.replace(/_/g, ' ')}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5 border border-blue-200">
                        {q.points} poin {q.required ? '• wajib' : ''}
                      </span>
                    </div>
                    <form>
                      <input type="hidden" name="id" value={q.id} />
                      <button formAction={deleteQuestion} className="rounded-xl border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5">
                        Hapus
                      </button>
                    </form>
                  </div>

                  <div className="text-gray-800 leading-relaxed">{q.text}</div>

                  {q.imageUrl && (
                    <img src={q.imageUrl} alt="gambar soal" className="max-h-64 object-contain rounded-xl border border-gray-200" />
                  )}

                  {/* Opsi (kalau ada) */}
                  {q.options.length > 0 && (
                    <ul className="grid md:grid-cols-2 gap-2 text-sm">
                      {q.options.map((o) => (
                        <li
                          key={o.id}
                          className={`rounded-lg border px-3 py-2 ${correctIds.has(o.id) ? 'border-green-300 bg-green-50 font-semibold' : 'border-gray-200 bg-gray-50'}`}
                        >
                          {o.label}. {o.text}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Ringkasan settings */}
                  {q.settings && (
                    <div className="text-xs text-gray-600 mt-1">
                      <code className="bg-gray-100 px-2 py-1 rounded">{JSON.stringify(q.settings)}</code>
                    </div>
                  )}

                  {/* EDIT */}
                  <details className="mt-2 group">
                    <summary className="cursor-pointer select-none inline-flex items-center gap-2 text-sm font-medium text-blue-700">
                      ✏️ Edit soal ini
                    </summary>

                    <form action={updateQuestion} className="grid gap-3 mt-3 bg-gray-50 rounded-xl p-4 border border-gray-200" noValidate>
                      <input type="hidden" name="id" value={q.id} />

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Urutan</label>
                          <input name="order" defaultValue={q.order}
                                 className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Tipe Soal</label>
                          <select name="type" defaultValue={q.type}
                                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5">
                            <option value="SINGLE_CHOICE">Single Choice</option>
                            <option value="MULTI_SELECT">Multi Select</option>
                            <option value="TRUE_FALSE">True / False</option>
                            <option value="SHORT_TEXT">Short Text</option>
                            <option value="ESSAY">Essay</option>
                            <option value="NUMBER">Number</option>
                            <option value="RANGE">Range</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Poin</label>
                          <input name="points" type="number" min={0} step={1} defaultValue={q.points}
                                 className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Wajib diisi?</label>
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" name="required" defaultChecked={q.required} /> Required
                          </label>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Gambar (opsional)</label>
                          <input name="image" type="file" accept="image/*"
                                 className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white" />
                        </div>

                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Teks soal</label>
                          <textarea name="text" defaultValue={q.text}
                                    className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" rows={3} />
                        </div>

                        {/* Opsi A-D */}
                        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
                          {(['A','B','C','D'] as const).map(L => (
                            <div key={`edit-${q.id}-${L}`} className="space-y-1.5">
                              <label className="block text-sm font-medium text-gray-800">Opsi {L}</label>
                              <input name={L} defaultValue={q.options.find((o) => o.label === L)?.text ?? ''}
                                     className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                            </div>
                          ))}
                        </div>

                        {/* Correct single & multi */}
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Jawaban benar (Single Choice)</label>
                          <select name="correctLabel"
                                  defaultValue={q.options.find(o => o.isCorrect)?.label ?? ''}
                                  className="w-40 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5">
                            <option value="">—</option>
                            <option value="A">A</option><option value="B">B</option>
                            <option value="C">C</option><option value="D">D</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Jawaban benar (Multi Select)</label>
                          <div className="flex gap-3">
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
                        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Teks TRUE</label>
                            <input name="tfTrueText" defaultValue={q.options.find(o=>o.label==='A')?.text ?? 'Benar'}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Teks FALSE</label>
                            <input name="tfFalseText" defaultValue={q.options.find(o=>o.label==='B')?.text ?? 'Salah'}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Jawaban benar (True/False)</label>
                            <div className="flex gap-4">
                              <label className="inline-flex items-center gap-2">
                                <input type="radio" name="correctTF" value="TRUE"
                                  defaultChecked={q.options.find(o=>o.label==='A')?.isCorrect === true} /> TRUE
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input type="radio" name="correctTF" value="FALSE"
                                  defaultChecked={q.options.find(o=>o.label==='B')?.isCorrect === true} /> FALSE
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Number/Range/Short/Eessay settings */}
                        <div className="sm:col-span-2 grid sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Tolerance (Number)</label>
                            <input name="tolerance" type="number" step="any"
                                   defaultValue={q.settings?.tolerance ?? ''}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                          <div className="space-y-1.5">
    <label className="block text-sm font-medium text-gray-800">Target (Number)</label>
    <input name="targetNumber" type="number" step="any"
      defaultValue={q.settings?.target ?? ''}
      className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
  </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Min (Range)</label>
                            <input name="min" type="number" step="any"
                                   defaultValue={q.settings?.min ?? ''}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Max (Range)</label>
                            <input name="max" type="number" step="any"
                                   defaultValue={q.settings?.max ?? ''}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Step (Range)</label>
                            <input name="step" type="number" step="any"
                                   defaultValue={q.settings?.step ?? ''}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Case sensitive (Short/Essay)</label>
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" name="caseSensitive" defaultChecked={q.settings?.caseSensitive === true} /> Aktifkan
                            </label>
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Max length (Short/Essay)</label>
                            <input name="maxLength" type="number" step={1} min={1}
                                   defaultValue={q.settings?.maxLength ?? ''}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                        </div>
                      </div>

                      <div className="pt-1">
                        <button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200">
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
      </div>
    </div>
  )
}
