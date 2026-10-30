"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import geometry from "./geometry.json";
import { initialLoaderState, updateLoaderState, finishLoaderState } from "./loader-state";

type Props = {
  loading: boolean;
  /** Explicit success prevents errors/cancellation from launching the arrow. */
  success?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "inline" | "centered" | "overlay";
  label?: string;
  decorative?: boolean;
  className?: string;
};

export function DreamServiceLoader({ loading, success = false, size = "md", variant = "inline", label, decorative = false, className }: Props) {
  const t = useTranslations("Common");
  const maskId = useId();
  const [state, setState] = useState(() => initialLoaderState(loading, success));
  // Synchronize during render so rapid updates cannot paint a stale launch.
  // No timers, effects or delayed content/navigation are involved.
  if (state.loading !== loading || state.success !== success) setState(updateLoaderState(state, loading, success));
  return <span dir="ltr" data-slot="dream-loader" data-state={state.phase}
    role={!decorative && loading ? "status" : undefined}
    aria-live={!decorative && loading ? "polite" : undefined}
    aria-atomic={!decorative && loading ? true : undefined}
    aria-hidden={decorative || state.phase === "complete" ? true : undefined}
    className={cn("ds-loader pointer-events-none inline-flex shrink-0 items-center justify-center text-primary",
      variant === "centered" && "flex w-full py-8",
      variant === "overlay" && "absolute inset-0 z-10 bg-background/70",
      className)}>
    <svg viewBox={geometry.viewBox} fill="currentColor" aria-hidden="true" focusable="false"
      className={cn("overflow-visible", size === "sm" ? "size-4" : size === "lg" ? "size-16" : "size-9")}>
      <defs><mask id={maskId}><rect width="32" height="32" fill="white" /><path d={geometry.clearance} fill="black" /></mask></defs>
      <g className="ds-loader-bow"><path d={geometry.arch} fillRule="evenodd" mask={`url(#${maskId})`} /></g>
      <path className="ds-loader-string" d="M8 8 11 16 8 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <g key={state.cycle} className="ds-loader-arrow" onAnimationEnd={event => {
        if (event.target === event.currentTarget && ["ds-arrow-release", "ds-loader-dismiss"].includes(event.animationName)) {
          setState(current => finishLoaderState(current, state.cycle));
        }
      }}><path d={geometry.needle} /></g>
    </svg>
    {!decorative && loading && <span className="sr-only">{label ?? t("loading")}</span>}
  </span>;
}
