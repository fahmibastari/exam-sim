// src/app/exam/[attemptId]/AttemptClient.tsx
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

type Option = { id: string; label: string; text: string }
type Question = {
  id: string
  order: number
  text: string
  imageUrl: string | null
  type: 'SINGLE_CHOICE'|'MULTI_SELECT'|'TRUE_FALSE'|'SHORT_TEXT'|'ESSAY'|'NUMBER'|'RANGE'
  settings?: any
  options: Option[]
  contextText?: string | null                      // ⬅️ baru
  passage?: { id: string; title: string | null; content: string } | null // ⬅️ baru
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
    ;(async () => {
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
    ? `${String(Math.max(0, Math.floor(remainingSec / 60))).padStart(2,'0')}:${String(Math.max(0, remainingSec % 60)).padStart(2,'0')}`
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

  if (!attemptId) return <div className="p-6">Attempt tidak valid.</div>

  // loading skeleton
  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-1/3 rounded bg-gray-200" />
              <div className="h-4 w-1/2 rounded bg-gray-200" />
              <div className="grid gap-3">
                <div className="h-20 rounded-xl bg-gray-100" />
                <div className="h-20 rounded-xl bg-gray-100" />
                <div className="h-20 rounded-xl bg-gray-100" />
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }

  // error state
  if (error) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <section className="mx-auto max-w-lg px-6 py-10">
          <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
            <h1 className="mb-2 text-2xl font-bold text-red-700">Terjadi Kesalahan</h1>
            <p className="mb-4 text-sm text-red-700">{error}</p>
            <button
              onClick={() => location.reload()}
              className="w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Muat Ulang
            </button>
          </div>
        </section>
      </main>
    )
  }

  const cardCls =
    'rounded-2xl bg-white p-4 md:p-6 shadow-sm ring-1 ring-gray-200'
  const selectCls =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'
  const optWrap = (active: boolean) =>
    `cursor-pointer rounded-xl border p-3 md:p-4 flex gap-3 items-start transition ${
      active ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
    }`

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Top Bar / Progress */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-blue-600 to-blue-400" />
            <h1 className="text-base md:text-lg font-semibold text-gray-900">Mengerjakan Ujian</h1>
            {typeof timeLimitMin === 'number' && (
              <span
                className={`ml-2 inline-flex items-center rounded-full border px-3 py-1 text-xs ${
                  expired
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : critical
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {timeBadge ?? `${timeLimitMin} menit`}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600">
            Terjawab: <span className="font-semibold text-gray-800">{answeredCount}</span> / {total}
          </div>
        </div>
      </header>

      {/* Body */}
      <section className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        {(() => {
          const renderedPassages = new Set<string>()
          return qs.map((q) => (
            <div key={q.id}>
              {/* PASSAGE (sekali di atas grup terkait) */}
              {q.passage && !renderedPassages.has(q.passage.id) && (
                <>
                  <div className={cardCls}>
                    <div className="mb-2 text-sm font-semibold text-gray-900">
                      {q.passage.title ?? 'Reading'}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                      {q.passage.content}
                    </div>
                  </div>
                  {renderedPassages.add(q.passage.id) && null}
                </>
              )}

              {/* KARTU SOAL */}
              <div className={cardCls}>
                <div className="mb-3 flex items-start gap-3">
                  <div className="shrink-0">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                      {q.order}
                    </span>
                  </div>
                  <div className="font-medium leading-relaxed text-gray-900">{q.text}</div>
                </div>

                {q.imageUrl && (
                  <div className="mb-4">
                    <img
                      src={q.imageUrl}
                      alt={`Gambar pendukung soal ${q.order}`}
                      className="mx-auto max-h-64 rounded-xl border border-gray-200 object-contain"
                    />
                  </div>
                )}

                {/* CONTEXT TEXT (opsional) */}
                {q.contextText && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {q.contextText}
                  </div>
                )}

                {/* Render input sesuai tipe */}
                {q.type === 'SINGLE_CHOICE' && (
                  <fieldset className="grid gap-3 md:grid-cols-2">
                    {q.options.map((o) => {
                      const checked = (answers[q.id]?.selectedOptionIds ?? [])[0] === o.id
                      return (
                        <label key={o.id} className={optWrap(checked)}>
                          <input
                            type="radio"
                            disabled={expired}
                            name={q.id}
                            value={o.id}
                            checked={checked}
                            onChange={() => chooseSingle(q.id, o.id)}
                            className="mt-1"
                          />
                          <span className="text-gray-800">
                            <span className="font-semibold">{o.label}.</span> {o.text}
                          </span>
                        </label>
                      )
                    })}
                  </fieldset>
                )}

                {q.type === 'MULTI_SELECT' && (
                  <fieldset className="grid gap-3 md:grid-cols-2">
                    {q.options.map((o) => {
                      const selected = (answers[q.id]?.selectedOptionIds ?? []).includes(o.id)
                      return (
                        <label key={o.id} className={optWrap(selected)}>
                          <input
                            type="checkbox"
                            disabled={expired}
                            checked={selected}
                            onChange={() => toggleMulti(q.id, o.id)}
                            className="mt-1"
                          />
                          <span className="text-gray-800">
                            <span className="font-semibold">{o.label}.</span> {o.text}
                          </span>
                        </label>
                      )
                    })}
                  </fieldset>
                )}

                {q.type === 'TRUE_FALSE' && (
                  <fieldset className="grid gap-3 md:grid-cols-2">
                    {q.options.map((o) => {
                      const checked = (answers[q.id]?.selectedOptionIds ?? [])[0] === o.id
                      return (
                        <label key={o.id} className={optWrap(checked)}>
                          <input
                            type="radio"
                            disabled={expired}
                            name={q.id}
                            value={o.id}
                            checked={checked}
                            onChange={() => chooseSingle(q.id, o.id)}
                            className="mt-1"
                          />
                          <span className="text-gray-800">{o.text}</span>
                        </label>
                      )
                    })}
                  </fieldset>
                )}

                {(q.type === 'SHORT_TEXT' || q.type === 'ESSAY') && (
                  <div>
                    <textarea
                      disabled={expired}
                      value={answers[q.id]?.valueText || ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setAnswers((prev) => ({ ...prev, [q.id]: { ...(prev[q.id] ?? {}), valueText: v } }))
                        if (!expiredRef.current) saveTextDebounced(q.id, v)
                      }}
                      className={selectCls}
                    />
                  </div>
                )}

                {q.type === 'NUMBER' && (
                  <div className="max-w-sm">
                    <input
                      type="number"
                      value={answers[q.id]?.valueNumber ?? ''}
                      onChange={(e) => setNumber(q.id, e.target.value)}
                      className={selectCls}
                      placeholder="Masukkan angka"
                      disabled={expired}
                    />
                  </div>
                )}

                {q.type === 'RANGE' && (
                  <div className="grid max-w-sm gap-2">
                    <input
                      type="number"
                      value={answers[q.id]?.valueNumber ?? ''}
                      onChange={(e) => setNumber(q.id, e.target.value)}
                      className={selectCls}
                      placeholder={`Nilai antara ${q.settings?.min ?? 'min'} – ${q.settings?.max ?? 'max'}`}
                      disabled={expired}
                    />
                    <div className="text-xs text-gray-600">
                      Rentang: {q.settings?.min} – {q.settings?.max}{' '}
                      {q.settings?.step ? `(step ${q.settings.step})` : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        })()}
        {/* Error inline */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Submit bar */}
        <div className="sticky bottom-0 border-t bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-5xl p-4">
            <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
              <div className="flex-1 text-sm text-gray-600">
                Periksa kembali jawaban sebelum mengirimkan.
              </div>
              <button
                onClick={submit}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:w-auto"
              >
                Kirim Jawaban
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
