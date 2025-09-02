import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const CreateSchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 huruf'),
  description: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(2000).optional()
  ),
  token: z.string().trim().min(4, 'Token minimal 4 karakter'),
  timeLimitMin: z.union([
    z.literal('').transform(() => undefined),
    z.coerce.number().int().min(1, 'Batas menit minimal 1'),
  ]).optional(),
})

// NEW: schema untuk edit paket (token opsional; kosong = tidak mengubah)
const UpdateSchema = z.object({
  id: z.string().min(1, 'ID tidak valid'),
  title: z.string().trim().min(3, 'Judul minimal 3 huruf'),
  description: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(2000).optional()
  ),
  token: z.union([
    z.literal('').transform(() => undefined),                       // kosong = tidak ganti token
    z.string().trim().min(4, 'Token minimal 4 karakter'),
  ]).optional(),
  timeLimitMin: z.union([
    z.literal('').transform(() => undefined),
    z.coerce.number().int().min(1, 'Batas menit minimal 1'),
  ]).optional(),
})

export default async function AdminPackagesPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') redirect('/login')

  async function createPackage(formData: FormData) {
    'use server'
    const raw = Object.fromEntries(formData.entries())
    if ((raw as any).timeLimitMin === '') delete (raw as any).timeLimitMin

    const parsed = CreateSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => i.message).join(', ')
      throw new Error('Data tidak valid: ' + msg)
    }

    const { title, description, token, timeLimitMin } = parsed.data
    const bcrypt = (await import('bcryptjs')).default
    const tokenHash = await bcrypt.hash(token, 10)

    await prisma.examPackage.create({
      data: {
        title,
        description: description ?? null,
        tokenHash,
        timeLimitMin: timeLimitMin ?? null,
      },
    })
    revalidatePath('/admin/packages')
  }

  // NEW: edit paket
  async function updatePackage(formData: FormData) {
    'use server'
    const raw = Object.fromEntries(formData.entries())
    // normalisasi kosong -> undefined untuk timeLimitMin & token sudah di schema
    const parsed = UpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => i.message).join(', ')
      throw new Error('Data tidak valid: ' + msg)
    }

    const { id, title, description, token, timeLimitMin } = parsed.data

    // siapkan payload update dasar
    const data: any = {
      title,
      description: description ?? null,
      timeLimitMin: typeof timeLimitMin === 'number' ? timeLimitMin : null,
    }

    // jika token diisi, hash lalu update tokenHash
    if (typeof token === 'string' && token.length > 0) {
      const bcrypt = (await import('bcryptjs')).default
      data.tokenHash = await bcrypt.hash(token, 10)
    }

    await prisma.examPackage.update({ where: { id }, data })
    revalidatePath('/admin/packages')
  }

  async function toggleActive(formData: FormData) {
    'use server'
    const id = String(formData.get('id') ?? '')
    const to = String(formData.get('to') ?? 'false') === 'true'
    if (!id) throw new Error('ID paket kosong')
    await prisma.examPackage.update({ where: { id }, data: { isActive: to } })
    revalidatePath('/admin/packages')
  }

  const pkgs = await prisma.examPackage.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,              // UPDATED: untuk prefilling edit
      isActive: true,
      timeLimitMin: true,
      _count: { select: { questions: true, attempts: true } }
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-700 tracking-tight">
              Admin — Paket Soal
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Kelola paket ujian, token, dan batas waktu. ✨
            </p>
          </div>
        </div>

        {/* Create Card */}
        <form
          action={createPackage}
          className="bg-white rounded-2xl shadow-lg border border-blue-100 p-5 grid gap-4"
        >
          <h2 className="text-lg font-semibold text-gray-900">Buat Paket Baru</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="title" className="block text-sm font-medium text-gray-800">Judul paket</label>
              <input
                id="title"
                name="title"
                placeholder="Contoh: Matematika Kelas 6"
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black" // UPDATED: border-gray-300
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="timeLimitMin" className="block text-sm font-medium text-gray-800">Batas menit (opsional)</label>
              <input
                id="timeLimitMin" // NEW: id sesuai label
                name="timeLimitMin"
                type="number"
                min={1}
                step={1}
                placeholder="Batas menit (opsional)"
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black" // UPDATED
              />
              <p className="text-[12px] text-black">Biarkan kosong bila tanpa batas waktu.</p>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="description" className="block text-sm font-medium text-gray-800">Deskripsi (opsional)</label>
              <textarea
                id="description"
                name="description"
                placeholder="Keterangan singkat paket..."
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black" // UPDATED
                rows={3}
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="token" className="block text-sm font-medium text-gray-800">Token paket (plaintext)</label>
              <input
                id="token"
                name="token"
                placeholder="Contoh: ABCD1234"
                autoComplete="off"
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black" // UPDATED
                required
              />
              <p className="text-[12px] text-gray-500">Token akan otomatis di-hash ketika disimpan.</p>
            </div>
          </div>

          <div className="pt-2">
            <button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200">
              Simpan
            </button>
          </div>
        </form>

        {/* List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Daftar Paket</h2>

          <ul className="bg-white rounded-2xl shadow-lg border border-blue-100 divide-y">
            {pkgs.map((p) => (
              <li key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate text-black">{p.title}</div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs border
                      ${p.isActive
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {p.isActive ? 'Published' : 'Draft'}
                    </span>
                    {typeof p.timeLimitMin === 'number' && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5 border border-blue-200">
                        ⏱️ {p.timeLimitMin} mnt
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Soal: {p._count.questions} · Attempt: {p._count.attempts}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <a
                    href={`/admin/packages/${p.id}`}
                    className="inline-flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-3 py-2 border border-gray-200"
                  >
                    Kelola Soal
                  </a>
                    {/* NEW: Kelola Paket */}
  <a href={`/admin/packages/${p.id}/settings`}
     className="inline-flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-3 py-2 border border-gray-200">
    Kelola Paket
  </a>
                  <a
                    href={`/admin/packages/${p.id}/results`}
                    className="inline-flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-3 py-2 border border-gray-200"
                  >
                    Peserta & Nilai
                  </a>

                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="to" value={(!p.isActive).toString()} />
                    <button
                      className={`rounded-xl font-medium px-3 py-2 border
                        ${p.isActive
                          ? 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                          : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'}`}
                    >
                      {p.isActive ? 'Unpublish' : 'Publish'}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  )
}
