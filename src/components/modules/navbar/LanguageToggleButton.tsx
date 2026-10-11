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
      className="px-3 py-1 rounded-lg border">
      {locale === "fa" ? "EN" : "فا"}
    </button>
  );
}
