"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/dic";
import Logo from "../../../../public/images/dreamservice-logo.svg"

export type NavChild = {
  label: string;
  href: string;
  description?: string;
};

export type NavItem = {
  label: string;
  href?: string;
  children?: NavChild[];
};

export default function Navbar(): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState<boolean>(false);

  const isActive = useMemo(() => {
    return (href?: string): boolean => {
      if (!href) return false;
      if (href === "/") return pathname === "/";
      return pathname?.startsWith(href) ?? false;
    };
  }, [pathname]);

  return (
    <div className="w-full flex  justify-center pt-6 px-4">
      <nav
        dir="rtl"
        className="w-full max-w-6xl  border border-cyan-400/40 rounded-2xl px-6 py-4 flex items-center justify-between shadow-lg"
      >
        <Link href="/" className="flex items-center">
          <Image
            src={Logo}
            alt="BugLine Logo"
            width={120}
            height={32}
            priority
            className="object-contain mr-5"
            // style={{ marginRight : '1rem'}}
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center">
          <NavigationMenu>
            <NavigationMenuList className="gap-6">
              {(navItems as NavItem[]).map((item) => {
                const activeParent: boolean =
                  isActive(item.href) ||
                  (item.children?.some((child) => isActive(child.href)) ?? false);

                if (item.children?.length) {
                  return (
                    <NavigationMenuItem key={item.label}>
                      <NavigationMenuTrigger
                        className={cn(
                          "bg-transparent text-sm font-medium hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent",
                          activeParent
                            ? "text-cyan-400"
                            : "text-slate-300 hover:text-white"
                        )}
                      >
                        {item.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="grid w-[320px] gap-3 p-4 bg-bg-primary">
                          {item.children.map((child) => (
                            <NavigationMenuLink asChild key={child.href}>
                              <Link
                                href={child.href}dream-form
                                className={cn(
                                  "block rounded-xl p-3 transition-colors",
                                  isActive(child.href)
                                    ? "bg-cyan-400/10 text-cyan-400"
                                    : "hover:bg-slate-800 text-slate-300 hover:text-white"
                                )}
                              >
                                <div className="text-sm font-medium">
                                  {child.label}
                                </div>
                                {child.description && (
                                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    {child.description}
                                  </p>
                                )}
                              </Link>
                            </NavigationMenuLink>
                          ))}
                        </div>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  );
                }

                return (
                  <NavigationMenuItem key={item.label}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={item.href ?? "#"}
                        className={cn(
                          "relative text-sm font-medium transition-colors",
                          activeParent
                            ? "text-cyan-400"
                            : "text-slate-300 hover:text-white"
                        )}
                      >
                        {item.label}
                        {activeParent && (
                          <div className="absolute -bottom-2 right-0 w-full flex flex-col gap-0.5">
                            <span className="w-full h-[2px] bg-cyan-400 rounded-full" />
                            <span className=" h-[1px] bg-cyan-400/50 rounded-full" />
                          </div>
                        )}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Desktop Auth */}
        <div className="hidden lg:flex">
          <Button
            variant="outline"
            className="rounded-xl border-cyan-400/50 text-white hover:bg-cyan-400/10 hover:text-white flex items-center gap-2"
          >
            <Avatar className="w-6 h-6 bg-slate-800">
              <AvatarFallback className="text-xs">U</AvatarFallback>
            </Avatar>
            <span>پروفایل یا ورود</span>
          </Button>
        </div>

        {/* Mobile Menu */}
        <div className="lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6 text-white" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-slate-950 border-l border-cyan-400/30 p-6">
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
                            activeParent
                              ? "text-cyan-400"
                              : "text-slate-300"
                          )}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <>
                          <span
                            className={cn(
                              "text-base font-semibold",
                              activeParent
                                ? "text-cyan-400"
                                : "text-white"
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

                <Button
                  variant="outline"
                  className="rounded-xl border-cyan-400/50 text-white hover:bg-cyan-400/10 hover:text-white flex items-center justify-between"
                >
                  <span>پروفایل یا ورود</span>
                  <Avatar className="w-6 h-6 bg-slate-800">
                    <AvatarFallback className="text-xs">U</AvatarFallback>
                  </Avatar>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
