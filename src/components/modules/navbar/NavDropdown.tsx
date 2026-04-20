import Link from "next/link";
import {
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import type { NavChild } from "@/lib/dic";

type NavDropdownProps = {
  label: string;
  items: NavChild[];
  isActive: boolean;
  isChildActive: (href: string) => boolean;
};

export default function NavDropdown({
  label,
  items,
  isActive,
  isChildActive,
}: NavDropdownProps) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={cn(
          "bg-transparent text-sm font-medium hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent",
          isActive ? "text-cyan-400" : "text-slate-300 hover:text-white"
        )}
      >
        {label}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <div className="grid w-[320px] gap-3 p-4 bg-bg-primary">
          {items.map((item) => (
            <NavigationMenuLink asChild key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "block rounded-xl p-3 transition-colors",
                  isChildActive(item.href)
                    ? "bg-cyan-400/10 text-cyan-400"
                    : "hover:bg-slate-800 text-slate-300 hover:text-white"
                )}
              >
                <div className="text-sm font-medium">{item.label}</div>
                {item.description && (
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {item.description}
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