/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // Staff can paste image links from any site (e.g. Pinterest) on packages
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts', 'sonner'],
    // Client router cache: revisiting a dynamic page within 30s renders instantly from cache.
    // Own edits still show immediately (server actions call revalidatePath / router.refresh).
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Stop other sites from framing the app (clickjacking); our own iframes are unaffected
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Browsers ignore HSTS over plain http, so local development is unaffected
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/travinco_dashboard',
        permanent: false,
      },
      {
        // Leads were merged into Enquiries
        source: '/travinco_dashboard/leads',
        destination: '/travinco_dashboard/enquiries',
        permanent: false,
      },
      {
        source: '/admin/:path*',
        destination: '/travinco_dashboard/:path*',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
