/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/dashboard/payments", destination: "/overview", permanent: true }];
  },
};

module.exports = nextConfig;
