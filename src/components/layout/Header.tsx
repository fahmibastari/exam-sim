import Link from "next/link"
import { Zap } from "lucide-react"

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600/20">
                            <Zap className="h-5 w-5" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-slate-900">
                            ExamSim
                        </span>
                    </Link>
                </div>

                <nav className="hidden md:flex items-center gap-6">
                    <Link href="/#features" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
                        Fitur
                    </Link>
                    <Link href="/#testimony" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
                        Testimoni
                    </Link>
                </nav>

                <div className="flex items-center gap-4">
                    <Link
                        href="/login"
                        className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                    >
                        Admin Login
                    </Link>
                    <Link
                        href="/exam/join"
                        className="hidden rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-600 transition hover:bg-indigo-700 hover:ring-indigo-700 md:inline-flex"
                    >
                        Mulai Ujian
                    </Link>
                </div>
            </div>
        </header>
    )
}
