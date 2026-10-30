import type {MetadataRoute} from 'next';
import {publicSite} from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // Crawlers must reach responses to observe their noindex directives.
      // Private content remains protected by server-side authorization.
      allow: '/'
    },
    sitemap: new URL('/sitemap.xml', publicSite.url).toString()
  };
}
