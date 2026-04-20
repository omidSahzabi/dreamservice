import Link from "next/link";
import { NavigationMenuLink } from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  label: string;
  isActive: boolean;
};

export default function NavLink({ href, label, isActive }: NavLinkProps) {
  return (
    <NavigationMenuLink asChild>
      <Link
        href={href}
        className={cn(
          "relative text-sm font-medium transition-colors",
          isActive ? "text-cyan-400" : "text-slate-300 hover:text-white"
        )}
      >
        {label}
        {isActive && (
          <div className="absolute -bottom-2 right-0 w-full flex flex-col gap-0.5">
            <span className="w-full h-[2px] bg-cyan-400 rounded-full" />
            <span className="h-[1px] bg-cyan-400/50 rounded-full" />
          </div>
        )}
      </Link>
    </NavigationMenuLink>
  );
}