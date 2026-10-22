import {pageMetadata} from "@/lib/i18n/metadata";
export function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  return pageMetadata(params, "orderForm", "/order/order-form");
}

import { OrderForm } from "@/features/order/submit-forn/OrderForm";
import { getAuthenticatedPrincipal } from "@/lib/auth/authorization";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";

export default async function OrderFormPage() {
  const principal = await getAuthenticatedPrincipal();
  if (!principal) return <AccessRequired />;
  return (
    <div>
        <OrderForm key={principal.id} />
    </div>
);
}


