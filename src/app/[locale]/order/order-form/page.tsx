import {pageMetadata} from "@/lib/i18n/metadata";
export function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  return pageMetadata(params, "orderForm", "/order/order-form");
}

import { OrderForm } from "@/features/order/submit-forn/OrderForm";

export default function OrderFormPage() {
  return (
    <div>
        <OrderForm />
    </div>
);
}


