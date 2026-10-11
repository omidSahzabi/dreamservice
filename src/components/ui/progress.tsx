"use client"

import * as React from "react"
import {useLocale, useFormatter} from "next-intl"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const locale = useLocale()
  const format = useFormatter()
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      getValueLabel={(current, max) => format.number(current / max, {style: "percent", maximumFractionDigits: 0})}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(${locale === "fa" ? "" : "-"}${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
