import { getAuthenticatedPrincipal } from "@/lib/auth/authorization";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";
import { SupportClient } from "./support-view";

export async function SupportScreen({ admin = false, ticketId, create = false, orderId }: { admin?: boolean; ticketId?: string; create?: boolean; orderId?: number }) {
  const principal = await getAuthenticatedPrincipal();
  if (!principal || (admin && principal.permission !== "ADMIN")) return <AccessRequired forbidden={Boolean(principal)} />;
  return <main className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:px-10"><SupportClient actorId={principal.id} admin={admin} ticketId={ticketId} create={create} orderId={orderId} /></main>;
}
