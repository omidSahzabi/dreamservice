import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'fa'];

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as any)) {
    return {
      locale: 'en',
      messages: (await import(`../messages/en.json`)).default,
    };
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});