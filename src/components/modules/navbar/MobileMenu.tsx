"use client";

import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/dic";
import type { NavItem } from "@/lib/dic";
import AuthButton from "./AuthButton";
import ThemeToggle from "./ThemeToggle";

type MobileMenuProps = {
  isActive: (href?: string) => boolean;
};

export default function MobileMenu({ isActive }: MobileMenuProps) {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <div className="lg:hidden flex items-center gap-2">
      <ThemeToggle />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="w-6 h-6 text-white" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="bg-slate-950 border-l border-cyan-400/30 p-6"
        >
          <div className="flex flex-col gap-6 mt-6">
            {(navItems as NavItem[]).map((item) => {
              const activeParent: boolean =
                isActive(item.href) ||
                (item.children?.some((child) => isActive(child.href)) ?? false);

              return (
                <div key={item.label} className="flex flex-col gap-2">
                  {item.href && !item.children ? (
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "text-base font-medium",
                        activeParent ? "text-cyan-400" : "text-slate-300"
                      )}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "text-base font-semibold",
                          activeParent ? "text-cyan-400" : "text-white"
                        )}
                      >
                        {item.label}
                      </span>
                      <div className="flex flex-col gap-2 pr-4">
                        {item.children?.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "text-sm",
                              isActive(child.href)
                                ? "text-cyan-400"
                                : "text-slate-400"
                            )}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                  <Separator className="bg-slate-800" />
                </div>
              );
            })}
            <AuthButton variant="mobile" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}