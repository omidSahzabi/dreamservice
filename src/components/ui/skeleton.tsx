import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function Skeleton({ className, shape = "line", ...props }: ComponentProps<"div"> & { shape?: "line" | "avatar" | "block" }) {
  return <div {...props} aria-hidden="true" data-slot="skeleton" className={cn("ds-skeleton bg-muted",
    shape === "line" ? "h-3 rounded-md" : shape === "avatar" ? "size-12 rounded-full" : "rounded-xl", className)} />;
}

export function SkeletonRegion({ children, label, className }: { children: React.ReactNode; label?: string; className?: string }) {
  const t = useTranslations("Common");
  return <div role="status" aria-label={label ?? t("loading")} aria-busy="true" className={className}>
    <div aria-hidden="true">{children}</div>
  </div>;
}
