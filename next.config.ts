import type { NextConfig } from "next";

// CDN (CloudFront) host that serves banner images, derived from CDN_BASE_URL so
// whitelisting stays correct if the distribution changes.
const cdnHost = (() => {
  try {
    return new URL(
      process.env.CDN_BASE_URL || "https://d3efr8i3xj2spn.cloudfront.net"
    ).hostname;
  } catch {
    return "d3efr8i3xj2spn.cloudfront.net";
  }
})();

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // SEO and Performance Optimizations
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [{ protocol: "https", hostname: cdnHost }],
  },
  
  // Headers for security and SEO
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
    ]
  },
};

export default nextConfig;
