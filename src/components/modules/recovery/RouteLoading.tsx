import {getTranslations} from 'next-intl/server';
import {ContentSkeleton} from '@/components/ui/content-skeleton';
export default async function RouteLoading() {
  const t = await getTranslations('Common');
  return <main className="mx-auto min-h-[60vh] w-full max-w-7xl p-4 sm:p-8"><ContentSkeleton layout="page" label={t('loading')} /></main>;
}
