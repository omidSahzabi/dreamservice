import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'X-Frame-Options', value: 'DENY'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
      {key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"}
    ]}, ...['/api/:path*', '/:locale(en|fa)/:section(admin|account|order|support)/:path*', '/:section(admin|account|order|support)/:path*'].map(source => ({
      source, headers: [{key: 'X-Robots-Tag', value: 'noindex, nofollow'}]
    }))];
  }
};

export default withNextIntl(nextConfig);
