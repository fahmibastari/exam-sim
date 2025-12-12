'use client'

import { useRouter } from 'next/navigation'
import { startTransition } from 'react'

export default function QuestionFilter({
    initialQuery = '',
    initialType = ''
}: {
    initialQuery?: string
    initialType?: string
}) {
    const router = useRouter()

    function handleSearch(formData: FormData) {
        const q = formData.get('q') as string
        const type = formData.get('type') as string

        // Construct search params
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (type) params.set('type', type)

        // Using transition for smoother navigation
        startTransition(() => {
            router.replace(`?${params.toString()}`, { scroll: false })
        })
    }

    return (
        <form className="flex flex-col sm:flex-row gap-2 w-full md:max-w-xl"
            onSubmit={(e) => {
                e.preventDefault()
                handleSearch(new FormData(e.currentTarget))
            }}>
            <div className="relative flex-1">
                <input
                    name="q"
                    type="search"
                    defaultValue={initialQuery}
                    placeholder="Cari soal..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <select
                name="type"
                defaultValue={initialType}
                onChange={(e) => handleSearch(new FormData(e.currentTarget.form!))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
                <option value="">Semua Tipe</option>
                <option value="SINGLE_CHOICE">Pilihan Ganda</option>
                <option value="MULTI_SELECT">Multi Pilihan</option>
                <option value="TRUE_FALSE">Benar / Salah</option>
                <option value="SHORT_TEXT">Isian Singkat</option>
                <option value="ESSAY">Uraian</option>
                <option value="NUMBER">Angka</option>
                <option value="RANGE">Skala / Range</option>
            </select>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 shadow-sm transition-colors">
                Cari
            </button>
        </form>
    )
}
