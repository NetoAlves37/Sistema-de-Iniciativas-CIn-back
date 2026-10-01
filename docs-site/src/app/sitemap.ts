import type { MetadataRoute } from 'next';

import { source } from '@/lib/source';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3030';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...source.getPages().map((page) => ({
      url: `${BASE_URL}${page.url}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
