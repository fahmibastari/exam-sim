import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { Plus, Check, Clock, FileText, Users, Search, MoreHorizontal, Globe, Play, Lock, AlertCircle } from 'lucide-react'

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
    'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'
  const cardCls = 'rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800'

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Manajemen Paket Soal</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Buat, kelola, dan publikasikan paket ujian Anda di sini.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Create Form */}
        <div className="lg:col-span-1">
          <form action={createPackage} className={`${cardCls} sticky top-24`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <Plus className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Buat Paket Baru</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Judul Paket
                </label>
                <input
                  id="title"
                  name="title"
                  placeholder="Contoh: UAS Matematika 2024"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label htmlFor="timeLimitMin" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Durasi (Menit)
                </label>
                <div className="relative">
                  <Clock className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                  <input
                    id="timeLimitMin"
                    name="timeLimitMin"
                    type="number"
                    min={1}
                    placeholder="Kosong = Tanpa Batas"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Deskripsi
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Info tambahan untuk peserta..."
                  rows={3}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="token" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Token Akses
                </label>
                <div className="relative">
                  <Lock className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                  <input
                    id="token"
                    name="token"
                    placeholder="Minimal 4 karakter"
                    autoComplete="off"
                    className={`${inputCls} pl-9 font-mono`}
                    required
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Token digunakan peserta untuk masuk ujian.</p>
              </div>

              <div className="pt-2">
                <button className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:translate-y-0.5">
                  <Plus className="h-4 w-4" />
                  Buat Paket
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-400" />
            Daftar Paket ({pkgs.length})
          </h2>

          {pkgs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-3">
                <Package className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Belum ada paket</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Buat paket ujian pertama Anda di panel sebelah kiri.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pkgs.map((p) => (
                <div key={p.id} className="group relative rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 transition-all hover:shadow-md hover:ring-indigo-500/30">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate pr-2">
                          {p.title}
                        </h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${p.isActive ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-green-600/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ring-slate-500/20'
                          }`}>
                          {p.isActive ? 'Aktif' : 'Draft'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {p.timeLimitMin ? `${p.timeLimitMin} Menit` : 'Tanpa Batas'}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {p._count.questions} Soal
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {p._count.attempts} Peserta
                        </div>
                      </div>
                      {p.description && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{p.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start pt-1">
                      <form action={toggleActive}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="to" value={(!p.isActive).toString()} />
                        <button
                          title={p.isActive ? 'Matikan' : 'Aktifkan'}
                          className={`p-2 rounded-lg transition-colors ${p.isActive
                            ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                        >
                          {p.isActive ? <Play className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5" />}
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <a
                      href={`/admin/packages/${p.id}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    >
                      Kelola Soal
                    </a>
                    <a
                      href={`/admin/packages/${p.id}/settings`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Edit Paket
                    </a>
                    <a
                      href={`/admin/packages/${p.id}/results`}
                      className="ml-auto inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600"
                    >
                      Lihat Hasil <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ArrowRight(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
  )
}
function Package(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22v-9" /></svg>
  )
}
