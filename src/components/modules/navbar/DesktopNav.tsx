"use client";

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from "@/components/ui/navigation-menu";
import NavLink from "./NavLink";
import NavDropdown from "./NavDropdown";
import { IsActiveFunction } from "./types";
import { useNavItems } from "./useNavItems";

interface DesktopNavProps {
  isActive: IsActiveFunction;
}

export default function DesktopNav({ isActive }: DesktopNavProps) {
  const navItems = useNavItems();

  return (
    <div className="hidden lg:flex items-center">
      <NavigationMenu>
        <NavigationMenuList className="flex items-center gap-6">
          {navItems.map((item) => {
            if (item.children) {
              const activeParent =
                isActive(item.href) ||
                item.children.some((c) => isActive(c.href));

              return (
                <NavDropdown
                  key={item.label}
                  label={item.label}
                  items={item.children}
                  activeParent={activeParent}
                  isChildActive={(href) => isActive(href)}
                />
              );
            }

            return (
              <NavigationMenuItem key={item.label}>
                <NavLink
                  href={item.href ?? "#"}
                  label={item.label}
                  active={isActive(item.href)}
                />
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
