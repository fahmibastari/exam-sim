import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip API & aset
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next()
  }

  // 🔐 BACA JWT DENGAN SECRET (penting!)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }).catch(() => null)
  const role = (token as any)?.role as string | undefined

  // 1) Proteksi area admin
  if (pathname.startsWith('/admin') && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // 2) Pengguna yang SUDAH login tidak boleh lihat /login
  // (pakai /post-login agar logika redirect tersentral)
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/post-login', req.url))
  }

  // 3) Opsional: cegah ADMIN mengakses area publik tertentu
  const isPublicRoot = pathname === '/'
  const isRegister   = pathname === '/register'
  const isExamPublic = pathname === '/exam' || pathname.startsWith('/exam/')
  if (role === 'ADMIN' && (isPublicRoot || isRegister || isExamPublic)) {
    return NextResponse.redirect(new URL('/admin/packages', req.url))
  }

  return NextResponse.next()
}

// ✅ Pastikan /login ikut di matcher
export const config = {
  matcher: ['/', '/login', '/register', '/post-login', '/admin/:path*', '/exam/:path*']
}
