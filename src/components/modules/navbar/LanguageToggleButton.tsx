"use client";
import {useLocale, useTranslations} from "next-intl";
import {usePathname, useRouter} from "@/lib/i18n/navigation";
export default function LanguageToggleButton() {
  const locale = useLocale();
  const t = useTranslations("Navbar");
  const pathname = usePathname();
  const router = useRouter();
  const nextLocale = locale === "fa" ? "en" : "fa";
  return (
    <button type="button" aria-label={t("switchLanguage")} lang={nextLocale}
      onClick={() => router.replace(pathname + window.location.search + window.location.hash, {locale: nextLocale, scroll: false})}
      className="inline-flex h-10 min-w-10 items-center justify-center px-3 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-accent hover:text-foreground transition-colors">
      {locale === "fa" ? "EN" : "فا"}
    </button>
  );
}
