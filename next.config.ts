import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true }, // <— hanya jika kamu butuh sekali lolos deploy
}
export default nextConfig
