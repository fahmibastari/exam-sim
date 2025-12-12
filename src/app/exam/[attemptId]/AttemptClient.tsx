// src/app/exam/[attemptId]/AttemptClient.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Save,
  HelpCircle,
  AlertTriangle
} from 'lucide-react'

type Option = { id: string; label: string; text: string }
type Question = {
  id: string
  order: number
  text: string
  imageUrl: string | null
  audioUrl: string | null // NEW
  type: 'SINGLE_CHOICE' | 'MULTI_SELECT' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'ESSAY' | 'NUMBER' | 'RANGE'
  settings?: any
  options: Option[]
  contextText?: string | null
  passage?: { id: string; title: string | null; content: string; audioUrl: string | null } | null
}
type AnswerShape = {
  selectedOptionIds?: string[]
  valueText?: string
  valueNumber?: number | null
}
type Payload = {
  questions: Question[]
  timeLimitMin: number | null
  endsAt: string | null
  answers: Record<string, AnswerShape>
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms = 400) {
  let t: any
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

export default function AttemptClient({ attemptId }: { attemptId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [qs, setQs] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, AnswerShape>>({})
  const [timeLimitMin, setTimeLimitMin] = useState<number | null>(null)
  const acRef = useRef<AbortController | null>(null)
  const [endsAt, setEndsAt] = useState<string | null>(null)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  const [expired, setExpired] = useState(false)
  const autoSubmitRef = useRef(false)

  const saveTextDebounced = useRef(
    debounce((qid: string, valueText: string) => {
      save(qid, { valueText })
    }, 450)
  ).current
  const expiredRef = useRef(false)
  useEffect(() => { expiredRef.current = expired }, [expired])

  // load questions
  useEffect(() => {
    if (!attemptId) return
    setLoading(true); setError(null)
    const ac = new AbortController(); acRef.current = ac
      ; (async () => {
        try {
          const r = await fetch(`/api/exams/${attemptId}/questions`, { signal: ac.signal })
          if (!r.ok) throw new Error('Gagal memuat soal')
          const json = (await r.json()) as Payload
          setQs(json.questions)
          setTimeLimitMin(json.timeLimitMin ?? null)
          setEndsAt(json.endsAt ?? null)
          setAnswers(json.answers ?? {})
        } catch (e: any) {
          if (e.name !== 'AbortError') setError(e.message || 'Gagal memuat')
        } finally {
          setLoading(false)
        }
      })()
    return () => ac.abort()
  }, [attemptId])

  // countdown
  useEffect(() => {
    if (!endsAt) {
      setRemainingSec(null)
      setExpired(false)
      return
    }
    const end = new Date(endsAt)
    if (isNaN(end.getTime())) {
      setRemainingSec(null)
      setExpired(false)
      return
    }
    const compute = () => Math.floor((end.getTime() - Date.now()) / 1000)
    setRemainingSec(compute())
    const id = setInterval(() => {
      const left = compute()
      setRemainingSec(left)
      const isExpired = left <= 0
      setExpired(isExpired)
      if (isExpired && !autoSubmitRef.current) {
        autoSubmitRef.current = true
        submit()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  // save
  async function save(qid: string, patch: AnswerShape) {
    if (expiredRef.current) return
    setAnswers(prev => ({ ...prev, [qid]: { ...(prev[qid] ?? {}), ...patch } }))
    try {
      await fetch(`/api/exams/${attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qid, ...patch }),
      })
    } catch {
      setError('Gagal menyimpan jawaban. Cek koneksi.')
    }
  }

  // helpers
  const timeBadge = typeof remainingSec === 'number'
    ? `${String(Math.max(0, Math.floor(remainingSec / 60))).padStart(2, '0')}:${String(Math.max(0, remainingSec % 60)).padStart(2, '0')}`
    : null
  const critical = typeof remainingSec === 'number' && remainingSec <= 60 && remainingSec > 0

  function chooseSingle(qid: string, optionId: string) {
    save(qid, { selectedOptionIds: [optionId] })
  }
  function toggleMulti(qid: string, optionId: string) {
    const curr = answers[qid]?.selectedOptionIds ?? []
    const next = curr.includes(optionId) ? curr.filter(id => id !== optionId) : [...curr, optionId]
    save(qid, { selectedOptionIds: next })
  }
  function setText(qid: string, valueText: string) {
    save(qid, { valueText })
  }
  function setNumber(qid: string, value: string) {
    const n = value === '' ? null : Number(value)
    if (n !== null && !Number.isFinite(n)) return
    save(qid, { valueNumber: n })
  }

  async function submit() {
    if (!confirm('Apakah Anda yakin ingin menyelesaikan ujian ini sekarang?')) return

    setLoading(true)
    try {
      const r = await fetch(`/api/exams/${attemptId}/submit`, { method: 'POST' })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || 'Gagal submit')
      router.replace(`/exam/result/${attemptId}`)
    } catch (e: any) {
      setError(e.message ?? 'Gagal submit')
    } finally {
      setLoading(false)
    }
  }

  const answeredCount = Object.values(answers).filter(a =>
    (a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
    (typeof a.valueText === 'string' && a.valueText.trim() !== '') ||
    (typeof a.valueNumber === 'number')
  ).length
  const total = qs.length
  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0

  if (!attemptId) return <div className="p-10 text-center font-medium text-slate-500">URL Attempt tidak valid.</div>

  // loading skeleton
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-white/80 backdrop-blur-md px-6 py-4">
          <div className="mx-auto max-w-5xl flex items-center justify-between">
            <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
            <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
          </div>
        </header>
        <div className="mx-auto max-w-4xl p-6 space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <div className="h-6 w-3/4 bg-slate-100 rounded mb-4 animate-pulse" />
              <div className="space-y-3">
                <div className="h-10 w-full bg-slate-50 rounded animate-pulse" />
                <div className="h-10 w-full bg-slate-50 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    )
  }

  // error state
  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-lg shadow-red-500/5">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 ring-4 ring-red-50/50">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-slate-900">Terjadi Kesalahan</h1>
          <p className="mb-6 text-sm text-slate-600">{error}</p>
          <button
            onClick={() => location.reload()}
            className="w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:bg-red-700 hover:scale-[1.02] active:scale-[0.98]"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top Bar / Progress */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-4">

          {/* Left: Brand/Context */}
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Ujian Berjalan</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{answeredCount} dari {total} terjawab</span>
              </div>
            </div>
          </div>

          {/* Center: Timer (Desktop) */}
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 transform md:block">
            {typeof timeLimitMin === 'number' && (
              <div className={`flex items-center gap-2 rounded-full border px-4 py-1.5 shadow-sm transition-all ${expired
                ? 'border-red-200 bg-red-50 text-red-700'
                : critical
                  ? 'border-amber-200 bg-amber-50 text-amber-700 animate-pulse'
                  : 'border-slate-200 bg-white text-slate-700'
                }`}>
                <Clock className="h-4 w-4" />
                <span className="font-mono text-lg font-bold tracking-widest">{timeBadge}</span>
              </div>
            )}
          </div>

          {/* Right: Timer (Mobile) + Actions */}
          <div className="flex items-center gap-3">
            {/* Timer Mobile */}
            {typeof timeLimitMin === 'number' && (
              <div className={`md:hidden flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm font-bold ${expired ? 'border-red-200 bg-red-50 text-red-700' : critical ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700'
                }`}>
                <Clock className="h-3.5 w-3.5" />
                <span className="font-mono">{timeBadge}</span>
              </div>
            )}

            <button
              onClick={submit}
              className="hidden md:inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              Selesai & Kumpul
            </button>
          </div>

          {/* Progress Bar Bottom */}
          <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full">
            <div
              className="h-full bg-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Body */}
      <section className="mx-auto max-w-4xl p-6 pb-32 space-y-8">
        {qs.map((q) => {
          const isAnswered = !!answers[q.id]?.selectedOptionIds?.length || !!answers[q.id]?.valueText || (answers[q.id]?.valueNumber !== undefined && answers[q.id]?.valueNumber !== null);

          return (
            <div key={q.id}>
              {/* PASSAGE */}
              {q.passage && (
                <div className="mb-6 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm ring-1 ring-indigo-50">
                  <div className="flex items-center gap-2 bg-indigo-50/80 px-4 py-3 border-b border-indigo-100">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">BACAAN: {q.passage.title || 'Untitled'}</span>
                  </div>
                  <div className="p-5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-serif">
                    {q.passage.content}

                    {/* Passage Audio */}
                    {q.passage.audioUrl && (
                      <div className="mt-4 rounded-xl bg-indigo-50 border border-indigo-100 p-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Passage Audio</div>
                          <audio controls src={q.passage.audioUrl} className="w-full h-8" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SOAL CARD */}
              <div id={`q-${q.id}`} className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 ${isAnswered ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`}>
                {/* Status Indicator */}
                <div className={`absolute left-0 top-0 h-full w-1 ${isAnswered ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-200'}`} />

                <div className="p-6 md:p-8">
                  {/* Question Header */}
                  <div className="mb-6 flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
                      {q.order}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="text-lg font-medium text-slate-900 leading-relaxed max-w-none prose prose-indigo">
                        {q.text}
                      </div>

                      {q.imageUrl && (
                        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img
                            src={q.imageUrl}
                            alt={`Gambar soal ${q.order}`}
                            className="w-full object-contain max-h-[400px]"
                          />
                          <div className="absolute top-2 right-2 rounded-md bg-white/90 p-1.5 shadow-sm text-slate-500">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        </div>
                      )}

                      {/* Question Audio */}
                      {q.audioUrl && (
                        <div className="mt-2 mb-4 rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-white shrink-0">
                            <span className="font-bold text-xs">MP3</span>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Audio Soal</div>
                            <audio controls src={q.audioUrl} className="w-full h-8" />
                          </div>
                        </div>
                      )}

                      {q.contextText && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3 items-start">
                          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                          <div>{q.contextText}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ANSWER SECTION */}
                  <div className="pl-0 md:pl-14">

                    {/* SINGLE CHOICE */}
                    {q.type === 'SINGLE_CHOICE' && (
                      <div className="grid gap-3">
                        {q.options.map((o) => {
                          const checked = (answers[q.id]?.selectedOptionIds ?? [])[0] === o.id
                          return (
                            <label
                              key={o.id}
                              className={`
                                relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all
                                ${checked
                                  ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500 z-10'
                                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                                }
                                ${expired ? 'cursor-not-allowed opacity-60' : ''}
                              `}
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                                <input
                                  type="radio"
                                  disabled={expired}
                                  name={q.id}
                                  value={o.id}
                                  checked={checked}
                                  onChange={() => chooseSingle(q.id, o.id)}
                                  className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-600"
                                />
                              </div>
                              <div className="flex-1">
                                <span className={`inline-block font-bold mr-2 ${checked ? 'text-indigo-700' : 'text-slate-500'}`}>{o.label}.</span>
                                <span className={`${checked ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>{o.text}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {/* MULTI SELECT */}
                    {q.type === 'MULTI_SELECT' && (
                      <div className="grid gap-3">
                        {q.options.map((o) => {
                          const selected = (answers[q.id]?.selectedOptionIds ?? []).includes(o.id)
                          return (
                            <label
                              key={o.id}
                              className={`
                                relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all
                                ${selected
                                  ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500 z-10'
                                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                                }
                                ${expired ? 'cursor-not-allowed opacity-60' : ''}
                              `}
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                                <input
                                  type="checkbox"
                                  disabled={expired}
                                  checked={selected}
                                  onChange={() => toggleMulti(q.id, o.id)}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                                />
                              </div>
                              <div className="flex-1">
                                <span className={`inline-block font-bold mr-2 ${selected ? 'text-indigo-700' : 'text-slate-500'}`}>{o.label}.</span>
                                <span className={`${selected ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>{o.text}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {/* TRUE/FALSE */}
                    {q.type === 'TRUE_FALSE' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {q.options.map((o) => {
                          const checked = (answers[q.id]?.selectedOptionIds ?? [])[0] === o.id
                          return (
                            <label
                              key={o.id}
                              className={`
                                flex cursor-pointer flex-col items-center justify-center p-6 rounded-xl border-2 transition-all text-center gap-3
                                ${checked
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                                  : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-600'
                                }
                                ${expired ? 'cursor-not-allowed opacity-60' : ''}
                              `}
                            >
                              <input
                                type="radio"
                                disabled={expired}
                                name={q.id}
                                value={o.id}
                                checked={checked}
                                onChange={() => chooseSingle(q.id, o.id)}
                                className="sr-only"
                              />
                              <div className={`text-lg font-bold ${checked ? 'text-indigo-700' : 'text-slate-900'}`}>{o.text}</div>
                              {checked && <CheckCircle2 className="h-6 w-6 text-indigo-600" />}
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {/* TEXT INPUTS (SHORT & ESSAY) */}
                    {(q.type === 'SHORT_TEXT' || q.type === 'ESSAY') && (
                      <div className="relative">
                        <textarea
                          disabled={expired}
                          value={answers[q.id]?.valueText || ''}
                          rows={q.type === 'ESSAY' ? 5 : 2}
                          placeholder={q.type === 'ESSAY' ? "Tulis jawaban uraian Anda di sini..." : "Tulis jawaban singkat..."}
                          onChange={(e) => {
                            const v = e.target.value
                            setAnswers((prev) => ({ ...prev, [q.id]: { ...(prev[q.id] ?? {}), valueText: v } }))
                            if (!expiredRef.current) saveTextDebounced(q.id, v)
                          }}
                          className={`
                            block w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 transition-all
                            ${expired ? 'cursor-not-allowed opacity-60' : ''}
                          `}
                        />
                        <div className="absolute right-3 bottom-3">
                          {answers[q.id]?.valueText && !expired && <Save className="h-4 w-4 text-emerald-500 animate-pulse" />}
                        </div>
                      </div>
                    )}

                    {/* NUMBER & RANGE */}
                    {(q.type === 'NUMBER' || q.type === 'RANGE') && (
                      <div className="max-w-xs">
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                          {q.type === 'RANGE' ? `Masukkan nilai antara ${q.settings?.min} - ${q.settings?.max}` : 'Masukkan angka'}
                        </label>
                        <input
                          type="number"
                          value={answers[q.id]?.valueNumber ?? ''}
                          onChange={(e) => setNumber(q.id, e.target.value)}
                          disabled={expired}
                          placeholder="0"
                          className="block w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-lg font-mono text-slate-900 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 transition-all"
                        />
                        {q.type === 'RANGE' && q.settings?.step && (
                          <div className="mt-1 text-xs text-slate-400">Step: {q.settings.step}</div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* Floating Action Button (Mobile Only) */}
      <div className="fixed bottom-6 right-6 md:hidden z-40">
        <button
          onClick={submit}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl shadow-slate-900/20 active:scale-90 transition-transform"
        >
          <CheckCircle2 className="h-6 w-6" />
        </button>
      </div>

    </main >
  )
}
