'use client';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {Home, RotateCcw} from 'lucide-react';
import {Link} from '@/lib/i18n/navigation';
import {RecoveryScreen} from '@/components/modules/recovery/RecoveryScreen';
import {useErrorReport, type ErrorBoundaryProps} from '@/components/modules/recovery/use-error-report';

export default function ErrorPage({error, reset, unstable_retry}: ErrorBoundaryProps) {
  const t = useTranslations('Recovery');
  useErrorReport(error, 'locale');
  return <RecoveryScreen status="500" copy={{eyebrow: t('error.eyebrow'), title: t('error.title'), description: t('error.description'), documentTitle: t('error.documentTitle')}} actions={<>
    <Button onClick={unstable_retry ?? reset}><RotateCcw aria-hidden="true" />{t('retry')}</Button>
    <Button asChild variant="outline"><Link href="/"><Home aria-hidden="true" />{t('home')}</Link></Button>
  </>} />;
}
