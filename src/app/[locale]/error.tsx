'use client';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
export default function ErrorPage({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  const t = useTranslations('Common');
  return <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
    <h1>{t('errorTitle')}</h1><p>{t('errorDescription')}</p><Button onClick={reset}>{t('retry')}</Button>
  </main>;
}
