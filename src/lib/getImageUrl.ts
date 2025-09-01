// src/lib/getImageUrl.ts
'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

const BUCKET = process.env.STORAGE_BUCKET || 'exam-images'
const IS_PUBLIC = (process.env.STORAGE_PUBLIC ?? 'true').toLowerCase() === 'true'

// Deteksi apakah string sudah merupakan URL penuh
function isFullUrl(s: string | null | undefined) {
  if (!s) return false
  return /^https?:\/\//i.test(s)
}

/**
 * getImageUrl
 * - PUBLIC bucket:
 *    - Jika input sudah URL => kembalikan apa adanya
 *    - Jika input path => kembalikan public URL dari path
 * - PRIVATE bucket:
 *    - Input harus path => generate signed URL (default 10 menit)
 */
export async function getImageUrl(
  pathOrUrl: string | null | undefined,
  opts?: { expiresIn?: number } // detik, default 600 (10 menit)
): Promise<string | null> {
  if (!pathOrUrl) return null

  const expiresIn = Math.max(5, opts?.expiresIn ?? 600) // minimal 5 detik

  // Kalau bucket public & input sudah URL penuh, langsung kembalikan
  if (IS_PUBLIC && isFullUrl(pathOrUrl)) {
    return pathOrUrl
  }

  // Kalau public & input path -> public URL dari path
  if (IS_PUBLIC && !isFullUrl(pathOrUrl)) {
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(pathOrUrl)
    return data.publicUrl
  }

  // PRIVATE bucket: harus generate signed URL dari path
  // (kalau input URL penuh, disarankan simpan path saja di DB. Tetapi kita coba ekstrak path-nya)
  let path = pathOrUrl
  if (isFullUrl(pathOrUrl)) {
    // Coba ambil path setelah ".../object/" atau setelah nama bucket
    try {
      const u = new URL(pathOrUrl)
      const segments = u.pathname.split('/')
      const idxObject = segments.indexOf('object')
      if (idxObject >= 0 && segments[idxObject + 1] === 'sign') {
        // signed url ada signature, tidak reliable untuk disimpan; pengguna seharusnya menyimpan path asli
        // Kita fallback: kembalikan apa adanya (bisa saja kadaluarsa)
        return pathOrUrl
      }
      // cari nama bucket dan sisanya sebagai path
      const idxBucket = segments.findIndex((s) => s === BUCKET)
      if (idxBucket >= 0) {
        path = decodeURIComponent(segments.slice(idxBucket + 1).join('/'))
      }
    } catch {
      // biarkan path tetap pathOrUrl
    }
  }

  const { data, error } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error) {
    console.error('createSignedUrl error:', error)
    return null
  }
  return data.signedUrl
}
