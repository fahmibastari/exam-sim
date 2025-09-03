import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export const runtime = 'nodejs'

const RegisterSchema = z
  .object({
    name: z.string().min(2, 'Nama terlalu pendek'),
    email: z.string().email('Email tidak valid'),
    password: z.string().min(6, 'Minimal 6 karakter'),
    confirm: z.string().min(6, 'Minimal 6 karakter'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirm'],
  })

  export default async function RegisterPage({
    searchParams,
  }: {
    searchParams: Promise<{ err?: string }>
  }) {
    // kalau sudah login, lempar ke post-login
    const session = await getServerSession(authOptions)
    if (session?.user) redirect('/post-login')
  
    async function register(formData: FormData) {
      'use server'
      const raw = Object.fromEntries(formData.entries())
      const parsed = RegisterSchema.safeParse(raw)
      if (!parsed.success) redirect('/register?err=invalid')
  
      const { name, email, password } = parsed.data
  
      const exists = await prisma.user.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' } },
      })
      if (exists) redirect('/register?err=exists')
  
      const hash = await bcrypt.hash(password, 10)
  
      await prisma.user.create({
        data: { name, email: email.trim(), password: hash, role: 'ADMIN' },
      })
  
      redirect('/login?ok=1')
    }
  
    // ⬇️ unwrap searchParams dulu
    const { err } = await searchParams
    const msg =
      err === 'invalid' ? 'Data tidak valid'
      : err === 'exists' ? 'Email sudah terdaftar'
      : ''

  const inputCls =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Top Nav */}
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-600 to-blue-400 shadow" />
            <div className="flex flex-col">
              <span className="text-sm font-medium uppercase tracking-wide text-blue-700">
                Platform Simulasi Ujian
              </span>
              <span className="text-xs text-gray-500">Untuk Siswa</span>
            </div>
          </div>
          <a
            href="/login"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Masuk
          </a>
        </div>
      </header>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Daftar Admin</h1>
            <p className="mt-2 text-sm text-gray-600">
              Buat akun admin untuk mengelola paket dan hasil ujian.
            </p>
          </div>

          {msg && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {msg}
            </div>
          )}

          <form action={register} className="space-y-5" noValidate>
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-800">
                Nama Lengkap
              </label>
              <input
                id="name"
                name="name"
                placeholder="Nama lengkap"
                className={inputCls}
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-800">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="nama@domain.com"
                className={inputCls}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-800">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Minimal 6 karakter"
                className={inputCls}
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-gray-800">
                Konfirmasi Password
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                placeholder="Ulangi password"
                className={inputCls}
                required
                autoComplete="new-password"
              />
            </div>

            <button
              className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Buat Akun Admin
            </button>

            <p className="text-center text-[12px] text-gray-500">
              Sudah punya akun?{' '}
              <a href="/login" className="font-medium text-blue-700 underline-offset-2 hover:underline">
                Masuk
              </a>
            </p>

            <p className="text-center text-[11px] text-gray-500">
              Catatan: akun yang didaftarkan akan memiliki peran <span className="font-semibold">ADMIN</span>.
            </p>
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
