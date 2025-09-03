export default function Home() {
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
            Admin Login
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto mt-12 max-w-6xl px-6">
        <div className="grid items-center gap-10 rounded-2xl bg-white p-10 shadow-sm ring-1 ring-gray-200 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-widest text-blue-700">
            SELAMAT DATANG
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            SIMULASI UJIAN UNTUK SISWA
            </h1>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              Pilih paket ujian, masukkan token, lalu isi data diri dengan benar.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="/exam/join"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Mulai Ujian
              </a>
            </div>

            <p className="mt-6 text-xs text-gray-500">
              Pastikan token dan data sesuai ketentuan yang berlaku.
            </p>
          </div>

          {/* Info panel */}
          
        </div>
      </section>

      {/* Section ringkas (opsional, tetap ringan) */}
      <section className="mx-auto mt-12 max-w-6xl px-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Keamanan Dasar</h3>
            <p className="mt-2 text-sm text-gray-600">
              Token unik dan validasi input mengurangi akses yang tidak sah.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Pengalaman Terarah</h3>
            <p className="mt-2 text-sm text-gray-600">
              Alur jelas: pilih paket, masukkan token, isi data diri, mulai ujian.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Siap Produksi</h3>
            <p className="mt-2 text-sm text-gray-600">
              Desain bersih, ringan, dan mudah dipelihara untuk penggunaan jangka panjang.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-center md:flex-row md:text-left">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Simulasi Ujian — Platform simulasi ujian untuk siswa.
          </p>
          <p className="text-xs text-gray-500">
            Dibuat oleh <span className="font-medium text-gray-700">fahmibastari</span> &amp;{" "}
            <span className="font-medium text-gray-700">qorrieaina</span>.
          </p>
        </div>
      </footer>
    </main>
  )
}
