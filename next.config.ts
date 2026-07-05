import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Cache Components (Next 16): opt into PPR + `use cache` + instant-navigation
  // validation. The marketplace pages (home, vendor detail) prerender a static
  // shell; auth/booking routes stay dynamic via connection().
  cacheComponents: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
}

export default nextConfig
