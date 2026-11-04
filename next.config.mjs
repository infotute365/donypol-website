/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow verification builds without replacing a running dev server's output.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // Next.js development uses eval-based source maps and a WebSocket for HMR.
    // Production keeps the stricter policy and does not permit unsafe-eval.
    const development = process.env.NODE_ENV === 'development';
    const scriptSources = development ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
    const connectionSources = development ? "'self' ws://localhost:* ws://127.0.0.1:* ws://[::1]:*" : "'self'";
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: `default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; img-src 'self' https: data: blob:; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; connect-src ${connectionSources}; frame-src 'self' https://www.google.com` },
    ];
    return [{ source: '/:path*', headers: securityHeaders }, {
      source: '/admin/preview/:path*', headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Content-Security-Policy', value: securityHeaders.find((header) => header.key === 'Content-Security-Policy').value.replace("frame-ancestors 'none'", "frame-ancestors 'self'") },
        { key: 'Cache-Control', value: 'private, no-store' },
      ],
    }];
  },
};
export default nextConfig;
