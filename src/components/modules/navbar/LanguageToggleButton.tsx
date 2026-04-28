"use client";

import { usePathname, useRouter } from 'next/navigation';

export default function LanguageToggleButton() {
  const pathname = usePathname();
  const router = useRouter();

  const segments = pathname.split('/');
  const currentLocale = segments[1];

  const toggleLocale = currentLocale === 'fa' ? 'en' : 'fa';

  segments[1] = toggleLocale;

  const newPath = segments.join('/');

  return (
    <button
      onClick={() => router.push(newPath)}
      className="px-3 py-1 rounded-lg border"
    >
      {currentLocale === 'fa' ? 'EN' : 'فا'}
    </button>
  );
}
