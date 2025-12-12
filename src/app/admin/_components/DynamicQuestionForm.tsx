'use client'

import { useState } from 'react'
import {
    CheckSquare,
    ListChecks,
    ToggleLeft,
    Type,
    AlignLeft,
    Hash,
    SlidersHorizontal,
    Info
} from 'lucide-react'
import ClientActionForm from './ClientActionForm'

type QuestionType =
    | 'SINGLE_CHOICE'
    | 'MULTI_SELECT'
    | 'TRUE_FALSE'
    | 'SHORT_TEXT'
    | 'ESSAY'
    | 'NUMBER'
    | 'RANGE'

const TYPES: { id: QuestionType; l: string; i: React.ReactNode }[] = [
    { id: 'SINGLE_CHOICE', l: 'PG', i: <CheckSquare className="h-4 w-4" /> },
    { id: 'MULTI_SELECT', l: 'Multi', i: <ListChecks className="h-4 w-4" /> },
    { id: 'TRUE_FALSE', l: 'B/S', i: <ToggleLeft className="h-4 w-4" /> },
    { id: 'SHORT_TEXT', l: 'Isian', i: <Type className="h-4 w-4" /> },
    { id: 'ESSAY', l: 'Esai', i: <AlignLeft className="h-4 w-4" /> },
    { id: 'NUMBER', l: 'Angka', i: <Hash className="h-4 w-4" /> },
    { id: 'RANGE', l: 'Skala', i: <SlidersHorizontal className="h-4 w-4" /> },
]

interface DynamicQuestionFormProps {
    action: (formData: FormData) => Promise<{ error?: string; success?: boolean } | undefined>
    passageId?: string
    successMessage?: string
    defaultType?: QuestionType
}

