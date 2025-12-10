import Link from "next/link"

export function Footer() {
    return (
        <footer className="bg-white border-t border-slate-200 mt-auto">
            <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
                <div className="flex justify-center space-x-6 md:order-2">
                    <a href="https://instagram.com/fahmibastari" target="_blank" className="text-slate-400 hover:text-slate-500">
                        <span className="sr-only">Instagram</span>
                        <span className="text-sm">@fahmibastari</span>
                    </a>
                    <a href="https://instagram.com/qorrieaa" target="_blank" className="text-slate-400 hover:text-slate-500">
                        <span className="sr-only">Instagram</span>
                        <span className="text-sm">@qorrieaa</span>
                    </a>
                </div>
                <div className="mt-8 md:order-1 md:mt-0">
                    <p className="text-center text-xs leading-5 text-slate-500">
                        &copy; {new Date().getFullYear()} ExamSim Platform. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
}
