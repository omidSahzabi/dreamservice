import type {MetadataRoute} from 'next';
import {publicSite} from '@/lib/site';
import {routing} from '../../i18n/routing';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/about'].flatMap(path => routing.locales.map(locale => ({
    url: new URL('/' + locale + path, publicSite.url).toString(),
    alternates: {
      languages: {
        ...Object.fromEntries(routing.locales.map(language => [language, new URL('/' + language + path, publicSite.url).toString()])),
        'x-default': new URL('/en' + path, publicSite.url).toString()
      }
    }
  })));
}
