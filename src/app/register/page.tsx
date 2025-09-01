import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

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
  searchParams?: { err?: string }
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

    // cari email case-insensitive
    const exists = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    })
    if (exists) redirect('/register?err=exists')

    const hash = await bcrypt.hash(password, 10)

    // ⬇⬇⬇ semua yang daftar jadi ADMIN
    await prisma.user.create({
      data: { name, email: email.trim(), password: hash, role: 'ADMIN' },
    })

    redirect('/login?ok=1')
  }

  const msg =
    searchParams?.err === 'invalid'
      ? 'Data tidak valid'
      : searchParams?.err === 'exists'
      ? 'Email sudah terdaftar'
      : ''

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form action={register} className="w-full max-w-sm space-y-3 border p-6 rounded-xl">
        <h1 className="text-xl font-semibold">Daftar Admin</h1>
        {msg && <p className="text-red-600 text-sm">{msg}</p>}

        <input name="name" placeholder="Nama lengkap" className="border p-2 w-full" required />
        <input name="email" type="email" placeholder="Email" className="border p-2 w-full" required />
        <input name="password" type="password" placeholder="Password (min. 6)" className="border p-2 w-full" required />
        <input name="confirm" type="password" placeholder="Konfirmasi password" className="border p-2 w-full" required />

        <button className="border p-2 w-full rounded">Buat Akun Admin</button>
        <p className="text-sm text-center">
          Sudah punya akun? <a href="/login" className="underline">Masuk</a>
        </p>
      </form>
    </div>
  )
}
