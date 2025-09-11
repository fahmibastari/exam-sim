// src/lib/evaluateAnswer.ts

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTI_SELECT'
  | 'TRUE_FALSE'
  | 'SHORT_TEXT'
  | 'ESSAY'
  | 'NUMBER'
  | 'RANGE'

export interface AnswerOption {
  id: string
  label: string   // 'A' | 'B' | 'C' | 'D' | 'E'
  text: string
  isCorrect: boolean
}

export interface Question {
  id: string
  type: QuestionType
  points: number
  required: boolean
  options: AnswerOption[]
  settings?: any | null // {target, tolerance} untuk NUMBER; {min,max,step} untuk RANGE; {caseSensitive,maxLength} untuk SHORT/ESSAY
}

export type RawAnswer = string | number | boolean | string[] | null | undefined

export interface EvalConfig {
  allowPartialCredit?: boolean
  /** penalti per opsi salah pada MULTI_SELECT, fraksi dari poin soal (mis. 0.25) */
  wrongPickPenaltyPerOption?: number
}

export interface PerQuestionResult {
  questionId: string
  type: QuestionType
  max: number
  score: number
  needsReview: boolean
  correct?: boolean
  feedback?: string
}

export interface SubmissionResult {
  totalScore: number
  totalMax: number
  needsReviewCount: number
  byQuestion: PerQuestionResult[]
}

/* ================= helpers ================= */

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function pickOptionByAny(q: Question, token: string | number | boolean) {
  const s = String(token).trim()
  // coba cocokan ke id dulu, kalau tidak ada baru ke label
  return (
    q.options.find(o => o.id === s) ??
    q.options.find(o => o.label.toUpperCase() === s.toUpperCase())
  )
}

/* ================= evaluator ================= */

export function evaluateSubmission(
  questions: Question[],
  answers: Record<string, RawAnswer>,
  cfg: EvalConfig = {}
): SubmissionResult {
  const allowPartial = cfg.allowPartialCredit ?? true
  const wrongPenalty = cfg.wrongPickPenaltyPerOption ?? 0 // 0.25 contoh umum

  const byQuestion: PerQuestionResult[] = []

  for (const q of questions) {
    const ans = answers[q.id]
    const max = Number(q.points ?? 0) || 0

    // jika required tapi tidak ada jawaban
    if (
      q.required &&
      (ans === null ||
        ans === undefined ||
        (Array.isArray(ans) && ans.length === 0) ||
        (typeof ans === 'string' && ans.trim() === ''))
    ) {
      byQuestion.push({
        questionId: q.id,
        type: q.type,
        max,
        score: 0,
        needsReview: false,
        correct: false,
        feedback: 'Tidak dijawab',
      })
      continue
    }

    // type-based
    if (q.type === 'SINGLE_CHOICE') {
      const picked = typeof ans === 'string' ? pickOptionByAny(q, ans) : undefined
      const correct = q.options.find(o => o.isCorrect)
      const isCorrect = !!picked && !!correct && picked.label === correct.label
      byQuestion.push({
        questionId: q.id,
        type: q.type,
        max,
        score: isCorrect ? max : 0,
        needsReview: false,
        correct: isCorrect,
      })
      continue
    }

    if (q.type === 'MULTI_SELECT') {
      const tokens =
        Array.isArray(ans) ? ans.map(String) : typeof ans === 'string' ? [ans] : []
      const pickedIds = new Set(
        tokens
          .map(t => pickOptionByAny(q, t))
          .filter(Boolean)
          .map(o => (o as AnswerOption).id)
      )
      const correctOpts = q.options.filter(o => o.isCorrect)
      const correctIds = new Set(correctOpts.map(o => o.id))

      const truePos = [...pickedIds].filter(id => correctIds.has(id)).length
      const falsePos = [...pickedIds].filter(id => !correctIds.has(id)).length

      const allMatch =
        truePos === correctIds.size && falsePos === 0 && pickedIds.size === correctIds.size

      let score = 0
      if (allowPartial && correctIds.size > 0) {
        const portion = truePos / correctIds.size
        score = portion * max - wrongPenalty * falsePos * max
      } else {
        score = allMatch ? max : 0
      }
      score = clamp(score, 0, max)

      byQuestion.push({
        questionId: q.id,
        type: q.type,
        max,
        score,
        needsReview: false,
        correct: allMatch,
      })
      continue
    }

    if (q.type === 'TRUE_FALSE') {
      const correctIsTrue =
        q.options.find(o => o.isCorrect && o.label === 'A') ||
        (q.options.find(o => o.isCorrect)?.text ?? '').toUpperCase() === 'TRUE'
      let pickedTrue = false

      if (typeof ans === 'string') {
        const s = ans.trim().toUpperCase()
        if (s === 'TRUE' || s === 'FALSE') pickedTrue = s === 'TRUE'
        else {
          const opt = pickOptionByAny(q, ans)
          pickedTrue = !!opt && opt.label === 'A'
        }
      } else if (typeof ans === 'boolean') {
        pickedTrue = ans
      }

      const isCorrect = Boolean(correctIsTrue) === pickedTrue
      byQuestion.push({
        questionId: q.id,
        type: q.type,
        max,
        score: isCorrect ? max : 0,
        needsReview: false,
        correct: isCorrect,
      })
      continue
    }

    if (q.type === 'NUMBER') {
      const target = q.settings?.target
      const tol = Number(q.settings?.tolerance ?? 0)
      if (typeof target !== 'number') {
        byQuestion.push({
          questionId: q.id,
          type: q.type,
          max,
          score: 0,
          needsReview: true,
          feedback: 'Target number tidak diset',
        })
        continue
      }
      const val =
        typeof ans === 'number'
          ? ans
          : typeof ans === 'string' && ans.trim() !== ''
          ? Number(ans)
          : NaN
      const isCorrect = Number.isFinite(val) && Math.abs(val - target) <= Math.max(0, tol)
      byQuestion.push({
        questionId: q.id,
        type: q.type,
        max,
        score: isCorrect ? max : 0,
        needsReview: false,
        correct: isCorrect,
      })
      continue
    }

    // RANGE / SHORT_TEXT / ESSAY -> default manual review
    // (karena tidak ada "jawaban benar" di schema)
    if (q.type === 'RANGE' || q.type === 'SHORT_TEXT' || q.type === 'ESSAY') {
      byQuestion.push({
        questionId: q.id,
        type: q.type,
        max,
        score: 0,
        needsReview: true,
      })
      continue
    }

    // fallback
    byQuestion.push({
      questionId: q.id,
      type: q.type,
      max,
      score: 0,
      needsReview: true,
      feedback: 'Tipe tidak dikenali',
    })
  }

  const totalScore = byQuestion.reduce((s, r) => s + r.score, 0)
  const totalMax = byQuestion.reduce((s, r) => s + r.max, 0)
  const needsReviewCount = byQuestion.filter(r => r.needsReview).length

  return { totalScore, totalMax, needsReviewCount, byQuestion }
}
