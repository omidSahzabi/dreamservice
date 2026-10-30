import { SupportScreen } from "@/components/modules/support/SupportScreen";
import { pageMetadata } from "@/lib/i18n/metadata";
export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) { return pageMetadata(params, "support", "/support/new"); }
export default async function NewSupportPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const value = (await searchParams).orderId;
  const orderId = value && /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 2147483647 ? Number(value) : undefined;
  return <SupportScreen create orderId={orderId} />;
}
