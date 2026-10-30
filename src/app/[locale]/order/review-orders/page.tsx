import {pageMetadata} from "@/lib/i18n/metadata";
export function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  return pageMetadata(params, "reviewOrders", "/order/review-orders");
}

import { ReviewOrdersView } from "@/features/order/review-orders";
import { getAuthenticatedPrincipal } from "@/lib/auth/authorization";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";

export default async function ReviewOrdersPage() {
  const principal = await getAuthenticatedPrincipal();
  if (!principal || principal.permission !== "ADMIN") return <AccessRequired forbidden={Boolean(principal)} />;
  return (
    <main
      className="relative z-10 w-full px-4 pb-24 pt-6 sm:px-6 lg:px-10"
    >
      <div className="mx-auto w-full max-w-[1400px]">
        <ReviewOrdersView />
      </div>
    </main>
  );
}
