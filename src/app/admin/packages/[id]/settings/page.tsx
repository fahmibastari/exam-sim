// src/app/admin/packages/[id]/settings/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ArrowLeft, Save, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import Link from 'next/link'

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
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'
  const cardCls = 'rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200'

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <section className="mx-auto max-w-5xl px-6 py-8 space-y-8">
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pengaturan Paket
            </h1>
            <p className="text-sm text-slate-600">
              Konfigurasi detail untuk paket <span className="font-semibold text-slate-900">{pkg.title}</span>.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/admin/packages/${id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              Kelola Soal
            </Link>
          </div>
        </div>


        {/* Form Update */}
        <form action={updatePackage} className={cardCls}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Save className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Edit Informasi Paket</h2>
              <p className="text-xs text-slate-500">Perbarui judul, deskripsi, dan pengaturan lainnya.</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Judul Paket</label>
              <input
                name="title"
                defaultValue={pkg.title}
                className={inputCls}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Batas Waktu (Menit)</label>
              <input
                name="timeLimitMin"
                type="number"
                min={1}
                step={1}
                defaultValue={typeof pkg.timeLimitMin === 'number' ? pkg.timeLimitMin : ''}
                placeholder="Contoh: 120"
                className={inputCls}
              />
              <p className="text-xs text-slate-500">Biarkan kosong jika tidak ada batas waktu.</p>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Deskripsi (Opsional)</label>
              <textarea
                name="description"
                defaultValue={pkg.description ?? ''}
                rows={3}
                className={inputCls}
                placeholder="Deskripsi singkat tentang materi ujian..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Status Publikasi</label>
              <div className="relative">
                <select
                  name="isActive"
                  defaultValue={pkg.isActive ? 'true' : 'false'}
                  className={inputCls}
                >
                  <option value="true">Published (Aktif)</option>
                  <option value="false">Draft (Tersembunyi)</option>
                </select>
                <div className="absolute right-3 top-2.5 pointer-events-none text-slate-500">
                  <CheckCircle className="h-4 w-4" />
                </div>
              </div>

            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Ganti Token Akses</label>
              <input
                name="newToken"
                placeholder="Masukkan token baru..."
                autoComplete="off"
                className={inputCls}
              />
              <p className="text-xs text-slate-500">Kosongkan jika tidak ingin mengganti token.</p>
            </div>
          </div>

          <div className="mt-8 flex justify-end pt-6 border-t border-slate-100">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.98]"
            >
              <Save className="h-4 w-4" />
              Simpan Perubahan
            </button>
          </div>
        </form>

        {/* Danger Zone */}
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-red-900">Hapus Paket</h3>
              <p className="mt-1 text-sm text-red-600/80">
                Menghapus paket akan menghapus semua soal, opsi jawaban, dan riwayat pengerjaan siswa secara permanen. Tindakan ini tidak dapat dibatalkan.
              </p>

              <form action={deletePackage} className="mt-5 sm:flex sm:items-center sm:gap-3">
                <div className="w-full sm:max-w-xs">
                  <input
                    name="confirm"
                    placeholder='Ketik "DELETE" untuk konfirmasi'
                    className="block w-full rounded-lg border-red-300 bg-white p-2.5 text-sm text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500"
                  />
                </div>

                <button className="mt-3 w-full sm:mt-0 sm:w-auto inline-flex justify-center items-center gap-2 rounded-lg border border-transparent bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:text-sm">
                  Hapus Paket Secara Permanen
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

