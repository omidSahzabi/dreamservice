import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'fa'];

export default getRequestConfig(async ({ locale }) => {
  // اگر زبان در لیست ما نیست، پیش‌فرض را انتخاب کن (یا خطا بده)
  if (!locales.includes(locale as any)) {
    // در اینجا به جای notFound، بهتر است از زبان پیش‌فرض استفاده کنیم
    // مگر اینکه بخواهید صفحه 404 نشان دهد
    return {
      locale: 'en',
      messages: (await import(`../messages/en.json`)).default,
    };
  }

  return {
    locale,
    // مسیر قبلی درست بود، چون request.ts در i18n/ است و messages/ در کنار آن
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});