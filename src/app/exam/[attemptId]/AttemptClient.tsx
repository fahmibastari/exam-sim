// src/app/exam/[attemptId]/AttemptClient.tsx
'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
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
  AlertTriangle,
  PlayCircle
} from 'lucide-react'

type Option = { id: string; label: string; text: string }
type Question = {
  id: string
  order: number
  text: string
  imageUrl: string | null
  audioUrl: string | null
  type: 'SINGLE_CHOICE' | 'MULTI_SELECT' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'ESSAY' | 'NUMBER' | 'RANGE'
  points: number
  required: boolean
  settings?: any
  options: Option[]
  contextText?: string | null
  passage?: { id: string; title: string | null; content: string; audioUrl: string | null; order: number } | null
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

// Group structure
type SectionGroup = {
  id: string
  passage: Question['passage'] | null
  questions: Question[]
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
  const [endsAt, setEndsAt] = useState<string | null>(null)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  const [expired, setExpired] = useState(false)

  const acRef = useRef<AbortController | null>(null)
  const autoSubmitRef = useRef(false)
  const expiredRef = useRef(false)

  // UX State
  const [isOnline, setIsOnline] = useState(true)

  // 1. Exit Protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Chrome requires returnValue to be set
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // 2. Offline Detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    // Init check
    setIsOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  useEffect(() => { expiredRef.current = expired }, [expired])

  // Debounced save
  const saveTextDebounced = useRef(
    debounce((qid: string, valueText: string) => {
      save(qid, { valueText })
    }, 450)
  ).current

  // Load Questions
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

  // Timer Logic
  useEffect(() => {
    if (!endsAt) {
      setRemainingSec(null)
      setExpired(false)
      return
    }
    const tick = () => {
      const now = Date.now()
      const end = new Date(endsAt).getTime()
      const diff = Math.floor((end - now) / 1000)
      if (diff <= 0) {
        setRemainingSec(0)
        setExpired(true)
        if (!autoSubmitRef.current) {
          autoSubmitRef.current = true
          submit()
        }
      } else {
        setRemainingSec(diff)
      }
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [endsAt])

  // Save Answer
  async function save(qid: string, val: AnswerShape) {
    if (expiredRef.current) return
    try {
      await fetch(`/api/exams/${attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qid, ...val })
      })
    } catch (e) { console.error('Auto-save err', e) }
  }

  // Answer Handlers
  const chooseSingle = (qid: string, oid: string) => {
    if (expired) return
    const val = { selectedOptionIds: [oid] }
    setAnswers(p => ({ ...p, [qid]: { ...p[qid], ...val } }))
    save(qid, val)
  }

  const toggleMulti = (qid: string, oid: string) => {
    if (expired) return
    setAnswers(p => {
      const prevIds = p[qid]?.selectedOptionIds ?? []
      const newIds = prevIds.includes(oid) ? prevIds.filter(x => x !== oid) : [...prevIds, oid]
      const val = { selectedOptionIds: newIds }
      save(qid, val)
      return { ...p, [qid]: { ...p[qid], ...val } }
    })
  }

  const setNumber = (qid: string, vStr: string) => {
    if (expired) return
    const vNum = vStr === '' ? null : Number(vStr)
    setAnswers(p => ({ ...p, [qid]: { ...p[qid], valueNumber: vNum } }))
    save(qid, { valueNumber: vNum })
  }

  // Submit Handler
  const [submitting, setSubmitting] = useState(false)
  async function submit() {
    if (submitting) return
    if (!confirm('Kumpulkan ujian sekarang?')) return
    setSubmitting(true)
    try {
      await fetch(`/api/exams/${attemptId}/finish`, { method: 'POST' })
      router.push(`/exam/result/${attemptId}`)
    } catch (e) {
      alert('Gagal submit, coba lagi')
      setSubmitting(false)
    }
  }

  // --- GROUPING LOGIC ---
  const sections = useMemo(() => {
    const groups: SectionGroup[] = []

    // Group by passageId
    const map = new Map<string, SectionGroup>()

    // Helper to get or create group
    const getGroup = (passage: Question['passage'] | null): SectionGroup => {
      if (!passage) {
        // Standalone questions go into a specific "orphaned" group or individual groups?
        // Let's create a virtual group for all orphans for simplicity, OR grouping by sequential runs.
        // Better: Group consecutive questions with same passage. 
        // Simple approach: One group per passage, one group for 'no passage'.
        // Actually, we usually want mixed order preserved. 
        // But if sections are strictly ordered by passage order, we should respect that.

        // Re-think: Is `questions` already sorted by `order`? Yes.
        // If we have mixed Passage A, Passage B, No Passage, Passage A... that would be weird.
        // Assuming questions are sorted by their own order, and typically they group themselves.
        // But let's build explicit groups based on the `passageId` key.
        const key = 'orphaned'
        if (!map.has(key)) map.set(key, { id: key, passage: null, questions: [] })
        return map.get(key)!
      }
      const key = passage.id
      if (!map.has(key)) map.set(key, { id: key, passage, questions: [] })
      return map.get(key)!
    }

    qs.forEach(q => {
      const g = getGroup(q.passage)
      g.questions.push(q)
    })

    // Now sort groups. 
    // If we want to follow the "First Question's Order" or "Passage Order".
    // Let's sort groups based on the `order` of their *first question* or `passage.order`.
    // API `route.ts` sorts questions by `order`. 
    // We can just iterate `qs` and build sequential groups to preserve the exact question flow.
    // This handles: Q1(P1), Q2(P1), Q3(NoP), Q4(P2).

    const sequentialGroups: SectionGroup[] = []
    let currentGroup: SectionGroup | null = null

    qs.forEach(q => {
      const pId = q.passage?.id ?? 'none'

      // If current group exists and matches this question's passage, add to it
      if (currentGroup && (currentGroup.passage?.id ?? 'none') === pId) {
        currentGroup.questions.push(q)
      } else {
        // Start new group
        currentGroup = {
          id: pId === 'none' ? `g-${q.id}` : pId,
          passage: q.passage ?? null,
          questions: [q]
        }
        sequentialGroups.push(currentGroup)
      }
    })

    return sequentialGroups
  }, [qs])


  // Render Helpers
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="font-medium text-slate-500 animate-pulse">Memuat Ujian...</p>
      </div>
    </div>
  )
  if (error) return <div className="p-8 text-center text-rose-600 font-bold">Error: {error}</div>

  const answeredCount = Object.keys(answers).length
  const totalQs = qs.length
  const progress = Math.round((answeredCount / totalQs) * 100) || 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans text-slate-900 dark:text-slate-100 selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900 dark:selection:text-indigo-100">

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 border-b border-indigo-100 dark:border-indigo-900/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md shadow-sm">

        {/* Offline Alert Banner */}
        {!isOnline && (
          <div className="bg-rose-600 text-white text-center py-2 text-sm font-bold animate-pulse">
            <AlertTriangle className="inline-block h-4 w-4 mr-2 mb-0.5" />
            Koneksi Internet Terputus! Jangan tutup halaman atau refresh.
          </div>
        )}

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 border border-indigo-100 dark:border-indigo-800">
              <LayoutDashboard className="h-5 w-5 text-indigo-600" />
              <span className="font-bold text-indigo-900 text-sm hidden sm:inline">Ujian Online</span>
            </div>
            {/* Progress Bar (Desktop) */}
            <div className="hidden md:flex flex-col gap-1 w-32">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Timer */}
            {remainingSec !== null && (
              <div className={`
                        flex items-center gap-2 rounded-full px-4 py-1.5 border font-mono font-bold text-lg shadow-sm transition-colors
                        ${remainingSec < 60 ? 'border-rose-200 bg-rose-50 text-rose-600 animate-pulse' :
                  remainingSec < 300 ? 'border-amber-200 bg-amber-50 text-amber-600' :
                    'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}
                    `}>
                <Clock className="h-4 w-4" />
                <span>{fmtTime(remainingSec)}</span>
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting || expired}
              className="hidden sm:inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Menyimpan...' : 'Selesai'}
              <CheckCircle2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Mobile Progress Line */}
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 md:hidden">
          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>


      {/* --- MAIN CONTENT --- */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 space-y-8">

        {sections.map((section, idx) => (
          <div key={section.id} className="animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${idx * 100}ms` }}>

            {section.passage ? (
              // --- SPLIT VIEW (PASSAGE + QUESTIONS) ---
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">

                {/* LEFT PANEL: PASSAGE */}
                <div className="lg:sticky lg:top-24 space-y-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-sm overflow-hidden ring-4 ring-slate-50/50 dark:ring-slate-800/50">
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50 p-4 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="font-bold text-indigo-900 dark:text-indigo-200">{section.passage.title || 'Bacaan'}</h3>
                    </div>

                    <div className="p-6 text-slate-700 dark:text-slate-300 leading-relaxed font-serif text-lg whitespace-pre-wrap max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-100 dark:scrollbar-thumb-slate-700">
                      {section.passage.content}
                    </div>

                    {section.passage.audioUrl && (
                      <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white"><PlayCircle className="h-4 w-4" /></div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audio Section</span>
                        </div>
                        <audio controls src={section.passage.audioUrl} className="w-full h-10 rounded-lg shadow-sm" />
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT PANEL: QUESTIONS */}
                <div className="space-y-6">
                  {section.questions.map(q => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      answers={answers}
                      expired={expired}
                      onAnswer={val => {
                        setAnswers(p => ({ ...p, [q.id]: { ...p[q.id], ...val } }))
                        save(q.id, val) // simplified save triggers logic inside QuestionCard actually not needed here if we pass setters
                      }}
                      chooseSingle={chooseSingle}
                      toggleMulti={toggleMulti}
                      setNumber={setNumber}
                      saveTextDebounced={saveTextDebounced} // pass ref
                    />
                  ))}
                </div>

              </div>
            ) : (
              // --- SINGLE COLUMN (STANDALONE QUESTIONS) ---
              <div className="space-y-6 max-w-3xl mx-auto">
                {section.questions.map(q => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    answers={answers}
                    expired={expired}
                    onAnswer={() => { }}
                    chooseSingle={chooseSingle}
                    toggleMulti={toggleMulti}
                    setNumber={setNumber}
                    saveTextDebounced={saveTextDebounced}
                  />
                ))}
              </div>
            )}

          </div>
        ))}

      </main>

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={submit}
        disabled={submitting || expired}
        className="fixed bottom-6 right-6 md:hidden z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 active:scale-95 transition-transform"
      >
        <CheckCircle2 className="h-6 w-6" />
      </button>

    </div>
  )
}

