"use client";

import { useState } from "react";
import {Link} from "@/lib/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AuthButton } from "./AuthButton";
import ThemeToggle from "./ThemeToggle";
import LanguageToggleButton from "./LanguageToggleButton";
import { IsActiveFunction } from "./types";
import { useNavItems } from "./useNavItems";
import Logo from "./Logo";

interface MobileMenuProps {
  isActive: IsActiveFunction;
}

export default function MobileMenu({ isActive }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations("Navbar");
  const navItems = useNavItems();

  return (
    <div className="lg:hidden flex items-center gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-text-secondary hover:text-foreground"
            aria-label={t("openMenu")}
          >
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side={locale === "fa" ? "left" : "right"}
          className="w-[280px] sm:w-[320px] bg-popover border-border p-6 flex flex-col justify-between"
          dir={locale === "fa" ? "rtl" : "ltr"}
        >
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle className="text-start text-primary font-bold">
                <Logo />
              </SheetTitle>
              <SheetDescription className="sr-only">{t("openMenu")}</SheetDescription>
            </SheetHeader>

            <nav className="flex flex-col gap-4">
              {navItems.map((item) => {
                if (item.children) {
                  return (
                    <div key={item.label} className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {item.label}
                      </span>
                      <div className="flex flex-col gap-2 ps-3 border-s border-border">
                        {item.children.map((child) => {
                          const active = isActive(child.href);
                          return (
                            <Link
                              key={child.label}
                              href={child.href}
                              onClick={() => setOpen(false)}
                              className={`text-sm py-1 transition-colors ${
                                active
                                  ? "text-primary font-medium"
                                  : "text-text-secondary hover:text-foreground"
                              }`}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const active = isActive(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href ?? "#"}
                    onClick={() => setOpen(false)}
                    className={`text-base font-medium transition-colors ${
                      active ? "text-primary" : "text-text-secondary hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-6 border-t border-border flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <ThemeToggle />
              <LanguageToggleButton />
            </div>
            <AuthButton />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
