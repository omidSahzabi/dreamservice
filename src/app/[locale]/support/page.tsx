import { SupportScreen } from "@/components/modules/support/SupportScreen";
import { pageMetadata } from "@/lib/i18n/metadata";
export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) { return pageMetadata(params, "support", "/support"); }
export default function SupportPage() { return <SupportScreen />; }
