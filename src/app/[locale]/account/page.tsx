import { getTranslations } from "next-intl/server";
import { getAuthenticatedPrincipal } from "@/lib/auth/authorization";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";
import { AccountProfile } from "@/components/modules/auth/AccountProfile";

export async function generateMetadata() {
  const t = await getTranslations("Account");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AccountPage() {
  const actor = await getAuthenticatedPrincipal();
  if (!actor) return <AccessRequired />;
  const t = await getTranslations("Account");
  return <main className="mx-auto min-h-[60vh] max-w-xl space-y-5 px-4 py-8"><h1 className="text-2xl font-bold">{t("title")}</h1><AccountProfile actorId={actor.id} /></main>;
}
