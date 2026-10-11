import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {notFound} from 'next/navigation';
import {routing} from '../../../i18n/routing';

export async function pageMetadata(
  params: Promise<{locale: string}>, page: 'home' | 'about' | 'order' | 'orderForm' | 'reviewOrders', path: string
): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({locale, namespace: 'Metadata'});
  return {
    title: t('pages.' + page + '.title'), description: t('pages.' + page + '.description'),
    alternates: {
      canonical: '/' + locale + path,
      languages: Object.fromEntries(routing.locales.map(language => [language, '/' + language + path]))
    }
  };
}
