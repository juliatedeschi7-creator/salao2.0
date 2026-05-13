/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    domains: ['uhsvfbebjfeedpeznjnf.supabase.co'],
  },
}

module.exports = nextConfig
