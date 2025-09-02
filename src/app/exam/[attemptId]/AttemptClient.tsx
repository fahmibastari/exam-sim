// src/app/exam/[attemptId]/AttemptClient.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
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
}
type Payload = { questions: Question[]; timeLimitMin: number | null; endsAt: string | null } // NEW

type AnswerShape = {
  selectedOptionIds?: string[]
  valueText?: string
  valueNumber?: number | null
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
        setEndsAt(json.endsAt ?? null) // NEW
      } catch (e: any) {
        if (e.name !== 'AbortError') setError(e.message || 'Gagal memuat')
      } finally {
        setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [attemptId])

  useEffect(() => {
    if (!endsAt) {
      setRemainingSec(null)
      setExpired(false)
      return
    }
  
    const end = new Date(endsAt) // ✅ endsAt sudah dipastikan string, bukan null
    if (isNaN(end.getTime())) {
      // guard kalau ISO-nya aneh
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
  
  // Saat expired, jangan kirim answer lagi
  async function save(qid: string, patch: AnswerShape) {
    if (expired) return
    setAnswers(prev => ({ ...prev, [qid]: { ...(prev[qid] ?? {}), ...patch } }))
    try {
      await fetch(`/api/exams/${attemptId}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qid, ...patch }),
      })
    } catch {
      setError('Gagal menyimpan jawaban. Cek koneksi.')
    }
  }

  // Format mm:ss
  const timeBadge = typeof remainingSec === 'number'
    ? `${String(Math.max(0, Math.floor(remainingSec / 60))).padStart(2,'0')}:${String(Math.max(0, remainingSec % 60)).padStart(2,'0')}`
    : null

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-6">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="grid gap-3">
              <div className="h-20 bg-gray-100 rounded-xl" />
              <div className="h-20 bg-gray-100 rounded-xl" />
              <div className="h-20 bg-gray-100 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 border border-red-100">
          <h1 className="text-2xl font-bold text-red-700 mb-2">Ups, ada masalah</h1>
          <p className="text-red-700 text-sm mb-4">⚠️ {error}</p>
          <button
            onClick={() => location.reload()}
            className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold py-3"
          >
            Coba Muat Ulang
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header / Progress */}
      <div className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-blue-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-blue-700 tracking-tight flex items-center gap-2">
              <span aria-hidden>📝</span> Mengerjakan Ujian
            </h1>
{typeof timeLimitMin === 'number' && (
  <span className={`ml-2 inline-flex items-center rounded-full ${expired ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'} text-xs px-3 py-1 border`}>
    ⏱️ {timeBadge ?? `${timeLimitMin} menit`}
  </span>
)}

          </div>
          <div className="text-sm text-gray-600">
            Terjawab: <span className="font-semibold text-gray-800">{answeredCount}</span> / {total}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        {qs.map(q => (
          <div key={q.id} className="bg-white border border-blue-100 rounded-2xl p-4 md:p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <div className="shrink-0">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white font-bold">
                  {q.order}
                </span>
              </div>
              <div className="text-gray-900 font-medium leading-relaxed">{q.text}</div>
            </div>

            {q.imageUrl && (
              <div className="mb-4">
                <img
                  src={q.imageUrl}
                  alt={`Gambar pendukung soal ${q.order}`}
                  className="max-h-64 mx-auto object-contain rounded-xl border border-gray-200"
                />
              </div>
            )}

            {/* Render input sesuai tipe */}
            {q.type === 'SINGLE_CHOICE' && (
              <fieldset className="grid md:grid-cols-2 gap-3">
                {q.options.map(o => {
                  const checked = (answers[q.id]?.selectedOptionIds ?? [])[0] === o.id
                  return (
                    <label key={o.id} className={`cursor-pointer rounded-xl border p-3 md:p-4 flex gap-3 items-start transition
                      ${checked ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                      <input type="radio" disabled={expired} name={q.id} value={o.id} checked={checked} onChange={() => chooseSingle(q.id, o.id)} className="mt-1" />
                      <span className="text-gray-800"><span className="font-semibold">{o.label}.</span> {o.text}</span>
                    </label>
                  )
                })}
              </fieldset>
            )}

            {q.type === 'MULTI_SELECT' && (
              <fieldset className="grid md:grid-cols-2 gap-3">
                {q.options.map(o => {
                  const selected = (answers[q.id]?.selectedOptionIds ?? []).includes(o.id)
                  return (
                    <label key={o.id} className={`cursor-pointer rounded-xl border p-3 md:p-4 flex gap-3 items-start transition
                      ${selected ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                      <input type="checkbox" disabled={expired} checked={selected} onChange={() => toggleMulti(q.id, o.id)} className="mt-1" />
                      <span className="text-gray-800"><span className="font-semibold">{o.label}.</span> {o.text}</span>
                    </label>
                  )
                })}
              </fieldset>
            )}

            {q.type === 'TRUE_FALSE' && (
              <fieldset className="grid md:grid-cols-2 gap-3">
                {q.options.map(o => {
                  const checked = (answers[q.id]?.selectedOptionIds ?? [])[0] === o.id
                  return (
                    <label key={o.id} className={`cursor-pointer rounded-xl border p-3 md:p-4 flex gap-3 items-start transition
                      ${checked ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                      <input type="radio" disabled={expired} name={q.id} value={o.id} checked={checked} onChange={() => chooseSingle(q.id, o.id)} className="mt-1" />
                      <span className="text-gray-800">{o.text}</span>
                    </label>
                  )
                })}
              </fieldset>
            )}

            {(q.type === 'SHORT_TEXT' || q.type === 'ESSAY') && (
              <div>
                <textarea
                  rows={q.type === 'ESSAY' ? 6 : 3}
                  value={answers[q.id]?.valueText ?? ''}
                  onChange={(e) => setText(q.id, e.target.value)}
                  placeholder={q.type === 'ESSAY' ? 'Tulis jawaban esai kamu…' : 'Jawaban singkat…'}
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5"
                  disabled={expired}
                />
              </div>
            )}

            {q.type === 'NUMBER' && (
              <div className="max-w-sm">
                <input
                  type="number"
                  value={answers[q.id]?.valueNumber ?? ''}
                  onChange={(e) => setNumber(q.id, e.target.value)}
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5"
                  placeholder="Masukkan angka"
                  disabled={expired}
                />
              </div>
            )}

            {q.type === 'RANGE' && (
              <div className="max-w-sm grid gap-2">
                <input
                  type="number"
                  value={answers[q.id]?.valueNumber ?? ''}
                  onChange={(e) => setNumber(q.id, e.target.value)}
                  className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2.5"
                  placeholder={`Nilai antara ${(q.settings?.min ?? 'min')} – ${(q.settings?.max ?? 'max')}`}
                />
                <div className="text-xs text-gray-600">
                  Rentang: {q.settings?.min} – {q.settings?.max} {q.settings?.step ? `(step ${q.settings.step})` : ''}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Error inline (jika ada setelah submit gagal) */}
        {error && (
          <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            ⚠️ {error}
          </div>
        )}

        {/* Submit bar */}
        <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-blue-100">
          <div className="max-w-5xl mx-auto p-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="flex-1 text-sm text-gray-600">
                Pastikan semua jawaban sudah dipilih ya. Semangat! 🌟
              </div>
              <button
                onClick={submit}
                className="w-full md:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 shadow-md active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-blue-200"
              >
                Kirim Jawaban
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
