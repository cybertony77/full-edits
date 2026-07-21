/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  devIndicators: false,
  // Keep next/image unoptimized for now (we serve Cloudinary URLs that already
  // expose their own CDN-level optimizations). `remotePatterns` is still
  // declared so we can flip `unoptimized` off later without code changes.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
    domains: ['localhost', '192.168.1.8'],
  },
  // Workaround for Windows + Turbopack file watching latency under WSL/OneDrive.
  // Increase the dev-server keep-alive so very slow Cloudinary uploads (large
  // PDFs over a poor connection) aren't killed by the Next.js HTTP server
  // before they complete.
  experimental: {
    proxyTimeout: 30 * 60 * 1000, // 30 minutes for large Cloudinary uploads
  },
  async headers() {
    return [
      // Global headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self)', // allow camera for same-origin
          },
        ],
      },
      //  Existing logo caching rule
      {
        source: '/logo.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000',
          },
        ],
      },
      // Cache all SVG files for 1 year
      {
        source: '/:path*.svg',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
