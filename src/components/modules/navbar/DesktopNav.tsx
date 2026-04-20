"use client";

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from "@/components/ui/navigation-menu";
import { navItems } from "@/lib/dic";
import type { NavItem } from "@/lib/dic";
import NavLink from "./NavLink";
import NavDropdown from "./NavDropdown";

type DesktopNavProps = {
  isActive: (href?: string) => boolean;
};

export default function DesktopNav({ isActive }: DesktopNavProps) {
  return (
    <div className="hidden lg:flex items-center">
      <NavigationMenu>
        <NavigationMenuList className="gap-6">
          {(navItems as NavItem[]).map((item) => {
            const activeParent: boolean =
              isActive(item.href) ||
              (item.children?.some((child) => isActive(child.href)) ?? false);

            if (item.children?.length) {
              return (
                <NavDropdown
                  key={item.label}
                  label={item.label}
                  items={item.children}
                  isActive={activeParent}
                  isChildActive={isActive}
                />
              );
            }

            return (
              <NavigationMenuItem key={item.label}>
                <NavLink
                  href={item.href ?? "#"}
                  label={item.label}
                  isActive={activeParent}
                />
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}