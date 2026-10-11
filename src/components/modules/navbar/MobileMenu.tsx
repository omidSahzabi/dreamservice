"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AuthButton } from "./AuthButton";
import ThemeToggle from "./ThemeToggle";
import LanguageToggleButton from "./LanguageToggleButton";
import { IsActiveFunction } from "./types";
import { useNavItems } from "./useNavItems";

interface MobileMenuProps {
  isActive: IsActiveFunction;
}

export default function MobileMenu({ isActive }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const navItems = useNavItems();

  return (
    <div className="lg:hidden flex items-center gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side={locale === "fa" ? "right" : "left"}
          className="w-[280px] sm:w-[320px] bg-slate-950/95 border-cyan-400/30 backdrop-blur-md p-6 flex flex-col justify-between"
          dir={locale === "fa" ? "rtl" : "ltr"}
        >
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle className="text-start text-cyan-400 font-bold">
                DreamService
              </SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col gap-4">
              {navItems.map((item) => {
                if (item.children) {
                  return (
                    <div key={item.label} className="space-y-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {item.label}
                      </span>
                      <div className="flex flex-col gap-2 ps-3 border-s border-slate-800">
                        {item.children.map((child) => {
                          const active = isActive(child.href);
                          return (
                            <Link
                              key={child.label}
                              href={child.href}
                              onClick={() => setOpen(false)}
                              className={`text-sm py-1 transition-colors ${
                                active
                                  ? "text-cyan-400 font-medium"
                                  : "text-slate-300 hover:text-white"
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
                      active ? "text-cyan-400" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-6 border-t border-slate-800/80 flex flex-col gap-4">
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
