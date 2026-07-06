/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'face-api.js', 'tesseract.js']
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      encoding: false,
    }
    return config
  },
}
module.exports = nextConfig