export default function DynamicQuestionForm({
    action,
    passageId,
    successMessage = 'Soal berhasil disimpan',
    defaultType = 'SINGLE_CHOICE',
}: DynamicQuestionFormProps) {
    const [type, setType] = useState<QuestionType>(defaultType)

    const inputCls =
        'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'
    const fileCls =
        'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-4 file:py-2.5 file:text-white file:font-semibold hover:file:bg-indigo-700'

    return (
        <ClientActionForm action={action} className="space-y-6" successMessage={successMessage}>
            <input type="hidden" name="passageId" value={passageId || ''} />

            {/* 1. Tipe Soal Wrapper */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Tipe Soal
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {TYPES.map((t) => (
                        <label key={t.id} className="cursor-pointer relative group">
                            <input
                                type="radio"
                                name="type"
                                value={t.id}
                                className="peer sr-only"
                                checked={type === t.id}
                                onChange={() => setType(t.id)}
                            />
                            <div className="flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600 transition-all shadow-sm">
                                {t.i}
                                <span className="text-[10px] font-bold text-center leading-tight">{t.l}</span>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* 2. Main Question Fields */}
            <div className="grid sm:grid-cols-12 gap-4">
                {/* Order & Points (Small) */}
                <div className="sm:col-span-3 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Urutan</label>
                        <input name="order" className={inputCls} placeholder="Auto" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Poin</label>
                        <input name="points" type="number" defaultValue={1} className={inputCls} />
                    </div>
                </div>

                {/* Question Text (Large) */}
                <div className="sm:col-span-9">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Pertanyaan</label>
                    <textarea
                        name="text"
                        rows={5}
                        className={inputCls}
                        placeholder="Tulis pertanyaan Anda di sini..."
                        required
                    />
                </div>
            </div>

            {/* 3. Media Uploads (Optional) */}
            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Gambar (Opsional)</label>
                    <input type="file" name="image" className={fileCls} accept="image/*" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Audio (Opsional)</label>
                    <input type="file" name="audio" className={fileCls} accept="audio/*" />
                </div>
            </div>

            {/* 4. DYNAMIC FIELDS BASED ON TYPE */}
            <div className="space-y-4 pt-2">
                {/* === PILIHAN GANDA / MULTI SELECT === */}
                {(type === 'SINGLE_CHOICE' || type === 'MULTI_SELECT') && (
                    <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Opsi Jawaban
                            </h4>
                            <div className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-1 rounded">
                                {type === 'SINGLE_CHOICE' ? 'Pilih 1 Kunci Jawaban' : 'Centang semua jawaban benar'}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {['A', 'B', 'C', 'D'].map((l) => (
                                <div key={l} className="flex gap-2 items-center">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 font-bold text-indigo-600 dark:text-indigo-400 shadow-sm">
                                        {l}
                                    </span>
                                    <input
                                        name={l}
                                        placeholder={`Jawaban Opsi ${l}`}
                                        className={inputCls}
                                        required // Kunci: Hanya required jika visible!
                                    />
                                    {type === 'SINGLE_CHOICE' ? (
                                        <label className="flex items-center justify-center h-10 w-10 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-900/30 has-[:checked]:border-emerald-500 dark:has-[:checked]:border-emerald-700 has-[:checked]:text-emerald-600 dark:has-[:checked]:text-emerald-400 transition-all" title="Tandai Benar">
                                            <input type="radio" name="correctLabel" value={l} className="peer sr-only" required />
                                            <CheckSquare className="h-5 w-5 text-slate-300 dark:text-slate-600 peer-checked:text-emerald-600 dark:peer-checked:text-emerald-400" />
                                        </label>
                                    ) : (
                                        <label className="flex items-center justify-center h-10 w-10 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-900/30 has-[:checked]:border-emerald-500 dark:has-[:checked]:border-emerald-700 has-[:checked]:text-emerald-600 dark:has-[:checked]:text-emerald-400 transition-all" title="Tandai Benar">
                                            <input type="checkbox" name="correctMulti" value={l} className="peer sr-only" />
                                            <CheckSquare className="h-5 w-5 text-slate-300 dark:text-slate-600 peer-checked:text-emerald-600 dark:peer-checked:text-emerald-400" />
                                        </label>
                                    )}
                                </div>
                            ))}

                            {/* Option E (Optional) */}
                            <div className="flex gap-2 items-center opacity-80 hover:opacity-100 transition-opacity">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-400 text-xs">
                                    E
                                </span>
                                <input
                                    name="E"
                                    placeholder="Opsi E (Opsional)"
                                    className={inputCls}
                                />
                                {type === 'SINGLE_CHOICE' ? (
                                    <label className="flex items-center justify-center h-10 w-10 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" title="Tandai Benar">
                                        <input type="radio" name="correctLabel" value="E" className="peer sr-only" />
                                        <CheckSquare className="h-5 w-5 text-slate-300 dark:text-slate-600 peer-checked:text-emerald-600 dark:peer-checked:text-emerald-400" />
                                    </label>
                                ) : (
                                    <label className="flex items-center justify-center h-10 w-10 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" title="Tandai Benar">
                                        <input type="checkbox" name="correctMulti" value="E" className="peer sr-only" />
                                        <CheckSquare className="h-5 w-5 text-slate-300 dark:text-slate-600 peer-checked:text-emerald-600 dark:peer-checked:text-emerald-400" />
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* === TRUE / FALSE === */}
                {type === 'TRUE_FALSE' && (
                    <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                        <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2">
                            <ToggleLeft className="h-4 w-4" /> Konfigurasi Benar/Salah
                        </h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Label 'Benar'</label>
                                <input name="tfTrueText" defaultValue="Benar" className={inputCls} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Label 'Salah'</label>
                                <input name="tfFalseText" defaultValue="Salah" className={inputCls} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Kunci Jawaban</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="correctTF" value="TRUE" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" required />
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">True (Benar)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="correctTF" value="FALSE" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" required />
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">False (Salah)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* === ESSAY / SHORT_TEXT === */}
                {(type === 'ESSAY' || type === 'SHORT_TEXT') && (
                    <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                        <div className="flex gap-2 text-indigo-900 dark:text-indigo-300 mb-2">
                            <Info className="h-5 w-5" />
                            <p className="text-sm font-medium">
                                {type === 'ESSAY'
                                    ? 'Jawaban esai akan dikoreksi manual atau dicek kata kuncinya (jika ada).'
                                    : 'Jawaban singkat dicocokkan dengan teks persis.'}
                            </p>
                        </div>

                        {type === 'SHORT_TEXT' && (
                            <div className="mt-3">
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" name="caseSensitive" className="rounded text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Case Sensitive (Huruf besar/kecil berpengaruh)</span>
                                </label>
                            </div>
                        )}
                    </div>
                )}

                {/* === NUMBER === */}
                {type === 'NUMBER' && (
                    <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50 grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Angka Target</label>
                            <input name="targetNumber" type="number" step="any" className={inputCls} required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Toleransi (+/-)</label>
                            <input name="tolerance" type="number" step="any" defaultValue="0" className={inputCls} />
                        </div>
                        <p className="col-span-2 text-xs text-slate-500 dark:text-slate-400">Contoh: Target 10, Toleransi 0.5 &rarr; Jawaban 9.5 s/d 10.5 dianggap benar.</p>
                    </div>
                )}

                {/* === RANGE === */}
                {type === 'RANGE' && (
                    <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50 grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Min</label>
                            <input name="min" type="number" className={inputCls} required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Max</label>
                            <input name="max" type="number" className={inputCls} required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Step</label>
                            <input name="step" type="number" defaultValue="1" className={inputCls} />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
                <button className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all active:scale-95">
                    Simpan Soal
                </button>
            </div>
        </ClientActionForm>
    )
}
