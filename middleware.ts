import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ⛔ Jangan sentuh API, asset Next, dan file statis
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next()
  }

  // Ambil token NextAuth (butuh NEXTAUTH_SECRET di .env)
  let role: string | undefined
  try {
    const token = await getToken({ req })
    role = (token as any)?.role
  } catch {
    // kalau gagal baca token, anggap belum login
    role = undefined
  }

  // 1) Proteksi area admin
  if (pathname.startsWith('/admin')) {
    if (role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // 2) Jika ADMIN sudah login, cegah akses halaman publik
  const isPublicRoot = pathname === '/'
  const isRegister   = pathname === '/register'
  const isExamPublic = pathname === '/exam' || pathname.startsWith('/exam/')

  if (role === 'ADMIN' && (isPublicRoot || isRegister || isExamPublic)) {
    return NextResponse.redirect(new URL('/admin/packages', req.url))
  }

  // 3) ADMIN buka /login -> kirim ke dashboard
  if (pathname === '/login' && role === 'ADMIN') {
    return NextResponse.redirect(new URL('/admin/packages', req.url))
  }

  // 4) biarkan /post-login dikerjakan oleh server page-nya sendiri
  return NextResponse.next()
}

// ✅ Matcher: jalankan middleware untuk rute halaman saja (API/asset sudah di-skip di atas)
export const config = {
  matcher: [
    '/', '/login', '/register', '/post-login',
    '/admin/:path*', '/exam/:path*'
  ]
}
