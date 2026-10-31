import {getTranslations} from "next-intl/server";
import {temporaryAdminLoginConfig} from "@/lib/auth/temporary-admin-config";
import {TemporaryAdminLogin} from "@/components/modules/auth/TemporaryAdminLogin";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await getTranslations("TemporaryAdminLogin");
  return {title: t("title"), robots: {index: false, follow: false}};
}
export default async function TemporaryAdminLoginPage() {
  const t = await getTranslations("TemporaryAdminLogin");
  const enabled = Boolean(temporaryAdminLoginConfig());
  return <main className="mx-auto min-h-[60vh] w-full max-w-md px-4 py-12">
    <section className="space-y-6 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t(enabled ? "description" : "disabled")}</p>
      {enabled && <TemporaryAdminLogin />}
    </section>
  </main>;
}
