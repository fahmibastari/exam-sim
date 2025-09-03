// src/app/admin/packages/[id]/settings/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export const runtime = 'nodejs'

const UpdateSchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 huruf'),
  description: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(2000).optional()
  ),
  timeLimitMin: z.union([
    z.literal('').transform(() => undefined),
    z.coerce.number().int().min(1, 'Batas menit minimal 1'),
  ]).optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true'),
  newToken: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(4, 'Token minimal 4 karakter').optional()
  ),
})

export default async function PackageSettingsPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params

  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') redirect('/login')

  const pkg = await prisma.examPackage.findUnique({
    where: { id },
    select: { id: true, title: true, description: true, isActive: true, timeLimitMin: true, createdAt: true },
  })
  if (!pkg) redirect('/admin/packages')

  async function updatePackage(formData: FormData) {
    'use server'
    const raw = Object.fromEntries(formData.entries())
    const parsed = UpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => i.message).join(', ')
      throw new Error('Data tidak valid: ' + msg)
    }
    const { title, description, timeLimitMin, isActive, newToken } = parsed.data

    const data: any = {
      title,
      description: description ?? null,
      timeLimitMin: timeLimitMin ?? null,
      isActive,
    }

    if (newToken) {
      const bcrypt = (await import('bcryptjs')).default
      data.tokenHash = await bcrypt.hash(newToken, 10)
    }

    await prisma.examPackage.update({ where: { id }, data })
    revalidatePath('/admin/packages')
    revalidatePath(`/admin/packages/${id}`)
    revalidatePath(`/admin/packages/${id}/settings`)
  }

  async function deletePackage(formData: FormData) {
    'use server'
    const confirm = String(formData.get('confirm') ?? '')
    if (confirm !== 'DELETE') throw new Error('Ketik DELETE untuk konfirmasi.')
    await prisma.examPackage.delete({ where: { id } })
    revalidatePath('/admin/packages')
    redirect('/admin/packages')
  }

  // UI helpers
  const inputCls =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'
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
            Pengaturan Paket — {pkg.title}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Edit judul, deskripsi, token, batas waktu, dan status publikasi.
          </p>
        </div>

        {/* Form Update */}
        <form action={updatePackage} className={cardCls} noValidate>
          <h2 className="text-lg font-semibold text-gray-900">Edit Paket</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">Judul</label>
              <input
                name="title"
                defaultValue={pkg.title}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">Batas menit (opsional)</label>
              <input
                name="timeLimitMin"
                type="number"
                min={1}
                step={1}
                defaultValue={typeof pkg.timeLimitMin === 'number' ? pkg.timeLimitMin : ''}
                placeholder="Kosongkan jika tanpa batas"
                className={inputCls}
              />
              <p className="mt-1 text-[12px] text-gray-500">Biarkan kosong untuk tanpa batas waktu.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-800">Deskripsi (opsional)</label>
              <textarea
                name="description"
                defaultValue={pkg.description ?? ''}
                rows={3}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">Status</label>
              <select
                name="isActive"
                defaultValue={pkg.isActive ? 'true' : 'false'}
                className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="true">Published</option>
                <option value="false">Draft</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">Ganti Token (plaintext, opsional)</label>
              <input
                name="newToken"
                placeholder="Kosongkan jika tidak diganti"
                autoComplete="off"
                className={inputCls}
              />
              <p className="mt-1 text-[12px] text-gray-500">Jika diisi, token akan di-hash ulang saat disimpan.</p>
            </div>
          </div>

          <div className="pt-3">
            <button
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Simpan Perubahan
            </button>
            <a
              href={`/admin/packages/${pkg.id}`}
              className="ml-3 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-100"
            >
              Kelola Soal
            </a>
          </div>
        </form>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-red-700">Hapus Paket</h3>
          <p className="mt-1 text-sm text-gray-600">
            Menghapus paket akan menghapus semua soal, opsi, dan attempt yang terkait. Tindakan ini tidak dapat dibatalkan.
          </p>
          <form action={deletePackage} className="mt-3 flex items-center gap-3">
            <input
              name="confirm"
              placeholder='Ketik "DELETE" untuk konfirmasi'
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
            <button className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50">
              Hapus Paket
            </button>
          </form>
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
