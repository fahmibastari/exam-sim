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

// Schema edit paket (token opsional; kosong = tidak mengubah)
const UpdateSchema = z.object({
  id: z.string().min(1, 'ID tidak valid'),
  title: z.string().trim().min(3, 'Judul minimal 3 huruf'),
  description: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(2000).optional()
  ),
  token: z.union([
    z.literal('').transform(() => undefined), // kosong = tidak ganti token
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

  // ===== Actions =====
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

  async function updatePackage(formData: FormData) {
    'use server'
    const raw = Object.fromEntries(formData.entries())
    const parsed = UpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => i.message).join(', ')
      throw new Error('Data tidak valid: ' + msg)
    }

    const { id, title, description, token, timeLimitMin } = parsed.data
    const data: any = {
      title,
      description: description ?? null,
      timeLimitMin: typeof timeLimitMin === 'number' ? timeLimitMin : null,
    }

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
      description: true,
      isActive: true,
      timeLimitMin: true,
      _count: { select: { questions: true, attempts: true } },
    },
  })

  // ===== UI helpers =====
  const inputCls =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'
  const cardCls = 'rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200'

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Top Nav */}
      

      <section className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admin — Paket Soal</h1>
            <p className="mt-1 text-sm text-gray-600">
              Kelola paket ujian, token, dan batas waktu.
            </p>
          </div>
        </div>

        {/* Create Card */}
        <form action={createPackage} className={cardCls}>
          <h2 className="text-lg font-semibold text-gray-900">Buat Paket Baru</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-800">
                Judul paket
              </label>
              <input
                id="title"
                name="title"
                placeholder="Contoh: Matematika Kelas 6"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="timeLimitMin" className="mb-1 block text-sm font-medium text-gray-800">
                Batas menit (opsional)
              </label>
              <input
                id="timeLimitMin"
                name="timeLimitMin"
                type="number"
                min={1}
                step={1}
                placeholder="Biarkan kosong bila tanpa batas"
                className={inputCls}
              />
              <p className="mt-1 text-[12px] text-gray-500">Kosongkan untuk tanpa batas waktu.</p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-800">
                Deskripsi (opsional)
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="Keterangan singkat paket..."
                rows={3}
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="token" className="mb-1 block text-sm font-medium text-gray-800">
                Token paket (plaintext)
              </label>
              <input
                id="token"
                name="token"
                placeholder="Contoh: ABCD1234"
                autoComplete="off"
                className={inputCls}
                required
              />
              <p className="mt-1 text-[12px] text-gray-500">Token akan otomatis di-hash ketika disimpan.</p>
            </div>
          </div>

          <div className="pt-3">
            <button
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Simpan
            </button>
          </div>
        </form>

        {/* List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Daftar Paket</h2>

          <ul className="divide-y rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
            {pkgs.map((p: typeof pkgs[number]) => (
              <li key={p.id} className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-semibold text-gray-900">{p.title}</div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${
                        p.isActive
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700'
                      }`}
                    >
                      {p.isActive ? 'Published' : 'Draft'}
                    </span>
                    {typeof p.timeLimitMin === 'number' && (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {p.timeLimitMin} mnt
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    Soal: {p._count.questions} · Attempt: {p._count.attempts}
                  </div>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{p.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <a
                    href={`/admin/packages/${p.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-100"
                  >
                    Kelola Soal
                  </a>

                  {/* Kelola Paket */}
                  <a
                    href={`/admin/packages/${p.id}/settings`}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-100"
                  >
                    Kelola Paket
                  </a>

                  <a
                    href={`/admin/packages/${p.id}/results`}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-100"
                  >
                    Peserta & Nilai
                  </a>

                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="to" value={(!p.isActive).toString()} />
                    <button
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition border ${
                        p.isActive
                          ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                          : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {p.isActive ? 'Unpublish' : 'Publish'}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
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
