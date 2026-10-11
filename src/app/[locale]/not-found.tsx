import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/i18n/navigation';
export default async function NotFound() {
  const t = await getTranslations('Common');
  return <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
    <h1>{t('notFoundTitle')}</h1><p>{t('notFoundDescription')}</p><Link href="/">{t('home')}</Link>
  </main>;
}
