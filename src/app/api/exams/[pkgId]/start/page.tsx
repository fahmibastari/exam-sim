export const runtime = 'nodejs'

import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'

export default async function StartExamPage({
  params,
}: { params: Promise<{ pkgId: string }> }) {
  const { pkgId } = await params
  const pkg = await prisma.examPackage.findUnique({
    where: { id: pkgId },
    select: { id: true, title: true, timeLimitMin: true, description: true },
  })
  if (!pkg) notFound()

const safePkgId = pkg.id

  async function startAttempt(formData: FormData) {
    'use server'
    const participantName = String(formData.get('name') ?? '').trim() || null
    const participantEmail = String(formData.get('email') ?? '').trim() || null
    const participantInfo = String(formData.get('info') ?? '').trim() || null

    const attempt = await prisma.attempt.create({
      data: {
        examPackageId: safePkgId,
        participantName,
        participantEmail,
        participantInfo,
        startedAt: new Date(),
      },
      select: { id: true },
    })
    redirect(`/exam/${attempt.id}`)
  }

  const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <h1 className="text-2xl font-bold">{pkg.title}</h1>
        {typeof pkg.timeLimitMin === 'number' && <p className="text-sm text-gray-600">Batas waktu: <b>{pkg.timeLimitMin} menit</b></p>}
        {pkg.description && <div className="rounded-xl border bg-white p-4 text-gray-800 whitespace-pre-wrap">{pkg.description}</div>}

        <form action={startAttempt} className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
          <div><label className="mb-1 block text-sm font-medium">Nama (opsional)</label><input name="name" className={input} /></div>
          <div><label className="mb-1 block text-sm font-medium">Email (opsional)</label><input name="email" type="email" className={input} /></div>
          <div><label className="mb-1 block text-sm font-medium">Info (opsional)</label><input name="info" className={input} placeholder="Kelas / NIS / catatan" /></div>
          <button className="mt-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Mulai Ujian</button>
        </form>
      </section>
    </main>
  )
}
