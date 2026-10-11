"use client";

import Link from "next/link";
import {
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { NavChild } from "./types";

interface NavDropdownProps {
  label: string;
  items: NavChild[];
  activeParent: boolean;
  isChildActive: (href: string) => boolean;
}

export default function NavDropdown({
  label,
  items,
  activeParent,
  isChildActive,
}: NavDropdownProps) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={`bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent text-sm font-medium transition-colors ${
          activeParent ? "text-cyan-400" : "text-slate-300 hover:text-white"
        }`}
      >
        {label}
      </NavigationMenuTrigger>

      <NavigationMenuContent className="p-3 bg-slate-900/95 border border-cyan-400/30 backdrop-blur-md rounded-xl shadow-xl">
        <ul className="grid w-[320px] gap-2 p-1">
          {items.map((child) => {
            const active = isChildActive(child.href);
            return (
              <li key={child.label}>
                <NavigationMenuLink asChild>
                  <Link
                    href={child.href}
                    className={`block select-none rounded-lg p-3 text-sm leading-none no-underline outline-none transition-colors ${
                      active
                        ? "bg-cyan-400/10 text-cyan-400"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <div className="text-sm font-semibold">{child.label}</div>
                    {child.description && (
                      <p className="line-clamp-2 text-xs leading-snug text-slate-400 mt-1">
                        {child.description}
                      </p>
                    )}
                  </Link>
                </NavigationMenuLink>
              </li>
            );
          })}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
