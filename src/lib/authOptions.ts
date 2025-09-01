import type { NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null

        // 🔎 cari case-insensitive (hindari gagal karena huruf besar/kecil)
        const user = await prisma.user.findFirst({
          where: { email: { equals: creds.email.trim(), mode: 'insensitive' } },
        })
        if (!user) return null

        // 🔐 wajib password hash bcrypt (bukan plaintext)
        const ok = await bcrypt.compare(creds.password, user.password)
        if (!ok) return null

        // 🛡️ hanya ADMIN yang boleh login
        if (user.role !== 'ADMIN') return null

        return { id: user.id, email: user.email, name: user.name ?? undefined, role: user.role } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        ;(token as any).role = (user as any).role
        ;(token as any).id = (user as any).id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).role = (token as any).role
        ;(session.user as any).id = (token as any).id
      }
      return session
    },
  },
}
