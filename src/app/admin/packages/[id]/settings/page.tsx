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
<footer className="mt-16 border-t border-gray-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-gray-800 dark:bg-gray-950/70">
  <div className="mx-auto max-w-7xl px-6">
    {/* Top: brand + nav columns */}
    <div className="grid gap-10 py-12 md:grid-cols-4">
      {/* Brand */}
      <div className="md:col-span-1">
        <a href="/" className="inline-flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            {/* Simple mark (graduation cap) */}
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path fill="currentColor" d="M12 3 2 8l10 5 8-4.1V15h2V8L12 3zm-6 9.2V16c0 2.2 3.1 4 6 4s6-1.8 6-4v-3.8l-6 3-6-3z"/>
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Simulasi Ujian
          </span>
        </a>
        <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-400">
          Platform simulasi ujian untuk siswa & institusi—stabil, aman, dan mudah digunakan.
        </p>
      </div>

      {/* Columns */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Produk
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><a href="/features" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Fitur</a></li>
          <li><a href="/pricing" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Harga</a></li>
          <li><a href="/docs" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Dokumentasi</a></li>
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Perusahaan
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><a href="/about" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Tentang</a></li>
          <li><a href="/careers" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Karier</a></li>
          <li><a href="/contact" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Kontak</a></li>
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          Dukungan
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><a href="/status" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Status Layanan</a></li>
          <li><a href="/privacy" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Kebijakan Privasi</a></li>
          <li><a href="/terms" className="text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200">Syarat & Ketentuan</a></li>
        </ul>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="flex flex-col-reverse items-center justify-between gap-4 border-t border-gray-200 py-6 text-sm md:flex-row dark:border-gray-800">
      <p className="text-gray-600 dark:text-gray-400">
        © {new Date().getFullYear()} Simulasi Ujian. All rights reserved.
      </p>

      <div className="flex flex-col items-center gap-3 md:flex-row">
        <p className="text-gray-600 dark:text-gray-400">
          Dibuat oleh
        </p>

        <span className="hidden h-4 w-px bg-gray-200 md:block dark:bg-gray-800" aria-hidden="true" />

        {/* Social icons */}
        <div className="flex items-center gap-2">
  <a
    href="https://instagram.com/fahmibastari"
    target="_blank"
    rel="noopener noreferrer"
    title="Instagram @fahmibastari"
    aria-label="Instagram @fahmibastari"
    className="group inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-900/50"
  >
    <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-80 transition group-hover:opacity-100" aria-hidden="true">
      <path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7m9.5 2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/>
    </svg>
    <span className="underline decoration-gray-300/70 underline-offset-4 group-hover:decoration-gray-400">
      Fahmi Bastari
    </span>
  </a>

  <span className="h-4 w-px bg-gray-200 dark:bg-gray-800" aria-hidden="true" />

  <a
    href="https://instagram.com/qorrieaa"
    target="_blank"
    rel="noopener noreferrer"
    title="Instagram @qorriea"
    aria-label="Instagram @qorriea"
    className="group inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-900/50"
  >
    <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-80 transition group-hover:opacity-100" aria-hidden="true">
      <path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7m9.5 2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/>
    </svg>
    <span className="underline decoration-gray-300/70 underline-offset-4 group-hover:decoration-gray-400">
      Qorrie Aina
    </span>
  </a>
</div>

      </div>
    </div>
  </div>
</footer>
    </main>
  )
}
