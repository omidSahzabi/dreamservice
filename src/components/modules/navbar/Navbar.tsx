"use client";

import { usePathname } from "@/lib/i18n/navigation";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import Logo from "./Logo";
import DesktopNav from "./DesktopNav";
import MobileMenu from "./MobileMenu";
import { AuthButton } from "./AuthButton";
import ThemeToggle from "./ThemeToggle";
import LanguageToggleButton from "./LanguageToggleButton";

export default function Navbar() {
  const pathname = usePathname();
  const locale = useLocale();

  const isActive = useMemo(() => {
    return (href?: string): boolean => {
      if (!href) return false;
      const pathWithoutLocale = pathname;
      
      if (href === "/") return pathWithoutLocale === "/";
      return pathWithoutLocale.startsWith(href);
    };
  }, [pathname]);

  return (
    <div className="w-full flex justify-center pt-6 px-4">
      <nav
        dir={locale === "fa" ? "rtl" : "ltr"}
        className="w-full max-w-6xl border border-cyan-400/40 rounded-2xl px-6 py-4 flex items-center justify-between shadow-lg"
      >
        <Logo />
        <DesktopNav isActive={isActive} />
        <div className="hidden lg:flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggleButton />
          <AuthButton />
        </div>
        <MobileMenu isActive={isActive} />
      </nav>
    </div>
  );
}
