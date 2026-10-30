import { SupportScreen } from "@/components/modules/support/SupportScreen";
import { pageMetadata } from "@/lib/i18n/metadata";
export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) { return pageMetadata(params, "adminTickets", "/admin/tickets"); }
export default async function AdminTicketPage({ params }: { params: Promise<{ ticketId: string }> }) { return <SupportScreen admin ticketId={(await params).ticketId} />; }
