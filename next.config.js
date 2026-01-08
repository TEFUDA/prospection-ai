/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  // Permettre l'import de fichiers JSON
  webpack: (config) => {
    config.resolve.extensions.push('.json')
    return config
  },
}

module.exports = nextConfig
