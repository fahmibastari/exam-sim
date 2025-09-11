'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = {
  answerId: string
  questionLabel: string
  maxPoints: number
  currentScore: number
}

export default function GradeForm({
  attemptId,
  rows,
}: {
  attemptId: string
  rows: Row[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(rows.map(r => [r.answerId, r.currentScore ?? 0]))
  )

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const updates = rows.map(r => ({
        answerId: r.answerId,
        score: Number(values[r.answerId] ?? 0),
      }))
      const res = await fetch(`/api/admin/attempts/${attemptId}/grade`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Gagal menyimpan')
      }
      router.refresh()
    } catch (e: any) {
      setErr(e.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {rows.length === 0 && (
        <div className="text-sm text-gray-500">Tidak ada jawaban yang perlu dinilai.</div>
      )}

      {rows.map(r => (
        <div key={r.answerId} className="grid gap-2 rounded-lg border p-3">
          <div className="text-sm font-medium text-gray-900">{r.questionLabel}</div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-700">Skor:</label>
            <input
              type="number"
              step="0.5"
              min={0}
              max={r.maxPoints}
              value={values[r.answerId] ?? 0}
              onChange={e =>
                setValues(v => ({ ...v, [r.answerId]: Number(e.target.value) }))
              }
              className="w-28 rounded border px-2 py-1"
            />
            <span className="text-gray-500">/ {r.maxPoints}</span>
          </div>
        </div>
      ))}

      {err && <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}

      <button
        disabled={saving || rows.length === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Menyimpan…' : 'Simpan nilai'}
      </button>
    </form>
  )
}
