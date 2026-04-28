import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // ترتیب زبان‌ها: اولی default می‌شود
  locales: ['en', 'fa'], 
  defaultLocale: 'en',
  // این خط باعث می‌شود زبان در URL باشد (مثلا /fa/home)
  localePrefix: 'always', 
});

export const config = {
  // این matcher اجازه می‌دهد تمام مسیرها پردازش شوند، مگر فایل‌های ثابت
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};