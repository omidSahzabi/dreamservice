import {useTranslations} from 'next-intl';
import {Link} from '@/lib/i18n/navigation';
import {Home} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {GoBackButton} from '@/components/modules/recovery/GoBackButton';
import {RecoveryScreen} from '@/components/modules/recovery/RecoveryScreen';
export default function NotFound() {
  const t = useTranslations('Recovery');
  return <RecoveryScreen status="404" copy={{eyebrow: t('notFound.eyebrow'), title: t('notFound.title'), description: t('notFound.description'), documentTitle: t('notFound.documentTitle')}} actions={<>
    <Button asChild><Link href="/"><Home aria-hidden="true" />{t('home')}</Link></Button>
    <GoBackButton label={t('back')} />
  </>} />;
}
