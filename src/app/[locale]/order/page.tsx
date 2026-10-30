import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/i18n/navigation';
import {pageMetadata} from '@/lib/i18n/metadata';
import {getAuthenticatedPrincipal} from '@/lib/auth/authorization';
import {CustomerOrders} from '@/features/order/workflow/CustomerOrders';
import {AccessRequired} from '@/components/modules/auth/AccessRequired';
import {Button} from '@/components/ui/button';
import {z} from 'zod';

export function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  return pageMetadata(params, 'order', '/order');
}
export default async function OrderPage({searchParams}: {searchParams: Promise<{orderId?: string | string[]}>}) {
  const t = await getTranslations('Order');
  const principal = await getAuthenticatedPrincipal();
  const {orderId} = await searchParams;
  const parsed = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(z.number().int().max(2147483647)).safeParse(orderId);
  return (
    <main className="mx-auto min-h-[60vh] max-w-5xl space-y-6 p-4">
      <div className="rounded-2xl border border-border-soft bg-card px-5 py-6 text-start shadow-soft sm:px-8">
        <h1 className="text-2xl font-bold text-text-primary">{t('homeTitle')}</h1>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <Button asChild><Link href="/order/order-form">{t('submit')}</Link></Button>
          {principal?.permission === 'ADMIN' && <Button asChild variant="outline"><Link href="/order/review-orders">{t('review')}</Link></Button>}
        </div>
      </div>
      {principal ? <CustomerOrders key={principal.id} orderId={parsed.success ? parsed.data : undefined} invalidOrderId={orderId !== undefined && !parsed.success} /> : <AccessRequired embedded />}
    </main>
  );
}
