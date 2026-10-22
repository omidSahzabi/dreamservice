"use client";
import {useTranslations} from "next-intl";
import {Link} from "@/lib/i18n/navigation";
import {BrandIdentity} from "@/components/brand/BrandIdentity";

export default function Logo() {
  const t = useTranslations("Navbar");
  return (
    <Link href="/" aria-label={t("logoAlt")} className="inline-flex shrink-0 items-center gap-2.5 rounded-md" dir="ltr">
      <BrandIdentity />
    </Link>
  );
}
