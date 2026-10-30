"use client"

import * as React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { densityRowClasses, densityCellClasses } from "./data-table-density"
import type { DensityState } from "./data-table-types"
import { cn } from "@/lib/utils"

const SKELETON_WIDTHS = ["w-16", "w-24", "w-20", "w-28", "w-14"]

type Props = {
  rows: number
  columns: number
  density?: DensityState
}

export function DataTableSkeleton({ rows, columns, density = "default" }: Props) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow
          key={`skeleton-row-${rowIndex}`}
          className={cn("border-border hover:bg-transparent", densityRowClasses[density])} aria-hidden="true"
        >
          {Array.from({ length: columns }).map((__, columnIndex) => {
            const width =
              SKELETON_WIDTHS[(rowIndex + columnIndex) % SKELETON_WIDTHS.length]

            return (
              <TableCell
                key={`skeleton-cell-${rowIndex}-${columnIndex}`}
                className={densityCellClasses[density]}
              >
                <Skeleton className={`${width} max-w-full`} />
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}
