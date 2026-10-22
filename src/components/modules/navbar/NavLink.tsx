"use client";

import {Link} from "@/lib/i18n/navigation";
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
            ? "text-primary font-semibold"
            : "text-text-secondary hover:text-foreground"
        }`}
      >
        {label}
        {active && (
          <span className="w-full h-0.5 bg-primary absolute -bottom-2 inset-x-0 rounded-full" />
        )}
      </Link>
    </NavigationMenuLink>
  );
}
