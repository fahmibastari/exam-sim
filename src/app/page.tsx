import Link from "next/link"
import { ArrowRight, BookOpen, CheckCircle2, ShieldCheck, Zap } from "lucide-react"

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 opacity-30 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="absolute top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-indigo-100 dark:bg-indigo-900/20 blur-3xl opacity-40 translate-x-1/3 -translate-y-1/4"></div>

        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center lg:text-left lg:flex lg:items-center lg:gap-16">
          <div className="lg:w-1/2">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800 mb-6">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
              Sistem Ujian Online Terpercaya
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:leading-[1.1]">
              Simulasi Ujian <br />
              <span className="text-indigo-600 dark:text-indigo-400">Lebih Fokus & Aman</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto lg:mx-0">
              Platform unifikasi ujian untuk siswa dan institusi. Tanpa gangguan, anti-curang, dan hasil instan. Fokus kerjakan soal, biarkan kami yang mengurus sisanya.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/exam/join"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Masuk ke Ujian <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 hover:-translate-y-0.5"
              >
                Pelajari Fitur
              </Link>
            </div>

            <div className="mt-10 flex items-center justify-center lg:justify-start gap-x-6 text-sm">
              <div className="flex -space-x-2 overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700" />
                ))}
              </div>
              <div className="text-slate-600 dark:text-slate-400">Digunakan oleh <span className="font-bold text-slate-900 dark:text-slate-200">500+</span> Siswa</div>
            </div>

          </div>

          {/* Hero Visual Placeholder */}
          <div className="hidden lg:block lg:w-1/2 relative">
            <div className="relative rounded-2xl bg-slate-900/5 dark:bg-white/5 p-4 ring-1 ring-inset ring-slate-900/10 dark:ring-white/10 lg:rounded-3xl lg:p-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-900/5 dark:ring-slate-100/10 overflow-hidden min-h-[400px] flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="mx-auto h-20 w-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-4">
                    <BookOpen className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Visual Dashboard</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Pratinjau antarmuka ujian akan muncul di sini.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white dark:bg-slate-950 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400">Mengapa Memilih Kami?</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Semua yang Anda butuhkan untuk ujian lancar
            </p>
            <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-400">
              Kami merancang sistem ini dengan fokus pada kecepatan, keamanan, dan kemudahan penggunaan bagi siswa maupun pengawas.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 p-8 transition-shadow hover:shadow-lg dark:hover:bg-slate-900/50">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900 dark:text-white">
                  <ShieldCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400 flex-none" aria-hidden="true" />
                  Keamanan Terjamin
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600 dark:text-slate-400">
                  <p className="flex-auto">Token unik setiap sesi dan validasi ketat memastikan hanya peserta terdaftar yang bisa mengakses ujian.</p>
                </dd>
              </div>
              <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 p-8 transition-shadow hover:shadow-lg dark:hover:bg-slate-900/50">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900 dark:text-white">
                  <Zap className="h-8 w-8 text-indigo-600 dark:text-indigo-400 flex-none" aria-hidden="true" />
                  Performa Cepat
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600 dark:text-slate-400">
                  <p className="flex-auto">Dibangun dengan teknologi modern untuk waktu muat instan tanpa lag di tengah ujian.</p>
                </dd>
              </div>
              <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 p-8 transition-shadow hover:shadow-lg dark:hover:bg-slate-900/50">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900 dark:text-white">
                  <CheckCircle2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400 flex-none" aria-hidden="true" />
                  Mudah Digunakan
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600 dark:text-slate-400">
                  <p className="flex-auto">Antarmuka intuitif. Siswa bisa langsung fokus mengerjakan soal tanpa bingung cara penggunaan.</p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Testimony Section (Optional Placeholder) */}
      <section id="testimony" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="bg-indigo-900 dark:bg-indigo-950/50 relative isolate overflow-hidden px-6 py-24 text-center shadow-2xl rounded-3xl sm:px-16 border border-indigo-700/50">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Siap untuk ujian yang lebih baik?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-indigo-200">
              Bergabung bersama ribuan siswa dan pengawas yang telah merasakan kemudahan ExamSim.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/register"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Daftar Sebagai Admin
              </Link>
              <Link href="/docs" className="text-sm font-semibold leading-6 text-white">
                Pelajari lebih lanjut <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