// --- SUB-COMPONENT: QUESTION CARD ---
function QuestionCard({
  q, answers, expired, chooseSingle, toggleMulti, setNumber, saveTextDebounced
}: {
  q: Question
  answers: Record<string, AnswerShape>
  expired: boolean
  onAnswer: (v: any) => void
  chooseSingle: (qid: string, oid: string) => void
  toggleMulti: (qid: string, oid: string) => void
  setNumber: (qid: string, v: string) => void
  saveTextDebounced: (qid: string, v: string) => void
}) {
  // Determine status
  const isAnswered = answers[q.id]?.selectedOptionIds?.length || answers[q.id]?.valueText || answers[q.id]?.valueNumber != null

  return (
    <div id={`q-${q.id}`} className={`
            group relative scroll-mt-24 rounded-2xl border bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm transition-all duration-300
            ${isAnswered ? 'border-indigo-200 dark:border-indigo-900 shadow-indigo-100/50 dark:shadow-none' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'}
        `}>

      {/* Question Header */}
      <div className="flex gap-4 mb-6">
        <div className={`
                    flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm transition-colors
                    ${isAnswered ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}
                `}>
          {q.order}
        </div>
        <div className="flex-1 space-y-3">
          {/* Tags */}
          <div className="flex items-center gap-2">
            {q.required && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-900">WAJIB</span>}
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-700">{q.points} Poin</span>
          </div>

          {/* Question Text */}
          <div className="text-lg font-medium text-slate-900 dark:text-slate-100 leading-snug">
            {q.text}
          </div>

          {/* Media */}
          {q.imageUrl && (
            <div className="relative mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <img src={q.imageUrl} alt="Lampiran Soal" className="w-full object-contain max-h-[400px]" />
            </div>
          )}
          {q.audioUrl && (
            <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center shrink-0"><PlayCircle className="h-4 w-4" /></div>
              <audio controls src={q.audioUrl} className="w-full h-8" />
            </div>
          )}
          {q.contextText && (
            <div className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <p>{q.contextText}</p>
            </div>
          )}
        </div>
      </div>

      {/* Answer Area */}
      <div className="pl-0 sm:pl-14">

        {/* SINGLE CHOICE */}
        {q.type === 'SINGLE_CHOICE' && (
          <div className="space-y-3">
            {q.options.map(o => {
              const checked = (answers[q.id]?.selectedOptionIds ?? [])[0] === o.id
              return (
                <label key={o.id} className={`
                            relative flex cursor-pointer items-start gap-4 p-4 rounded-xl border transition-all
                            ${checked ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-1 ring-indigo-500 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}
                            ${expired ? 'opacity-60 cursor-not-allowed' : ''}
                        `}>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center mt-0.5">
                    <input type="radio" name={q.id} value={o.id} checked={checked} onChange={() => chooseSingle(q.id, o.id)} disabled={expired} className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <span className={`inline-block font-bold mr-2 ${checked ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>{o.label}.</span>
                    <span className={`${checked ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-600 dark:text-slate-300'}`}>{o.text}</span>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        {/* MULTI SELECT */}
        {q.type === 'MULTI_SELECT' && (
          <div className="space-y-3">
            {q.options.map(o => {
              const selected = (answers[q.id]?.selectedOptionIds ?? []).includes(o.id)
              return (
                <label key={o.id} className={`
                            relative flex cursor-pointer items-start gap-4 p-4 rounded-xl border transition-all
                            ${selected ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-1 ring-indigo-500 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}
                            ${expired ? 'opacity-60 cursor-not-allowed' : ''}
                        `}>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center mt-0.5">
                    <input type="checkbox" checked={selected} onChange={() => toggleMulti(q.id, o.id)} disabled={expired} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <span className={`inline-block font-bold mr-2 ${selected ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>{o.label}.</span>
                    <span className={`${selected ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-600 dark:text-slate-300'}`}>{o.text}</span>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        {/* SHORT TEXT / ESSAY */}
        {(q.type === 'SHORT_TEXT' || q.type === 'ESSAY') && (
          <div className="relative">
            <textarea
              disabled={expired}
              rows={q.type === 'ESSAY' ? 5 : 2}
              placeholder={q.type === 'ESSAY' ? "Tulis jawaban uraian..." : "Jawaban singkat..."}
              className={`
                                block w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
                                shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500
                                sm:text-sm placeholder:text-slate-400
                                ${answers[q.id]?.valueText ? 'bg-indigo-50/10 border-indigo-300 dark:border-indigo-800' : ''}
                            `}
              defaultValue={answers[q.id]?.valueText || ''}
              onChange={(e) => saveTextDebounced(q.id, e.target.value)}
            />
            <div className="absolute right-3 bottom-3 pointer-events-none">
              {answers[q.id]?.valueText && !expired && <Save className="h-4 w-4 text-emerald-500 animate-pulse" />}
            </div>
          </div>
        )}

        {/* TRUE/FALSE */}
        {q.type === 'TRUE_FALSE' && (
          <div className="grid grid-cols-2 gap-4">
            {q.options.map(o => {
              const checked = (answers[q.id]?.selectedOptionIds ?? [])[0] === o.id
              return (
                <label key={o.id} className={`
                                    cursor-pointer flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center transition-all
                                    ${checked ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300'}
                                    ${expired ? 'opacity-60 cursor-not-allowed' : ''}
                                `}>
                  <input type="radio" name={q.id} value={o.id} checked={checked} onChange={() => chooseSingle(q.id, o.id)} disabled={expired} className="sr-only" />
                  <span className="font-bold">{o.text}</span>
                </label>
              )
            })}
          </div>
        )}

        {/* NUMBER / RANGE */}
        {(q.type === 'NUMBER' || q.type === 'RANGE') && (
          <div className="max-w-xs">
            <input
              type="number"
              disabled={expired}
              placeholder="0"
              className="block w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-lg font-mono"
              value={answers[q.id]?.valueNumber ?? ''}
              onChange={(e) => setNumber(q.id, e.target.value)}
            />
            {q.type === 'RANGE' && <p className="mt-1 text-xs text-slate-400">Range: {q.settings?.min} - {q.settings?.max}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
