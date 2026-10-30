"use client";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { useAuthModalStore } from "@/store/authModalStore";
import { Button } from "@/components/ui/button";

export function AccessRequired({ forbidden = false, embedded = false }: { forbidden?: boolean; embedded?: boolean }) {
  const t = useTranslations("Security");
  const router = useRouter();
  const open = useAuthModalStore(state => state.openAuthModal);
  const Container = embedded ? "section" : "main";
  return <Container className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
    <h1>{forbidden ? t("forbidden") : t("signInRequired")}</h1>
    {!forbidden && <Button onClick={() => open("", () => router.refresh())}>{t("signIn")}</Button>}
    <Link href="/">{t("home")}</Link>
  </Container>;
}
