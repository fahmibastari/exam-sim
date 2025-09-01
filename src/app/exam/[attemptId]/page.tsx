import { use } from 'react'
import AttemptClient from './AttemptClient'

// ⬇️ params adalah Promise — unwrap pakai React.use()
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
    const { attemptId } = await params
    return <AttemptClient attemptId={attemptId} />
  }
  