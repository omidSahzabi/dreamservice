import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ContentSkeleton({ layout = "details", count = 3, label, className }: {
  layout?: "cards" | "form" | "details" | "page";
  count?: number;
  label?: string;
  className?: string;
}) {
  return <SkeletonRegion label={label} className={cn("w-full", className)}>
    <div className="space-y-6">
      {(layout === "page" || layout === "form") && <div className="space-y-3 py-3"><Skeleton className="h-7 w-2/5" /><Skeleton className="w-3/5" /></div>}
      {layout === "form" ? <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <Skeleton className="h-2 w-full" /><div className="flex gap-3">{[0, 1, 2].map(i => <Skeleton key={i} shape="avatar" className="size-9" />)}</div>
        {[0, 1, 2, 3].map(i => <div key={i} className="space-y-3"><Skeleton className="w-28" /><Skeleton shape="block" className="h-11 w-full" /></div>)}
        <div className="flex justify-between"><Skeleton shape="block" className="h-11 w-24" /><Skeleton shape="block" className="h-11 w-32" /></div>
      </div> : layout === "details" ? <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3"><Skeleton shape="avatar" /><Skeleton className="h-5 w-2/5" /></div>
        {[0, 1, 2, 3].map(i => <div key={i} className="grid grid-cols-3 gap-4"><Skeleton /><Skeleton className="col-span-2" /></div>)}
        <Skeleton shape="block" className="h-24" />
      </div> : <div className={cn("grid gap-4", layout === "page" && "md:grid-cols-2 xl:grid-cols-3")}>
        {Array.from({ length: count }, (_, i) => <div key={i} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex justify-between gap-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-6 w-20 rounded-full" /></div>
          <div className="grid grid-cols-2 gap-4"><Skeleton /><Skeleton /><Skeleton className="w-3/4" /><Skeleton /></div>
          <Skeleton shape="block" className="h-20" /><Skeleton shape="block" className="h-9 w-32" />
        </div>)}
      </div>}
    </div>
  </SkeletonRegion>;
}
