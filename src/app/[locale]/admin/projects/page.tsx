import { pageMetadata } from "@/lib/i18n/metadata";
import { getAuthenticatedPrincipal } from "@/lib/auth/authorization";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";
import { ProjectsView } from "@/components/modules/admin/projects-view";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "adminProjects", "/admin/projects");
}
export default async function ProjectsPage() {
  const principal = await getAuthenticatedPrincipal();
  if (!principal || principal.permission !== "ADMIN") return <AccessRequired forbidden={Boolean(principal)} />;
  return <main className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:px-10"><ProjectsView actorId={principal.id} /></main>;
}
