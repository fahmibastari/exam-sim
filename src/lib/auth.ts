import { getServerSession } from 'next-auth'
import { authOptions } from './authOptions'

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }
  return session
}
