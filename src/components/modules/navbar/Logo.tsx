"use client";
import {useTranslations} from "next-intl";
import Image from "next/image";
import {Link} from "@/lib/i18n/navigation";
import LogoSvg from "@/../public/images/dreamservice-logo.svg";

export default function Logo() {
  const t = useTranslations("Navbar");
  return (
    <Link href="/" className="flex items-center">
      <Image
        src={LogoSvg}
        alt={t("logoAlt")}
        width={120}
        height={32}
        priority
        className="me-5 w-[120px] h-auto"
      />
    </Link>
  );
}