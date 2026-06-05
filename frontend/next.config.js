/** @type {import('next').NextConfig} */
const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/dashboard/payments", destination: "/overview", permanent: true },
      { source: "/dashboard/qr-codes", destination: "/dashboard/inventory?tab=qr_codes", permanent: false },
    ];
  },
  /** Same-origin proxy so QR scans (often unauthenticated, mobile) avoid cross-origin API/CORS failures. */
  async rewrites() {
    if (!apiBase) return [];
    return [
      {
        source: "/api/public/qr/resolve/:token",
        destination: `${apiBase}/api/public/qr/resolve/:token`,
      },
      {
        source: "/api/qr/resolve/:token",
        destination: `${apiBase}/api/qr/resolve/:token`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
