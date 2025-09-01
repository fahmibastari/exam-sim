// src/lib/auth.ts
import { getServerSession } from "next-auth"
export async function requireAdmin() {
  const session = await getServerSession()
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    throw new Error("Unauthorized")
  }
  return session
}
