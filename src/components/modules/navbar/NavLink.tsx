"use client";

import Link from "next/link";
import { NavigationMenuLink } from "@/components/ui/navigation-menu";

interface NavLinkProps {
  href: string;
  label: string;
  active: boolean;
}

export default function NavLink({ href, label, active }: NavLinkProps) {
  return (
    <NavigationMenuLink asChild>
      <Link
        href={href}
        className={`relative text-sm font-medium transition-colors duration-200 ${
          active
            ? "text-cyan-400 font-semibold"
            : "text-slate-300 hover:text-white"
        }`}
      >
        {label}
        {active && (
          <span className="w-full h-0.5 bg-cyan-400 absolute -bottom-2 inset-x-0 rounded-full" />
        )}
      </Link>
    </NavigationMenuLink>
  );
}
