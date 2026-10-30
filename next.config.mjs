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
      bodySizeLimit: '5mb',
    },
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
