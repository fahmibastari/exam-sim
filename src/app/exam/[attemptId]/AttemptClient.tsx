'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Option = { id: string; label: string; text: string }
type Question = { id: string; order: number; text: string; imageUrl: string | null; options: Option[] }
type Payload = { questions: Question[]; timeLimitMin: number | null }

export default function AttemptClient({ attemptId }: { attemptId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [qs, setQs] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLimitMin, setTimeLimitMin] = useState<number | null>(null)
  const acRef = useRef<AbortController | null>(null)

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
      } catch (e: any) {
        if (e.name !== 'AbortError') setError(e.message || 'Gagal memuat')
      } finally {
        setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [attemptId])

  async function choose(qid: string, optionId: string) {
    setAnswers(prev => ({ ...prev, [qid]: optionId }))
    try {
      await fetch(`/api/exams/${attemptId}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qid, optionId })
      })
    } catch {}
  }

  async function submit() {
    setLoading(true)
    try {
      const r = await fetch(`/api/exams/${attemptId}/submit`, { method: 'POST' })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || 'Gagal submit')
  
      // ⬇️ setelah sukses, arahkan ke halaman hasil
      router.replace(`/exam/result/${attemptId}`)
    } catch (e: any) {
      setError(e.message ?? 'Gagal submit')
    } finally {
      setLoading(false)
    }
  }
  const answeredCount = Object.keys(answers).length
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
            onClick={() => router.refresh()}
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
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-xs px-3 py-1 border border-blue-200">
                ⏱️ Waktu: {timeLimitMin} menit
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
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white font-bold"
                  aria-label={`Soal nomor ${q.order}`}
                >
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

            <fieldset className="grid md:grid-cols-2 gap-3" aria-label={`Pilihan jawaban untuk soal ${q.order}`}>
              {q.options.map(o => {
                const checked = answers[q.id] === o.id
                return (
                  <label
                    key={o.id}
                    className={`cursor-pointer rounded-xl border p-3 md:p-4 flex gap-3 items-start transition
                      ${checked ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={o.id}
                      checked={checked}
                      onChange={() => choose(q.id, o.id)}
                      className="mt-1"
                    />
                    <span className="text-gray-800">
                      <span className="font-semibold">{o.label}.</span> {o.text}
                    </span>
                  </label>
                )
              })}
            </fieldset>
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
