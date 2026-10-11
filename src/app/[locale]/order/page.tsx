import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/i18n/navigation';
import {pageMetadata} from '@/lib/i18n/metadata';

export function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  return pageMetadata(params, 'order', '/order');
}
export default async function OrderPage() {
  const t = await getTranslations('Order');
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="rounded-xl border border-border-soft bg-bg-primary/50 px-8 py-6 text-center shadow-sm">
        <h1 className="text-sm text-text-secondary">{t('homeTitle')}</h1>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <Link href="/order/order-form">{t('submit')}</Link>
          <Link href="/order/review-orders">{t('review')}</Link>
        </div>
      </div>
    </main>
  );
}
