import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/authOptions'

export default async function PostLogin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const role = (session.user as any).role
  redirect(role === 'ADMIN' ? '/admin/packages' : '/exam/join')
}
