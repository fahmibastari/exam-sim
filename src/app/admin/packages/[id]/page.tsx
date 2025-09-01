import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const QSchema = z.object({
  order: z.coerce.number().int().positive(),
  text: z.string().min(3),
  image: z.any().optional(), // kita persempit saat upload
  A: z.string().min(1),
  B: z.string().min(1),
  C: z.string().min(1),
  D: z.string().min(1),
  correctLabel: z.enum(['A', 'B', 'C', 'D'])
})
const EditSchema = QSchema.extend({ id: z.string().min(1) })

export default async function EditPackagePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') redirect('/login')

  const pkg = await prisma.examPackage.findUnique({ where: { id: params.id } })
  if (!pkg) redirect('/admin/packages')

  async function uploadImage(pkgId: string, file: File | null | undefined) {
    'use server'
    if (!file || (file as any).size === 0) return undefined
    const fileName = `${pkgId}/${Date.now()}_${((file as any).name ?? 'img').toString()}`
    const { data, error } = await supabaseAdmin
      .storage.from('exam-images')
      .upload(fileName, file as any, { upsert: false })
    if (error) throw new Error('Upload gambar gagal: ' + error.message)
    const { data: pub } = supabaseAdmin.storage.from('exam-images').getPublicUrl(data.path)
    return pub.publicUrl
  }

  // CREATE
  async function addQuestion(formData: FormData) {
    'use server'
    const raw = {
      order: formData.get('order'),
      text: formData.get('text'),
      image: formData.get('image') as unknown as File | null,
      A: formData.get('A'),
      B: formData.get('B'),
      C: formData.get('C'),
      D: formData.get('D'),
      correctLabel: formData.get('correctLabel')
    }
    const parsed = QSchema.safeParse(raw)
    if (!parsed.success) throw new Error('Data soal tidak valid')

    const imageUrl = await uploadImage(params.id, parsed.data.image as File | null)

    const options = [
      { label: 'A', text: String(parsed.data.A) },
      { label: 'B', text: String(parsed.data.B) },
      { label: 'C', text: String(parsed.data.C) },
      { label: 'D', text: String(parsed.data.D) }
    ]

    const created = await prisma.question.create({
      data: {
        examPackageId: params.id,
        order: parsed.data.order,
        text: parsed.data.text,
        imageUrl,
        options: { create: options },
        correctOptionId: ''
      },
      include: { options: true }
    })

    const correct = created.options.find((o) => o.label === parsed.data.correctLabel)
    if (correct) {
      await prisma.question.update({ where: { id: created.id }, data: { correctOptionId: correct.id } })
    }
    revalidatePath(`/admin/packages/${params.id}`)
  }

  // UPDATE
  async function updateQuestion(formData: FormData) {
    'use server'
    const raw = {
      id: formData.get('id'),
      order: formData.get('order'),
      text: formData.get('text'),
      image: formData.get('image') as unknown as File | null,
      A: formData.get('A'),
      B: formData.get('B'),
      C: formData.get('C'),
      D: formData.get('D'),
      correctLabel: formData.get('correctLabel')
    }
    const parsed = EditSchema.safeParse(raw)
    if (!parsed.success) throw new Error('Data edit tidak valid')

    const q = await prisma.question.findUnique({
      where: { id: String(parsed.data.id) },
      include: { options: true }
    })
    if (!q) throw new Error('Soal tidak ditemukan')

    let imageUrl = q.imageUrl ?? undefined
    if (parsed.data.image && (parsed.data.image as any).size > 0) {
      imageUrl = await uploadImage(params.id, parsed.data.image as File)
    }

    await prisma.question.update({
      where: { id: q.id },
      data: { order: parsed.data.order, text: parsed.data.text, imageUrl }
    })

    // Update opsi by label
    const byLabel: Record<string, string> = {}
    q.options.forEach((o) => { byLabel[o.label] = o.id })

    await prisma.answerOption.update({ where: { id: byLabel['A'] }, data: { text: String(parsed.data.A) } })
    await prisma.answerOption.update({ where: { id: byLabel['B'] }, data: { text: String(parsed.data.B) } })
    await prisma.answerOption.update({ where: { id: byLabel['C'] }, data: { text: String(parsed.data.C) } })
    await prisma.answerOption.update({ where: { id: byLabel['D'] }, data: { text: String(parsed.data.D) } })

    const correctId = byLabel[String(parsed.data.correctLabel)]
    await prisma.question.update({ where: { id: q.id }, data: { correctOptionId: correctId } })

    revalidatePath(`/admin/packages/${params.id}`)
  }

  // DELETE
  async function deleteQuestion(formData: FormData) {
    'use server'
    const id = String(formData.get('id') ?? '')
    if (!id) throw new Error('ID kosong')
    await prisma.question.delete({ where: { id } })
    revalidatePath(`/admin/packages/${params.id}`)
  }

  // Ambil daftar soal
  const questions: Array<{
    id: string
    order: number
    text: string
    imageUrl: string | null
    correctOptionId: string
    options: Array<{ id: string; label: string; text: string }>
  }> = await prisma.question.findMany({
    where: { examPackageId: params.id },
    include: { options: true },
    orderBy: { order: 'asc' }
  })

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
              <input id="order" name="order" placeholder="mis. 1" className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="image" className="block text-sm font-medium text-gray-800">Gambar (opsional)</label>
              <input id="image" name="image" type="file" accept="image/*"
                     className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="text" className="block text-sm font-medium text-gray-800">Teks soal</label>
              <textarea id="text" name="text" placeholder="Tuliskan pertanyaan di sini…"
                        className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" rows={3} />
            </div>

            <div className="sm:col-span-2">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="optA" className="block text-sm font-medium text-gray-800">Opsi A</label>
                  <input id="optA" name="A" placeholder="Opsi A"
                         className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="optB" className="block text-sm font-medium text-gray-800">Opsi B</label>
                  <input id="optB" name="B" placeholder="Opsi B"
                         className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="optC" className="block text-sm font-medium text-gray-800">Opsi C</label>
                  <input id="optC" name="C" placeholder="Opsi C"
                         className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="optD" className="block text-sm font-medium text-gray-800">Opsi D</label>
                  <input id="optD" name="D" placeholder="Opsi D"
                         className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="correctLabel" className="block text-sm font-medium text-gray-800">Jawaban benar</label>
              <select id="correctLabel" name="correctLabel"
                      className="w-40 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
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
              const currentCorrectLabel = q.options.find((o) => o.id === q.correctOptionId)?.label ?? 'A'
              return (
                <li key={q.id} className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold">
                        {q.order}
                      </span>
                      <div className="font-semibold text-gray-900">Soal #{q.order}</div>
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

                  <ul className="grid md:grid-cols-2 gap-2 text-sm">
                    {q.options.map((o) => (
                      <li
                        key={o.id}
                        className={`rounded-lg border px-3 py-2 ${o.id === q.correctOptionId ? 'border-green-300 bg-green-50 font-semibold' : 'border-gray-200 bg-gray-50'}`}
                      >
                        {o.label}. {o.text}
                      </li>
                    ))}
                  </ul>

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
                          <label className="block text-sm font-medium text-gray-800">Gambar (opsional)</label>
                          <input name="image" type="file" accept="image/*"
                                 className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white" />
                        </div>

                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Teks soal</label>
                          <textarea name="text" defaultValue={q.text}
                                    className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" rows={3} />
                        </div>

                        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Opsi A</label>
                            <input name="A" defaultValue={q.options.find((o) => o.label === 'A')?.text ?? ''}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Opsi B</label>
                            <input name="B" defaultValue={q.options.find((o) => o.label === 'B')?.text ?? ''}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Opsi C</label>
                            <input name="C" defaultValue={q.options.find((o) => o.label === 'C')?.text ?? ''}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-800">Opsi D</label>
                            <input name="D" defaultValue={q.options.find((o) => o.label === 'D')?.text ?? ''}
                                   className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-gray-800">Jawaban benar</label>
                          <select name="correctLabel" defaultValue={currentCorrectLabel}
                                  className="w-40 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5">
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                          </select>
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
