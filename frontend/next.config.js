const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  images: {
    domains: ['proscreen-recordings.s3.amazonaws.com', 's3.amazonaws.com'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@ffmpeg/ffmpeg': path.join(
        __dirname,
        'node_modules',
        '@ffmpeg',
        'ffmpeg',
        'dist',
        'umd',
        'ffmpeg.js'
      ),
    };
    return config;
  },
};

module.exports = nextConfig;
