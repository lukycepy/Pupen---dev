import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
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
    sitemap: 'https://pupen.org/sitemap.xml',
  };
}

