/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  images: {
    domains: ['proscreen-recordings.s3.amazonaws.com', 's3.amazonaws.com'],
  },
};

module.exports = nextConfig;
