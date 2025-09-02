// src/app/admin/packages/[id]/settings/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const UpdateSchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 huruf'),
  description: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(2000).optional()
  ),
  // "" => undefined, kalau isi harus int >= 1
  timeLimitMin: z.union([
    z.literal('').transform(() => undefined),
    z.coerce.number().int().min(1, 'Batas menit minimal 1'),
  ]).optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true'),
  // Kosongkan jika tidak ingin mengganti token
  newToken: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(4, 'Token minimal 4 karakter').optional()
  ),
})

export default async function PackageSettingsPage(
    props: { params: Promise<{ id: string }> }
  ) {
    const { id } = await props.params;
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

    await prisma.examPackage.update({ where: { id }, data }) // ✅ pakai id
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-blue-700 tracking-tight">
            Pengaturan Paket — {pkg.title}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Edit judul, deskripsi, token, batas waktu, dan status publish.
          </p>
        </div>

        {/* Form Update */}
        <form action={updatePackage} className="bg-white rounded-2xl shadow-lg border border-blue-100 p-5 grid gap-4" noValidate>
          <h2 className="text-lg font-semibold text-gray-900">Edit Paket</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-800">Judul</label>
              <input
                name="title"
                defaultValue={pkg.title}
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-800">Batas menit (opsional)</label>
              <input
                name="timeLimitMin"
                type="number"
                min={1}
                step={1}
                defaultValue={typeof pkg.timeLimitMin === 'number' ? pkg.timeLimitMin : ''}
                placeholder="Kosongkan jika tanpa batas"
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black"
              />
              <p className="text-[12px] text-gray-500">Biarkan kosong bila tanpa batas waktu.</p>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-sm font-medium text-gray-800">Deskripsi (opsional)</label>
              <textarea
                name="description"
                defaultValue={pkg.description ?? ''}
                rows={3}
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-800">Status</label>
              <select
                name="isActive"
                defaultValue={pkg.isActive ? 'true' : 'false'}
                className="w-40 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5"
              >
                <option value="true">Published</option>
                <option value="false">Draft</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-800">Ganti Token (plaintext, opsional)</label>
              <input
                name="newToken"
                placeholder="Kosongkan jika tidak diganti"
                autoComplete="off"
                className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 text-black"
              />
              <p className="text-[12px] text-gray-500">Jika diisi, token akan di-hash ulang saat disimpan.</p>
            </div>
          </div>

          <div className="pt-2">
            <button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200">
              Simpan Perubahan
            </button>
            <a
              href={`/admin/packages/${pkg.id}`}
              className="ml-3 inline-flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-4 py-3 border border-gray-200"
            >
              ← Kelola Soal
            </a>
          </div>
        </form>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-5">
          <h3 className="text-base font-semibold text-red-700">Hapus Paket</h3>
          <p className="text-sm text-gray-600 mt-1">
            Menghapus paket akan menghapus semua soal, opsi, dan attempt yang terkait. Tindakan ini tidak dapat dibatalkan.
          </p>
          <form action={deletePackage} className="mt-3 flex items-center gap-3">
            <input
              name="confirm"
              placeholder='Ketik "DELETE" untuk konfirmasi'
              className="flex-1 rounded-xl border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 p-2.5"
            />
            <button className="rounded-xl border border-red-300 text-red-700 hover:bg-red-50 font-semibold py-2.5 px-4">
              Hapus Paket
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
