export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* Judul */}
        <h1 className="text-3xl font-bold text-blue-600 mb-3">
          🎓 Simulasi Ujian
        </h1>

        {/* Deskripsi singkat */}
        <p className="text-gray-600 text-base mb-6">
          Ayo mulai latihan ujianmu!  
          Pilih paket, masukkan token, lalu isi data diri dengan benar.
        </p>

        {/* Tombol aksi utama */}
        <a
          href="/exam/join"
          className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition mb-4"
        >
          🚀 Mulai Ujian
        </a>

        {/* Tombol kecil admin */}
        <a
          href="/login"
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          🔑 Admin Login
        </a>
      </div>
    </main>
  )
}
