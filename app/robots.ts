import { MetadataRoute } from 'next';
import { getPublicBaseUrl } from '@/lib/public-base-url';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/cs/admin',
          '/en/admin',
          '/cs/admin/dashboard',
          '/en/admin/dashboard',
          '/cs/login',
          '/en/login',
          '/cs/clen',
          '/en/clen',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
