import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {notFound} from 'next/navigation';
import {routing} from '../../../i18n/routing';
import {publicSite} from '@/lib/site';

export async function pageMetadata(
  params: Promise<{locale: string}>, page: 'home' | 'about' | 'order' | 'orderForm' | 'reviewOrders' | 'adminUsers' | 'adminProjects' | 'support' | 'adminTickets', path: string
): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({locale, namespace: 'Metadata'});
  const title = t('pages.' + page + '.title');
  const description = t('pages.' + page + '.description');
  if (page !== 'home' && page !== 'about') {
    return {title, description, robots: {index: false, follow: false}};
  }
  const url = new URL('/' + locale + path, publicSite.url);
  const image = new URL('/opengraph-image', publicSite.url).toString();
  return {
    title, description,
    robots: {index: true, follow: true},
    openGraph: {
      type: 'website', title, description, url, siteName: 'DreamService',
      locale: locale === 'fa' ? 'fa_IR' : 'en_US',
      alternateLocale: locale === 'fa' ? 'en_US' : 'fa_IR',
      images: [{url: image, width: 1200, height: 630, alt: 'DreamService'}]
    },
    twitter: {card: 'summary_large_image', title, description, images: [image]},
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(routing.locales.map(language => [language, new URL('/' + language + path, publicSite.url).toString()])),
        'x-default': new URL('/en' + path, publicSite.url).toString()
      }
    }
  };
}
