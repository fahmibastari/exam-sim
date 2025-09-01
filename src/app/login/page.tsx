'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false) // toggle lihat/samarkan password (UI saja)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)

    if (!res || res.error) {
      // NextAuth kirim 'CredentialsSignin' untuk kredensial salah / non-admin
      setError('Email/password salah atau Anda bukan admin.')
      return
    }
    // biar server yang menentukan redirect berdasarkan role
    router.replace('/post-login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-blue-100 p-6 space-y-4"
        noValidate
      >
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-blue-700">Masuk Admin</h1>
          <p className="text-xs text-gray-600 mt-1">Gunakan akun admin untuk mengelola paket & hasil ujian.</p>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-gray-800">
            Email
          </label>
          <input
            id="email"
            className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5"
            placeholder="nama@domain.com"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-gray-800">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5 pr-12"
              placeholder="••••••••"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute inset-y-0 right-2 my-1 rounded-lg px-3 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              aria-label={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}
              title={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPwd ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3"
          >
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 shadow-md active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-blue-200"
        >
          {loading ? 'Memproses…' : 'Masuk'}
        </button>

        {/* Footer kecil */}
        <div className="text-[12px] text-gray-500 text-center">
          Butuh bantuan? Hubungi super admin untuk reset akses.
        </div>
      </form>
    </div>
  )
}
