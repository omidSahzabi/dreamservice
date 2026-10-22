import {getTranslations} from 'next-intl/server';
export default async function RouteLoading() {
  const t = await getTranslations('Common');
  return <main className="flex min-h-[60vh] items-center justify-center p-8" role="status">{t('loading')}</main>;
}
