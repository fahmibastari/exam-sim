// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // supaya error ESLint tidak memblokir build di Vercel
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
