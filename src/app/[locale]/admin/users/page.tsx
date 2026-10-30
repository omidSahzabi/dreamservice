import { pageMetadata } from "@/lib/i18n/metadata";
import { getAuthenticatedPrincipal } from "@/lib/auth/authorization";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";
import { UsersView } from "@/components/modules/admin/users-view";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "adminUsers", "/admin/users");
}
export default async function UsersPage() {
  const principal = await getAuthenticatedPrincipal();
  if (!principal || principal.permission !== "ADMIN") return <AccessRequired forbidden={Boolean(principal)} />;
  return <main className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:px-10"><UsersView actorId={principal.id} /></main>;
}
